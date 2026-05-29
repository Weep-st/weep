-- ═══════════════════════════════════════════════════
-- CORRECCIÓN DE REDIRECCIÓN EN NOTIFICACIONES DE LOCALES
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_notify_local_on_new_order()
RETURNS TRIGGER AS $$
DECLARE
  v_onesignal_id TEXT;
  v_push_payload JSONB;
  v_headers JSONB;
BEGIN
  -- Solo proceder si el estado es 'Pendiente'
  IF (NEW.estado <> 'Pendiente') THEN
    RETURN NEW;
  END IF;

  -- Si es un UPDATE, solo proceder si el estado CAMBIÓ a 'Pendiente'
  IF (TG_OP = 'UPDATE' AND OLD.estado = 'Pendiente') THEN
    RETURN NEW;
  END IF;

  -- Buscar el OneSignal ID del local
  SELECT onesignal_id INTO v_onesignal_id 
  FROM public.locales 
  WHERE id = NEW.local_id;

  -- Si el local tiene un OneSignal ID válido, enviar la notificación
  IF (v_onesignal_id IS NOT NULL AND v_onesignal_id <> '') THEN
    v_push_payload := jsonb_build_object(
      'subscriptionIds', jsonb_build_array(v_onesignal_id),
      'title', '¡Nuevo pedido recibido! 🍔',
      'message', 'Pedido #' || split_part(NEW.pedido_id, '-', 2) || ': Tienes un nuevo pedido pendiente de aceptación.',
      'url', 'https://weep.com.ar/locales',
      'data', jsonb_build_object('pedidoId', NEW.pedido_id, 'pedidoLocalId', NEW.id, 'type', 'new_order_local')
    );

    v_headers := '{"Content-Type": "application/json"}'::jsonb;

    PERFORM net.http_post(
      url := 'https://jskxfescamdjesdrcnkf.supabase.co/functions/v1/send-push',
      headers := v_headers,
      body := v_push_payload
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
