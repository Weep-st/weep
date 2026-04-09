-- ═══════════════════════════════════════════════════
-- AGREGAR onesignal_id A LA TABLA DE LOCALES
-- ═══════════════════════════════════════════════════

ALTER TABLE locales ADD COLUMN IF NOT EXISTS onesignal_id TEXT;
CREATE INDEX IF NOT EXISTS idx_locales_onesignal_id ON locales(onesignal_id);

-- ─── Sincronización Automática de Notificaciones Push para Locales ───
-- Este script crea el trigger necesario para que Supabase envíe una 
-- notificación push al local apenas recibe un nuevo pedido.

-- 1. Función que procesa la notificación
CREATE OR REPLACE FUNCTION public.fn_notify_local_on_new_order()
RETURNS TRIGGER AS $$
DECLARE
  v_onesignal_id TEXT;
  v_push_payload JSONB;
  v_headers JSONB;
BEGIN
  -- Solo proceder si el estado es 'Pendiente'
  -- Esto cubre tanto el INSERT inicial (si es efectivo) como el UPDATE (si pagó online)
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
      'data', jsonb_build_object('pedidoId', NEW.pedido_id, 'pedidoLocalId', NEW.id, 'type', 'new_order_local')
    );

    v_headers := '{"Content-Type": "application/json"}'::jsonb;

    -- Realizar la llamada a la Edge Function de forma asíncrona
    PERFORM net.http_post(
      url := 'https://jskxfescamdjesdrcnkf.supabase.co/functions/v1/send-push',
      headers := v_headers,
      body := v_push_payload
    );
    
    RAISE NOTICE 'Notificación Push enviada al local % para el pedido %', NEW.local_id, NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear el Trigger
DROP TRIGGER IF EXISTS tr_notify_local_new_order ON public.pedidos_locales;

CREATE TRIGGER tr_notify_local_new_order
  AFTER INSERT OR UPDATE OF estado
  ON public.pedidos_locales
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_local_on_new_order();
