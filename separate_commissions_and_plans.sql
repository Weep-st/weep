-- ═══════════════════════════════════════════════════
-- SEPARATE COMMISSIONS FROM VISIBILITY PLANS
-- ═══════════════════════════════════════════════════

-- 1. Create global commission tiers table
CREATE TABLE IF NOT EXISTS public.comisiones_niveles (
    nivel INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL,
    comision_porcentaje NUMERIC NOT NULL,
    threshold_pedidos INTEGER NOT NULL
);

-- 2. Populate global commission tiers
INSERT INTO public.comisiones_niveles (nivel, nombre, comision_porcentaje, threshold_pedidos) VALUES
(1, 'Despegue', 15, 0),
(2, 'Crecimiento', 12, 15),
(3, 'Experto en ventas', 10, 30),
(4, 'Nivel pro', 8, 50)
ON CONFLICT (nivel) DO UPDATE SET 
    nombre = EXCLUDED.nombre,
    comision_porcentaje = EXCLUDED.comision_porcentaje,
    threshold_pedidos = EXCLUDED.threshold_pedidos;

-- 3. Update get_current_commission_info to use global tiers
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
    -- Get visibility plan
    SELECT plan_id INTO v_plan_id FROM public.locales WHERE id = p_local_id;
    
    -- Default to 'Visible' if no plan
    IF v_plan_id IS NULL THEN
        SELECT id, nombre INTO v_plan_id, v_plan_nombre FROM public.planes_config WHERE nombre = 'Visible' LIMIT 1;
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

    -- Find current commission level from global table
    SELECT * INTO v_nivel
    FROM public.comisiones_niveles
    WHERE v_pedidos >= threshold_pedidos
    ORDER BY nivel DESC
    LIMIT 1;

    -- Find next commission level
    SELECT * INTO v_proximo_nivel
    FROM public.comisiones_niveles
    WHERE nivel > v_nivel.nivel
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
        'proximo_nivel', CASE WHEN v_proximo_nivel.nivel IS NOT NULL THEN json_build_object(
            'nivel', v_proximo_nivel.nivel,
            'nombre', v_proximo_nivel.nombre,
            'comision', v_proximo_nivel.comision_porcentaje,
            'falta_pedidos', GREATEST(0, v_proximo_nivel.threshold_pedidos - v_pedidos)
        ) ELSE NULL END
    );
END;
$$ LANGUAGE plpgsql;

-- 4. Clean up old planes_niveles (optional, but good to keep it clean if they are no longer used for logic)
-- DELETE FROM public.planes_niveles;
