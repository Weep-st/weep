-- ═══════════════════════════════════════════════════
-- NUEVOS NIVELES DE COMISIÓN: PRUEBA Y PERSONALIZADO
-- ═══════════════════════════════════════════════════

-- 1. Añadir columnas a la tabla de locales
ALTER TABLE public.locales ADD COLUMN IF NOT EXISTS comision_personalizada_habilitada BOOLEAN DEFAULT false;
ALTER TABLE public.locales ADD COLUMN IF NOT EXISTS comision_personalizada_valor NUMERIC;

-- 2. Actualizar RPC get_current_commission_info con la nueva jerarquía y lógica de conteo
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
    v_created_at TIMESTAMPTZ;
    v_trial_end TIMESTAMPTZ;
    v_count_from TIMESTAMPTZ;
    v_custom_enabled BOOLEAN;
    v_custom_value NUMERIC;
    v_global_start TIMESTAMPTZ := '2026-05-01 00:00:00-03'; -- Fecha de inicio para locales actuales
BEGIN
    -- A. Obtener plan de visibilidad y configuraciones
    SELECT 
        COALESCE(pc.nombre, 'Visible'),
        l.created_at,
        l.created_at + interval '14 days',
        COALESCE(l.comision_personalizada_habilitada, false),
        l.comision_personalizada_valor
    INTO v_plan_nombre, v_created_at, v_trial_end, v_custom_enabled, v_custom_value
    FROM public.locales l
    LEFT JOIN public.planes_config pc ON l.plan_id = pc.id
    WHERE l.id = p_local_id;

    -- B. Determinar fecha de inicio de conteo (v_count_from)
    -- Contamos desde el registro, pero reseteamos cada mes (o el 1 de mayo para los locales actuales)
    -- Esto permite que lo vendido en el periodo de prueba cuente para el nivel dinámico posterior.
    v_count_from := GREATEST(v_global_start, date_trunc('month', now()), v_created_at);

    -- C. Métricas actuales (Contadas desde v_count_from)
    SELECT count(*), COALESCE(sum(pl.total), 0) INTO v_pedidos, v_facturacion
    FROM public.pedidos_locales pl
    JOIN public.pedidos_general pg ON pl.pedido_id = pg.id
    WHERE pl.local_id = p_local_id 
      AND pg.estado = 'Entregado'
      AND pg.created_at >= v_count_from;

    -- D. Determinar el Nivel Actual siguiendo la jerarquía
    IF v_custom_enabled THEN
        -- NIVEL PERSONALIZADO (Prioridad Máxima)
        v_nivel_nivel := 99;
        v_nivel_nombre := 'Personalizado';
        v_nivel_comision := v_custom_value;
        v_nivel_threshold := 0;
    ELSIF now() < v_trial_end THEN
        -- NIVEL PRUEBA (Para locales nuevos en sus primeras 2 semanas)
        v_nivel_nivel := 0;
        v_nivel_nombre := 'Prueba (Nuevos Locales)';
        v_nivel_comision := 8;
        v_nivel_threshold := 0;
    ELSE
        -- LÓGICA DINÁMICA ESTÁNDAR (Basada en lo acumulado en el mes o desde el registro)
        SELECT nivel, nombre, comision_porcentaje, threshold_pedidos
        INTO v_nivel_nivel, v_nivel_nombre, v_nivel_comision, v_nivel_threshold
        FROM public.comisiones_niveles
        WHERE v_pedidos >= threshold_pedidos
        ORDER BY threshold_pedidos DESC
        LIMIT 1;

        -- Fallback si la tabla está vacía o no alcanza ningún nivel
        IF v_nivel_nivel IS NULL THEN
            v_nivel_nivel := 1; v_nivel_nombre := 'Despegue'; v_nivel_comision := 15; v_nivel_threshold := 0;
        END IF;
    END IF;

    -- E. Encontrar el Próximo Nivel (Basado en la escala estándar)
    SELECT nivel, nombre, comision_porcentaje, threshold_pedidos
    INTO v_next_nivel, v_next_nombre, v_next_comision, v_next_threshold
    FROM public.comisiones_niveles
    WHERE threshold_pedidos > v_pedidos
    ORDER BY threshold_pedidos ASC
    LIMIT 1;

    RETURN json_build_object(
        'plan_nombre', COALESCE(v_plan_nombre, 'Visible'),
        'nivel_actual', v_nivel_nivel,
        'nombre_nivel_actual', v_nivel_nombre,
        'comision_actual', v_nivel_comision,
        'metricas_mes', json_build_object(
            'pedidos', v_pedidos,
            'facturacion', v_facturacion,
            'periodo', 'Mes actual / Desde registro'
        ),
        'proximo_nivel', CASE WHEN v_next_nivel IS NOT NULL THEN json_build_object(
            'nivel', v_next_nivel,
            'nombre', v_next_nombre,
            'comision', v_next_comision,
            'falta_pedidos', GREATEST(0, v_next_threshold - v_pedidos)
        ) ELSE NULL END,
        'es_personalizado', v_custom_enabled,
        'es_prueba', (now() < v_trial_end AND NOT v_custom_enabled)
    );
END;
$$ LANGUAGE plpgsql;
