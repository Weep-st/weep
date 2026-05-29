-- ═══════════════════════════════════════════════════
-- ATOMIC RESET: COMMISSION TIERS & ROBUST RPC (V2)
-- ═══════════════════════════════════════════════════

-- 1. Ensure table exists with correct schema
CREATE TABLE IF NOT EXISTS public.comisiones_niveles (
    nivel INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL,
    comision_porcentaje NUMERIC NOT NULL,
    threshold_pedidos INTEGER NOT NULL
);

-- 2. Wipe and Re-populate to ensure fresh start
TRUNCATE TABLE public.comisiones_niveles;
INSERT INTO public.comisiones_niveles (nivel, nombre, comision_porcentaje, threshold_pedidos) VALUES
(1, 'Despegue', 15, 0),
(2, 'Crecimiento', 12, 15),
(3, 'Experto en ventas', 10, 30),
(4, 'Nivel pro', 8, 50);

-- 3. Robust RPC with Hardcoded Fallbacks & Pedidos General Source
CREATE OR REPLACE FUNCTION public.get_current_commission_info(p_local_id TEXT)
RETURNS JSON AS $$
DECLARE
    v_plan_nombre TEXT;
    v_pedidos INTEGER;
    v_facturacion NUMERIC;
    v_nivel_nivel INTEGER;
    v_nivel_nombre TEXT;
    v_nivel_comision NUMERIC;
    v_nivel_threshold INTEGER;
    v_next_nivel INTEGER;
    v_next_nombre TEXT;
    v_next_comision NUMERIC;
    v_next_threshold INTEGER;
BEGIN
    -- A. Get visibility plan
    SELECT COALESCE(pc.nombre, 'Visible') INTO v_plan_nombre
    FROM public.locales l
    LEFT JOIN public.planes_config pc ON l.plan_id = pc.id
    WHERE l.id = p_local_id;

    -- B. Count orders (30 days) from pedidos_general (Source of Truth for 'Entregado')
    SELECT count(*), COALESCE(sum(pl.total), 0) INTO v_pedidos, v_facturacion
    FROM public.pedidos_locales pl
    JOIN public.pedidos_general pg ON pl.pedido_id = pg.id
    WHERE pl.local_id = p_local_id 
      AND pg.estado = 'Entregado'
      AND pg.created_at >= (now() - interval '30 days');

    -- C. Find current level
    SELECT nivel, nombre, comision_porcentaje, threshold_pedidos
    INTO v_nivel_nivel, v_nivel_nombre, v_nivel_comision, v_nivel_threshold
    FROM public.comisiones_niveles
    WHERE v_pedidos >= threshold_pedidos
    ORDER BY threshold_pedidos DESC
    LIMIT 1;

    -- D. Fallback if table is empty (Hardcoded Logic)
    IF v_nivel_nivel IS NULL THEN
        IF v_pedidos >= 50 THEN
            v_nivel_nivel := 4; v_nivel_nombre := 'Nivel pro'; v_nivel_comision := 8; v_nivel_threshold := 50;
        ELSIF v_pedidos >= 30 THEN
            v_nivel_nivel := 3; v_nivel_nombre := 'Experto en ventas'; v_nivel_comision := 10; v_nivel_threshold := 30;
        ELSIF v_pedidos >= 15 THEN
            v_nivel_nivel := 2; v_nivel_nombre := 'Crecimiento'; v_nivel_comision := 12; v_nivel_threshold := 15;
        ELSE
            v_nivel_nivel := 1; v_nivel_nombre := 'Despegue'; v_nivel_comision := 15; v_nivel_threshold := 0;
        END IF;
    END IF;

    -- E. Find next level
    SELECT nivel, nombre, comision_porcentaje, threshold_pedidos
    INTO v_next_nivel, v_next_nombre, v_next_comision, v_next_threshold
    FROM public.comisiones_niveles
    WHERE threshold_pedidos > v_nivel_threshold
    ORDER BY threshold_pedidos ASC
    LIMIT 1;

    -- F. Next level fallback if table empty
    IF v_next_nivel IS NULL AND v_nivel_nivel < 4 THEN
        IF v_nivel_nivel = 1 THEN
            v_next_nivel := 2; v_next_nombre := 'Crecimiento'; v_next_comision := 12; v_next_threshold := 15;
        ELSIF v_nivel_nivel = 2 THEN
            v_next_nivel := 3; v_next_nombre := 'Experto en ventas'; v_next_comision := 10; v_next_threshold := 30;
        ELSIF v_nivel_nivel = 3 THEN
            v_next_nivel := 4; v_next_nombre := 'Nivel pro'; v_next_comision := 8; v_next_threshold := 50;
        END IF;
    END IF;

    RETURN json_build_object(
        'plan_nombre', COALESCE(v_plan_nombre, 'Visible'),
        'nivel_actual', v_nivel_nivel,
        'nombre_nivel_actual', v_nivel_nombre,
        'comision_actual', v_nivel_comision,
        'metricas_mes', json_build_object(
            'pedidos', v_pedidos,
            'facturacion', v_facturacion,
            'periodo', 'Últimos 30 días'
        ),
        'proximo_nivel', CASE WHEN v_next_nivel IS NOT NULL THEN json_build_object(
            'nivel', v_next_nivel,
            'nombre', v_next_nombre,
            'comision', v_next_comision,
            'falta_pedidos', GREATEST(0, v_next_threshold - v_pedidos)
        ) ELSE NULL END
    );
END;
$$ LANGUAGE plpgsql;
