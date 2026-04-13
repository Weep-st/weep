-- ==============================================================================
-- WEEP - Sistema de Broadcast y Reclamo de Pedidos (Integración con Gamificación)
-- ==============================================================================

-- 1. MODIFICAR FUNCIÓN DE CREACIÓN (Para Broadcast)
CREATE OR REPLACE FUNCTION public.create_pedido_completo(
  p_user_id TEXT,
  p_direccion TEXT,
  p_metodo_pago TEXT,
  p_observaciones TEXT,
  p_tipo_entrega TEXT,
  p_total NUMERIC,
  p_estado TEXT,
  p_email_cliente TEXT,
  p_nombre_cliente TEXT,
  p_lat NUMERIC,
  p_lng NUMERIC,
  p_cart JSONB,
  p_precio_envio NUMERIC DEFAULT 0,
  p_id TEXT DEFAULT NULL,
  p_external_reference TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_pedido_id TEXT;
  v_num_confirmacion TEXT;
  v_local_id TEXT;
  v_repartidor_id TEXT;
  v_ped_local_id TEXT;
  v_val_incentivo NUMERIC := 0;
BEGIN
    -- Bloque principal para capturar errores
    BEGIN
        v_pedido_id := COALESCE(p_id, 'PED-' || (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT::TEXT);
        v_num_confirmacion := floor(random() * 9000 + 1000)::TEXT;
        v_local_id := COALESCE(p_cart->0->>'local_id', 'unknown');

        -- BROADCAST LOGIC: Ya no asignamos aquí. El repartidor_id queda NULL.
        v_repartidor_id := NULL;

        -- Capturar incentivo de demanda actual si existe
        SELECT valor_incentivo INTO v_val_incentivo 
        FROM public.system_activation_status WHERE id = 1;

        -- Registrar en pedidos_general
        INSERT INTO pedidos_general (
            id, usuario_id, direccion, estado, total, metodo_pago, observaciones, 
            tipo_entrega, email_cliente, nombre_cliente, lat, lng, repartidor_id, 
            local_id, num_confirmacion, fecha, created_at, precio_envio, 
            cobro_repartidor_procesado, external_reference
        ) VALUES (
            v_pedido_id, p_user_id, p_direccion, p_estado, p_total, p_metodo_pago, p_observaciones, 
            p_tipo_entrega, p_email_cliente, p_nombre_cliente, p_lat, p_lng, v_repartidor_id, 
            v_local_id, v_num_confirmacion, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours', 
            p_precio_envio + COALESCE(v_val_incentivo, 0), -- Sumamos incentivo al precio de envío
            (LOWER(p_metodo_pago) = 'efectivo'), p_external_reference
        );

        -- Procesar items y locales (mismo que antes)
        FOR v_local_id IN SELECT DISTINCT COALESCE(elem->>'local_id', 'unknown') FROM jsonb_array_elements(p_cart) AS elem
        LOOP
            v_ped_local_id := 'PL-' || v_pedido_id || '-' || v_local_id;
            INSERT INTO pedidos_locales (id, pedido_id, local_id, estado, metodo_pago, total, created_at)
            SELECT 
                v_ped_local_id, v_pedido_id, v_local_id, p_estado, p_metodo_pago,
                SUM((el->>'precio')::NUMERIC * COALESCE((el->>'cantidad')::INT, (el->>'qty')::INT, 1)),
                NOW() - INTERVAL '3 hours'
            FROM jsonb_array_elements(p_cart) AS el
            WHERE COALESCE(el->>'local_id', 'unknown') = v_local_id;

            INSERT INTO pedidos_items (pedido_id, item_id, nombre, precio_unitario, cantidad, subtotal, local_id)
            SELECT 
                v_pedido_id, el->>'id', el->>'nombre', (el->>'precio')::NUMERIC, 
                COALESCE((el->>'cantidad')::INT, (el->>'qty')::INT, 1),
                ((el->>'precio')::NUMERIC * COALESCE((el->>'cantidad')::INT, (el->>'qty')::INT, 1)), v_local_id
            FROM jsonb_array_elements(p_cart) AS el
            WHERE COALESCE(el->>'local_id', 'unknown') = v_local_id;
        END LOOP;

    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Error crítico en creación de pedido broadcast: %', SQLERRM;
    END;

    RETURN jsonb_build_object(
        'pedido_id', v_pedido_id, 
        'repartidor_id', v_repartidor_id, 
        'num_confirmacion', v_num_confirmacion
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. FUNCIÓN DE RECLAMO (CLAIM) CON GAMIFICACIÓN
CREATE OR REPLACE FUNCTION public.claim_pedido_broadcast(
  p_pedido_id TEXT,
  p_repartidor_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_updated INT;
  v_puntos_base INT := 0;
  v_created_at TIMESTAMPTZ;
  v_segundos INT;
  v_cycle_id TEXT;
BEGIN
    -- 1. Intentar actualizar de forma atómica
    UPDATE public.pedidos_general 
    SET repartidor_id = p_repartidor_id, 
        estado = 'Confirmado'
    WHERE id = p_pedido_id 
      AND repartidor_id IS NULL 
      AND estado = 'Pendiente';

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'El pedido ya fue tomado por otro repartidor o no está disponible.');
    END IF;

    -- 2. Lógica de Gamificación (Opcional, envuelta para no romper)
    BEGIN
        SELECT created_at INTO v_created_at FROM public.pedidos_general WHERE id = p_pedido_id;
        v_segundos := EXTRACT(EPOCH FROM (NOW() - v_created_at));

        -- Bonus de Rapidez: +75 puntos si lo toma en menos de 45 seg
        IF v_segundos <= 45 THEN
          v_puntos_base := v_puntos_base + 75;
          INSERT INTO public.driver_points_log (driver_id, puntos, motivo)
          VALUES (p_repartidor_id, 75, 'BROADCAST_FLASH');
        END IF;

        -- Verificar si hay un ciclo de incentivo activo
        SELECT current_cycle_id INTO v_cycle_id FROM public.system_activation_status WHERE id = 1;
        IF v_cycle_id IS NOT NULL THEN
          v_puntos_base := v_puntos_base + 100;
          INSERT INTO public.driver_points_log (driver_id, cycle_id, puntos, motivo)
          VALUES (p_repartidor_id, v_cycle_id, 100, 'BROADCAST_INCENTIVE');
        END IF;

        -- Actualizar estadísticas generales
        IF v_puntos_base > 0 THEN
          UPDATE public.driver_gamification_stats 
          SET puntos_totales = puntos_totales + v_puntos_base,
              puntos_canjeables = puntos_canjeables + v_puntos_base
          WHERE driver_id = p_repartidor_id;
        END IF;

    EXCEPTION WHEN OTHERS THEN
        -- Ignorar errores de puntos para asegurar que la asignación sea lo primero
        RAISE NOTICE 'Error en gamificación broadcast: %', SQLERRM;
    END;

    -- 3. Marcar repartidor como Ocupado
    UPDATE public.repartidores SET estado = 'Ocupado' WHERE id = p_repartidor_id;

    RETURN jsonb_build_object('success', true, 'mensaje', 'Pedido asignado con éxito');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
