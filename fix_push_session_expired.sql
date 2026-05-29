-- ==============================================================================
-- WEEP - CORRECCIÓN DE NOTIFICACIONES PUSH PARA SESIÓN EXPIRADA
-- ==============================================================================

-- 1. Corregir la función de notificación para usar subscriptionIds y la URL correcta
CREATE OR REPLACE FUNCTION public.fn_notify_driver_offline()
RETURNS trigger AS $$
DECLARE
  v_push_payload JSONB;
BEGIN
  -- Solo si pasó de Activo/Ocupado a Inactivo (desconexión)
  IF (OLD.estado IN ('Activo', 'Ocupado')) AND (NEW.estado = 'Inactivo') THEN
    -- Si tiene OneSignal ID, enviamos push
    IF NEW.onesignal_id IS NOT NULL AND NEW.onesignal_id <> '' THEN
      
      v_push_payload := jsonb_build_object(
        'subscriptionIds', jsonb_build_array(NEW.onesignal_id),
        'title', '¡Sesión Finalizada! 🛵',
        'message', '¿Vas a seguir trabajando? Tu sesión ha terminado. Conéctate de nuevo para seguir recibiendo pedidos.',
        'url', 'https://weep.com.ar/repartidores',
        'data', jsonb_build_object('type', 'session_expired')
      );

      PERFORM
        net.http_post(
          url := 'https://jskxfescamdjesdrcnkf.supabase.co/functions/v1/send-push',
          headers := jsonb_build_object(
            'Content-Type', 'application/json'
          ),
          body := v_push_payload
        );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- El trigger ya debería existir, pero lo recreamos por si acaso
DROP TRIGGER IF EXISTS trg_notify_driver_offline ON public.repartidores;
CREATE TRIGGER trg_notify_driver_offline
  AFTER UPDATE OF estado ON public.repartidores
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_driver_offline();
