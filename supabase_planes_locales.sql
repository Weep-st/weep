-- ═══════════════════════════════════════════════════
-- SISTEMA DE PLANES Y COMISIONES DINÁMICAS
-- ═══════════════════════════════════════════════════

-- 1. Tablas de Configuración
CREATE TABLE IF NOT EXISTS public.planes_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT UNIQUE NOT NULL, -- 'Freemium', 'Plus', 'Pro'
    precio_mensual NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.planes_niveles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID REFERENCES public.planes_config(id) ON DELETE CASCADE,
    nivel INTEGER NOT NULL, -- 1, 2, 3
    comision_porcentaje NUMERIC NOT NULL,
    threshold_pedidos INTEGER DEFAULT 0,
    threshold_facturacion NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(plan_id, nivel)
);

-- 2. Extensión de Locales y Métricas
ALTER TABLE public.locales ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.planes_config(id);

CREATE TABLE IF NOT EXISTS public.local_metricas_mensuales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT REFERENCES public.locales(id),
    mes INTEGER NOT NULL,
    anio INTEGER NOT NULL,
    total_pedidos INTEGER DEFAULT 0,
    total_facturacion NUMERIC DEFAULT 0,
    nivel_actual INTEGER DEFAULT 1,
    last_updated TIMESTAMPTZ DEFAULT now(),
    UNIQUE(local_id, mes, anio)
);

-- 3. Registro de Comisiones por Pedido
ALTER TABLE public.pedidos_locales ADD COLUMN IF NOT EXISTS comision_porcentaje_aplicada NUMERIC;
ALTER TABLE public.pedidos_locales ADD COLUMN IF NOT EXISTS comision_monto_calculado NUMERIC;

-- Insertar Datos Iniciales
INSERT INTO public.planes_config (nombre, precio_mensual) VALUES 
('Freemium', 0),
('Plus', 10000),
('Pro', 20000)
ON CONFLICT (nombre) DO UPDATE SET precio_mensual = EXCLUDED.precio_mensual;

-- Limpiar niveles previos para evitar duplicados o niveles extra (ej. Nivel 3 residual)
DELETE FROM public.planes_niveles;

-- Freemium levels
INSERT INTO public.planes_niveles (plan_id, nivel, comision_porcentaje)
SELECT id, 1, 12 FROM public.planes_config WHERE nombre = 'Freemium';

-- Plus levels (10% -> 8%)
INSERT INTO public.planes_niveles (plan_id, nivel, comision_porcentaje, threshold_pedidos, threshold_facturacion)
SELECT id, 1, 10, 0, 0 FROM public.planes_config WHERE nombre = 'Plus' UNION ALL
SELECT id, 2, 8, 15, 150000 FROM public.planes_config WHERE nombre = 'Plus';

-- Pro levels (8% -> 5%)
INSERT INTO public.planes_niveles (plan_id, nivel, comision_porcentaje, threshold_pedidos, threshold_facturacion)
SELECT id, 1, 8, 0, 0 FROM public.planes_config WHERE nombre = 'Pro' UNION ALL
SELECT id, 2, 5, 25, 300000 FROM public.planes_config WHERE nombre = 'Pro';

-- ─── FUNCIONES BACKEND ───

-- 1. Obtener comisión actual para un local
CREATE OR REPLACE FUNCTION public.get_current_commission_info(p_local_id TEXT)
RETURNS JSON AS $$
DECLARE
    v_plan_id UUID;
    v_plan_nombre TEXT;
    v_mes INTEGER := extract(month from now());
    v_anio INTEGER := extract(year from now());
    v_pedidos INTEGER;
    v_facturacion NUMERIC;
    v_nivel RECORD;
    v_proximo_nivel RECORD;
BEGIN
    -- Get plan
    SELECT plan_id INTO v_plan_id FROM public.locales WHERE id = p_local_id;
    
    -- Default to Freemium if no plan
    IF v_plan_id IS NULL THEN
        SELECT id, nombre INTO v_plan_id, v_plan_nombre FROM public.planes_config WHERE nombre = 'Freemium' LIMIT 1;
    ELSE
        SELECT nombre INTO v_plan_nombre FROM public.planes_config WHERE id = v_plan_id;
    END IF;

    -- Get metrics
    SELECT total_pedidos, total_facturacion INTO v_pedidos, v_facturacion
    FROM public.local_metricas_mensuales
    WHERE local_id = p_local_id AND mes = v_mes AND anio = v_anio;

    IF v_pedidos IS NULL THEN 
        v_pedidos := 0; v_facturacion := 0; 
    END IF;

    -- Find current level
    SELECT * INTO v_nivel
    FROM public.planes_niveles
    WHERE plan_id = v_plan_id
      AND (v_pedidos >= threshold_pedidos OR v_facturacion >= threshold_facturacion)
    ORDER BY nivel DESC
    LIMIT 1;

    -- Find next level
    SELECT * INTO v_proximo_nivel
    FROM public.planes_niveles
    WHERE plan_id = v_plan_id AND nivel > v_nivel.nivel
    ORDER BY nivel ASC
    LIMIT 1;

    RETURN json_build_object(
        'plan_nombre', v_plan_nombre,
        'nivel_actual', v_nivel.nivel,
        'comision_actual', v_nivel.comision_porcentaje,
        'metricas_mes', json_build_object(
            'pedidos', v_pedidos,
            'facturacion', v_facturacion,
            'mes', v_mes,
            'anio', v_anio
        ),
        'proximo_nivel', CASE WHEN v_proximo_nivel.id IS NOT NULL THEN json_build_object(
            'nivel', v_proximo_nivel.nivel,
            'comision', v_proximo_nivel.comision_porcentaje,
            'falta_pedidos', GREATEST(0, v_proximo_nivel.threshold_pedidos - v_pedidos),
            'falta_facturacion', GREATEST(0, v_proximo_nivel.threshold_facturacion - v_facturacion)
        ) ELSE NULL END
    );
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger para aplicar comisión al crear pedido_local
CREATE OR REPLACE FUNCTION public.fn_apply_commission_on_order()
RETURNS TRIGGER AS $$
DECLARE
    v_info JSON;
    v_comision_pct NUMERIC;
BEGIN
    -- Obtener la info de comisión actual
    v_info := public.get_current_commission_info(NEW.local_id);
    v_comision_pct := (v_info->>'comision_actual')::NUMERIC;
    
    NEW.comision_porcentaje_aplicada := v_comision_pct;
    NEW.comision_monto_calculado := (NEW.total * v_comision_pct / 100.0);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apply_commission ON public.pedidos_locales;
CREATE TRIGGER trg_apply_commission
BEFORE INSERT ON public.pedidos_locales
FOR EACH ROW
EXECUTE FUNCTION public.fn_apply_commission_on_order();

-- 3. Trigger para actualizar métricas post-venta
CREATE OR REPLACE FUNCTION public.fn_sync_local_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_mes INTEGER := extract(month from now());
    v_anio INTEGER := extract(year from now());
BEGIN
    -- Se actualizan métricas cuando el pedido es 'Aceptado'
    IF (NEW.estado = 'Aceptado' AND (OLD.estado IS NULL OR OLD.estado = 'Pendiente')) THEN
        INSERT INTO public.local_metricas_mensuales (local_id, mes, anio, total_pedidos, total_facturacion)
        VALUES (NEW.local_id, v_mes, v_anio, 1, NEW.total)
        ON CONFLICT (local_id, mes, anio)
        DO UPDATE SET 
            total_pedidos = local_metricas_mensuales.total_pedidos + 1,
            total_facturacion = local_metricas_mensuales.total_facturacion + NEW.total,
            last_updated = now();
            
        -- Evaluar cambio de nivel (opcional, ya se hace dinámicamente en get_current_commission_info)
        -- Podríamos guardar el nivel_actual en la tabla de métricas para cachear
        UPDATE public.local_metricas_mensuales
        SET nivel_actual = (public.get_current_commission_info(NEW.local_id)->>'nivel_actual')::INTEGER
        WHERE local_id = NEW.local_id AND mes = v_mes AND anio = v_anio;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_metrics ON public.pedidos_locales;
CREATE TRIGGER trg_sync_metrics
AFTER UPDATE ON public.pedidos_locales
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_local_metrics();
