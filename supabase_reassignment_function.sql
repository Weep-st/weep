-- Función RPC para reasignar un pedido a otro repartidor disponible
-- Esta función asegura que el cambio sea atómico

CREATE OR REPLACE FUNCTION reasignar_pedido_repartidor(
  p_pedido_id TEXT,
  p_repartidor_actual_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_nuevo_repartidor_id TEXT;
  v_nuevo_repartidor_email TEXT;
  v_nuevo_repartidor_nombre TEXT;
  v_count INT;
BEGIN
  -- 1. Contar repartidores activos (excluyendo al actual)
  SELECT COUNT(*) INTO v_count 
  FROM repartidores 
  WHERE estado = 'Activo' 
    AND admin_status = 'Aceptado'
    AND id != p_repartidor_actual_id;

  -- 2. Si no hay nadie más disponible, abortar
  IF v_count = 0 THEN
    RAISE EXCEPTION 'No hay otros repartidores disponibles para este pedido.';
  END IF;

  -- 3. Seleccionar uno aleatorio
  SELECT id, email, nombre 
  INTO v_nuevo_repartidor_id, v_nuevo_repartidor_email, v_nuevo_repartidor_nombre
  FROM repartidores
  WHERE estado = 'Activo' 
    AND admin_status = 'Aceptado'
    AND id != p_repartidor_actual_id
  ORDER BY random()
  LIMIT 1;

  -- 4. Actualizar el pedido
  UPDATE pedidos_general 
  SET repartidor_id = v_nuevo_repartidor_id 
  WHERE id = p_pedido_id;

  -- 5. Actualizar estados de los repartidores
  UPDATE repartidores SET estado = 'Ocupado' WHERE id = v_nuevo_repartidor_id;
  UPDATE repartidores SET estado = 'Activo' WHERE id = p_repartidor_actual_id;

  -- 6. Devolver datos del nuevo repartidor para notificar por JS
  RETURN jsonb_build_object(
    'id', v_nuevo_repartidor_id,
    'email', v_nuevo_repartidor_email,
    'nombre', v_nuevo_repartidor_nombre,
    'success', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
