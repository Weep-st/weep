-- ═══════════════════════════════════════════════════
-- FINAL VERSION: create_pedido_completo SIN ASIGNACIÓN AL AZAR
-- Incluye soporte para cupones y elimina la auto-asignación de repartidor.
-- ═══════════════════════════════════════════════════

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
  p_external_reference TEXT DEFAULT NULL,
  p_cupon_id UUID DEFAULT NULL,
  p_descuento_cupon NUMERIC DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
  v_pedido_id TEXT;
  v_num_confirmacion TEXT;
  v_local_id TEXT;
  v_repartidor_id TEXT;
  v_ped_local_id TEXT;
BEGIN
    BEGIN
        -- 1. Definir ID y PIN
        v_pedido_id := COALESCE(p_id, 'PED-' || (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT::TEXT);
        v_num_confirmacion := floor(random() * 9000 + 1000)::TEXT;
        v_local_id := COALESCE(p_cart->0->>'local_id', 'unknown');

        -- 2. ASIGNACIÓN DE REPARTIDOR: Siempre NULL al inicio (Eliminado flujo al azar)
        v_repartidor_id := NULL;

        -- 3. Registrar en pedidos_general
        INSERT INTO pedidos_general (
            id, usuario_id, direccion, estado, total, metodo_pago, observaciones, 
            tipo_entrega, email_cliente, nombre_cliente, lat, lng, repartidor_id, 
            local_id, num_confirmacion, fecha, created_at, precio_envio, 
            cobro_repartidor_procesado, external_reference, cupon_id, descuento_cupon
        ) VALUES (
            v_pedido_id, p_user_id, p_direccion, p_estado, p_total, p_metodo_pago, p_observaciones, 
            p_tipo_entrega, p_email_cliente, p_nombre_cliente, p_lat, p_lng, v_repartidor_id, 
            v_local_id, v_num_confirmacion, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours', 
            p_precio_envio, (LOWER(p_metodo_pago) = 'efectivo'), p_external_reference,
            p_cupon_id, p_descuento_cupon
        );

        -- 4. Incrementar uso de cupón si existe
        IF p_cupon_id IS NOT NULL THEN
            UPDATE cupones SET usos_actuales = usos_actuales + 1 WHERE id = p_cupon_id;
        END IF;

        -- 5. Procesar items y pedidos locales
        FOR v_local_id IN SELECT DISTINCT COALESCE(elem->>'local_id', 'unknown') FROM jsonb_array_elements(p_cart) AS elem
        LOOP
            v_ped_local_id := 'PL-' || v_pedido_id || '-' || v_local_id;

            INSERT INTO pedidos_locales (id, pedido_id, local_id, estado, metodo_pago, total, created_at)
            SELECT 
                v_ped_local_id, 
                v_pedido_id, 
                v_local_id, 
                p_estado, 
                p_metodo_pago,
                SUM((el->>'precio')::NUMERIC * COALESCE((el->>'cantidad')::INT, (el->>'qty')::INT, 1)),
                NOW() - INTERVAL '3 hours'
            FROM jsonb_array_elements(p_cart) AS el
            WHERE COALESCE(el->>'local_id', 'unknown') = v_local_id;

            INSERT INTO pedidos_items (pedido_id, item_id, nombre, precio_unitario, cantidad, subtotal, local_id)
            SELECT 
                v_pedido_id, 
                el->>'id', 
                el->>'nombre', 
                (el->>'precio')::NUMERIC, 
                COALESCE((el->>'cantidad')::INT, (el->>'qty')::INT, 1),
                ((el->>'precio')::NUMERIC * COALESCE((el->>'cantidad')::INT, (el->>'qty')::INT, 1)),
                v_local_id
            FROM jsonb_array_elements(p_cart) AS el
            WHERE COALESCE(el->>'local_id', 'unknown') = v_local_id;
        END LOOP;

    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Error crítico en creación de pedido completo: %', SQLERRM;
    END;

    RETURN jsonb_build_object(
        'pedido_id', v_pedido_id, 
        'repartidor_id', v_repartidor_id, 
        'num_confirmacion', v_num_confirmacion
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
