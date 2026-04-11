-- 1. check_active_repartidores
CREATE OR REPLACE FUNCTION check_active_repartidores()
RETURNS boolean AS $$
DECLARE
  active_count INT;
BEGIN
  SELECT COUNT(*) INTO active_count 
  FROM repartidores 
  WHERE estado = 'Activo'
  AND sesion_vence_en > (NOW() - INTERVAL '3 hours'); 
  RETURN active_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. marcar_pedido_pagado
CREATE OR REPLACE FUNCTION marcar_pedido_pagado(
  p_pedido_id TEXT,
  p_payment_id TEXT,
  p_preference_id TEXT,
  p_external_reference TEXT
)
RETURNS VOID AS $$
DECLARE
  v_tipo_entrega TEXT;
  v_repartidor_id TEXT;
BEGIN
  -- Obtener tipo de entrega
  SELECT tipo_entrega INTO v_tipo_entrega FROM pedidos_general WHERE id = p_pedido_id;

  -- Si es envío, buscamos repartidor ahora que está pagado
  -- Aceptamos 'envio' o 'Con Envío' por compatibilidad
  IF v_tipo_entrega ILIKE '%envio%' THEN
    SELECT id INTO v_repartidor_id 
    FROM repartidores 
    WHERE estado = 'Activo' 
    AND sesion_vence_en > (NOW() - INTERVAL '3 hours')
    ORDER BY random() 
    LIMIT 1;

    IF v_repartidor_id IS NOT NULL THEN
      UPDATE repartidores SET estado = 'Ocupado' WHERE id = v_repartidor_id;
      
      UPDATE pedidos_general 
      SET repartidor_id = v_repartidor_id
      WHERE id = p_pedido_id;
    END IF;
  END IF;

  UPDATE pedidos_general
  SET estado = 'Pendiente',
      payment_id = p_payment_id,
      preference_id = p_preference_id,
      external_reference = p_external_reference,
      fecha_pago = NOW()
  WHERE id = p_pedido_id;

  UPDATE pedidos_locales
  SET estado = 'Pendiente'
  WHERE pedido_id = p_pedido_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ¡NUEVO! Creado para satisfacer la estructura solicitada
ALTER TABLE pedidos_items ADD COLUMN IF NOT EXISTS local_id TEXT;
ALTER TABLE pedidos_general ADD COLUMN IF NOT EXISTS local_id TEXT;
ALTER TABLE pedidos_general ADD COLUMN IF NOT EXISTS num_confirmacion TEXT;
ALTER TABLE pedidos_general ALTER COLUMN num_confirmacion TYPE TEXT USING num_confirmacion::TEXT;
ALTER TABLE pedidos_general ADD COLUMN IF NOT EXISTS calificacion NUMERIC;
ALTER TABLE pedidos_general ADD COLUMN IF NOT EXISTS fecha TIMESTAMP;

-- 3. create_pedido_completo
CREATE OR REPLACE FUNCTION create_pedido_completo(
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
  p_cart JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_pedido_id TEXT;
  v_local_id TEXT;
  v_ped_local_id TEXT;
  v_repartidor_id TEXT;
  v_num_confirmacion TEXT;
BEGIN
  v_pedido_id := 'PED-' || (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT::TEXT;
  v_repartidor_id := NULL;
  
  -- Generar PIN de 4 digitos
  v_num_confirmacion := floor(random() * 9000 + 1000)::TEXT;
  
  -- Extraer el ID del local desde el primer item del carrito
  v_local_id := COALESCE(p_cart->0->>'local_id', 'unknown');

  -- Validar que cada local acepte el tipo de entrega seleccionado
  FOR v_local_id IN SELECT DISTINCT COALESCE(elem->>'local_id', 'unknown') FROM jsonb_array_elements(p_cart) AS elem
  LOOP
    DECLARE
      v_acepta_retiro BOOLEAN;
      v_acepta_envio BOOLEAN;
      v_nombre_local TEXT;
    BEGIN
      SELECT acepta_retiro, acepta_envio, nombre INTO v_acepta_retiro, v_acepta_envio, v_nombre_local
      FROM locales WHERE id = v_local_id;

      IF p_tipo_entrega = 'Retiro en local' AND (v_acepta_retiro IS FALSE) THEN
        RAISE EXCEPTION 'El local % no acepta retiro en local en este momento.', v_nombre_local;
      END IF;

      IF p_tipo_entrega = 'Con Envío' AND (v_acepta_envio IS FALSE) THEN
        RAISE EXCEPTION 'El local % no acepta envíos a domicilio en este momento.', v_nombre_local;
      END IF;
    END;
  END LOOP;

  IF p_tipo_entrega = 'Con Envío' THEN
    SELECT id INTO v_repartidor_id 
    FROM repartidores 
    WHERE estado = 'Activo' 
    AND sesion_vence_en > (NOW() - INTERVAL '3 hours')
    ORDER BY random() 
    LIMIT 1;

    IF v_repartidor_id IS NOT NULL THEN
      UPDATE repartidores SET estado = 'Ocupado' WHERE id = v_repartidor_id;
    ELSE
      -- Si es con envío y no hay repartidor, lanzamos error para evitar pedidos sin repartidor
      RAISE EXCEPTION 'No hay repartidores disponibles en este momento.';
    END IF;
  END IF;

  INSERT INTO pedidos_general (id, usuario_id, direccion, estado, total, metodo_pago, observaciones, tipo_entrega, email_cliente, nombre_cliente, lat, lng, repartidor_id, local_id, num_confirmacion, fecha, created_at)
  VALUES (v_pedido_id, p_user_id, p_direccion, p_estado, p_total, p_metodo_pago, p_observaciones, p_tipo_entrega, p_email_cliente, p_nombre_cliente, p_lat, p_lng, v_repartidor_id, v_local_id, v_num_confirmacion, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours');

  FOR v_local_id IN SELECT DISTINCT COALESCE(elem->>'local_id', 'unknown') FROM jsonb_array_elements(p_cart) AS elem
  LOOP
    v_ped_local_id := 'PL-' || v_pedido_id || '-' || v_local_id;

    -- Calcular subtotal para este local
    INSERT INTO pedidos_locales (id, pedido_id, local_id, estado, metodo_pago, total, created_at)
    SELECT 
      v_ped_local_id, 
      v_pedido_id, 
      v_local_id, 
      p_estado, 
      p_metodo_pago,
      SUM((elem->>'precio')::NUMERIC * COALESCE((elem->>'cantidad')::NUMERIC, (elem->>'qty')::NUMERIC, 1)),
      NOW() - INTERVAL '3 hours'
    FROM jsonb_array_elements(p_cart) AS elem
    WHERE COALESCE(elem->>'local_id', 'unknown') = v_local_id;

    INSERT INTO pedidos_items (pedido_id, item_id, nombre, precio_unitario, cantidad, subtotal, local_id)
    SELECT 
      v_pedido_id,
      elem->>'id',
      elem->>'nombre',
      (elem->>'precio')::NUMERIC,
      COALESCE((elem->>'cantidad')::INT, (elem->>'qty')::INT, 1),
      ((elem->>'precio')::NUMERIC * COALESCE((elem->>'cantidad')::INT, (elem->>'qty')::INT, 1)),
      v_local_id
    FROM jsonb_array_elements(p_cart) AS elem
    WHERE COALESCE(elem->>'local_id', 'unknown') = v_local_id;
  END LOOP;

  RETURN jsonb_build_object('pedido_id', v_pedido_id, 'repartidor_id', v_repartidor_id, 'num_confirmacion', v_num_confirmacion);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
