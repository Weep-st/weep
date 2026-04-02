-- ─── Sincronización Automática de Notificaciones Push ───
-- Este script crea el trigger necesario para que Supabase envíe una 
-- notificación push al repartidor apenas se le asigne un pedido.

-- 1. Habilitar la extensión pg_net para llamadas HTTP asíncronas
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Función que procesa la notificación
CREATE OR REPLACE FUNCTION public.fn_notify_repartidor_on_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_onesignal_id TEXT;
  v_push_payload JSONB;
BEGIN
  -- Solo proceder si el repartidor_id cambió o se estableció por primera vez
  IF (TG_OP = 'UPDATE' AND (OLD.repartidor_id IS NOT DISTINCT FROM NEW.repartidor_id)) THEN
    RETURN NEW;
  END IF;

  IF (NEW.repartidor_id IS NULL) THEN
    RETURN NEW;
  END IF;

  -- Buscar el OneSignal ID del repartidor
  SELECT onesignal_id INTO v_onesignal_id 
  FROM public.repartidores 
  WHERE id = NEW.repartidor_id;

  -- Si el repartidor tiene un OneSignal ID válido, enviar la notificación
  IF (v_onesignal_id IS NOT NULL AND v_onesignal_id <> '') THEN
    v_push_payload := jsonb_build_object(
      'subscriptionIds', jsonb_build_array(v_onesignal_id),
      'title', '¡Tienes un nuevo pedido! 🛵',
      'message', 'Pedido #' || split_part(NEW.id, '-', 3) || ': Aceptalo o rechazalo en el panel de repartidores',
      'data', jsonb_build_object('pedidoId', NEW.id, 'type', 'new_order')
    );

    -- Realizar la llamada a la Edge Function de forma asíncrona
    -- NOTA: Se asume que la Edge Function 'send-push' tiene desactivada la verificación de JWT 
    -- o permite llamadas anónimas.
    PERFORM net.http_post(
      url := 'https://jskxfescamdjesdrcnkf.supabase.co/functions/v1/send-push',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := v_push_payload
    );
    
    RAISE NOTICE 'Notificación Push enviada al repartidor % para el pedido %', NEW.repartidor_id, NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear el Trigger
DROP TRIGGER IF EXISTS tr_notify_repartidor_assignment ON public.pedidos_general;

CREATE TRIGGER tr_notify_repartidor_assignment
  AFTER INSERT OR UPDATE OF repartidor_id
  ON public.pedidos_general
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_repartidor_on_assignment();

