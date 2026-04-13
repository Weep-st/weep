-- ═══════════════════════════════════════════════════
-- REFINAMIENTO DE NOTIFICACIONES PUSH (BROADCAST)
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_notify_repartidores_broadcast()
RETURNS TRIGGER AS $$
DECLARE
  v_onesignal_ids TEXT[];
  v_push_payload JSONB;
  v_headers JSONB;
  v_onesignal_id TEXT;
BEGIN
  -- CASO 1: PEDIDO BROADCAST (Nuevo pedido sin asignar)
  IF (TG_OP = 'INSERT' AND NEW.repartidor_id IS NULL AND NEW.estado = 'Pendiente') THEN
    
    -- Recolectar IDs de OneSignal de todos los repartidores ACEPTADOS
    -- No importa su estado de actividad (según requerimiento previo), solo que estén aceptados por admin
    SELECT array_agg(onesignal_id)
    INTO v_onesignal_ids
    FROM public.repartidores
    WHERE admin_status = 'Aceptado'
      AND onesignal_id IS NOT NULL
      AND onesignal_id <> '';

    -- Solo enviar si hay al menos un destinatario
    IF v_onesignal_ids IS NOT NULL AND array_length(v_onesignal_ids, 1) > 0 THEN
      v_push_payload := jsonb_build_object(
        'subscriptionIds', v_onesignal_ids,
        'title', '¡Nuevo Pedido Disponible! 🛵',
        'message', 'Viaje de $' || NEW.precio_envio || ' disponible. ¡El primero en aceptar se lo lleva!',
        'data', jsonb_build_object('pedidoId', NEW.id, 'type', 'new_order_broadcast')
      );

      v_headers := '{"Content-Type": "application/json"}'::jsonb;

      PERFORM net.http_post(
        url := 'https://jskxfescamdjesdrcnkf.supabase.co/functions/v1/send-push',
        headers := v_headers,
        body := v_push_payload
      );
      
      RAISE NOTICE 'Broadcast enviado a % repartidores para el pedido %', array_length(v_onesignal_ids, 1), NEW.id;
    END IF;

  -- CASO 2: ASIGNACIÓN DIRIGIDA (Cuando un repartidor RECLAMA el pedido o se le asigna manualmente)
  ELSIF (TG_OP = 'UPDATE' AND OLD.repartidor_id IS NULL AND NEW.repartidor_id IS NOT NULL) THEN
    
    -- Buscar el OneSignal ID del repartidor asignado
    SELECT onesignal_id INTO v_onesignal_id 
    FROM public.repartidores 
    WHERE id = NEW.repartidor_id;

    -- Si tiene ID, notificarle que el pedido ya es oficialmente suyo
    IF (v_onesignal_id IS NOT NULL AND v_onesignal_id <> '') THEN
      v_push_payload := jsonb_build_object(
        'subscriptionIds', jsonb_build_array(v_onesignal_id),
        'title', '¡Viaje Confirmado! ✅',
        'message', 'Has tomado el pedido #' || split_part(NEW.id, '-', 2) || '. Dirígete al local.',
        'data', jsonb_build_object('pedidoId', NEW.id, 'type', 'order_confirmed')
      );

      v_headers := '{"Content-Type": "application/json"}'::jsonb;

      PERFORM net.http_post(
        url := 'https://jskxfescamdjesdrcnkf.supabase.co/functions/v1/send-push',
        headers := v_headers,
        body := v_push_payload
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-vincular el trigger
DROP TRIGGER IF EXISTS tr_notify_repartidor_assignment ON public.pedidos_general;

CREATE TRIGGER tr_notify_repartidor_broadcast
  AFTER INSERT OR UPDATE OF repartidor_id
  ON public.pedidos_general
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_repartidores_broadcast();
