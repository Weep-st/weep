-- ==============================================================================
-- WEEP - FIX FINAL DE INACTIVIDAD Y NOTIFICACIONES PUSH
-- ==============================================================================

-- 1. Corregir lógica de desconexión por inactividad (Parentización correcta)
CREATE OR REPLACE FUNCTION public.fn_check_inactive_drivers()
RETURNS void AS $$
BEGIN
  -- Marcamos como inactivos solo a los que están 'Activo' y superaron los tiempos
  -- El estado 'Ocupado' está PROTEGIDO y nunca se desconecta por inactividad.
  UPDATE public.repartidores
  SET estado = 'Inactivo'
  WHERE estado = 'Activo' 
    AND (
         (sesion_vence_en IS NOT NULL AND sesion_vence_en <= NOW())
      OR (ultima_interaccion_ui IS NOT NULL AND ultima_interaccion_ui <= NOW() - INTERVAL '30 minutes')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Asegurarnos que existe el trigger para notificaciones PUSH
-- Este trigger se dispara cada vez que un repartidor pasa a 'Inactivo'
CREATE OR REPLACE FUNCTION public.fn_notify_driver_offline()
RETURNS trigger AS $$
BEGIN
  -- Solo si cambió de Activo/Ocupado a Inactivo
  IF (OLD.estado IN ('Activo', 'Ocupado')) AND (NEW.estado = 'Inactivo') THEN
    -- Si tiene OneSignal ID, enviamos push (Vía Edge Function)
    IF NEW.onesignal_id IS NOT NULL THEN
      PERFORM
        net.http_post(
          url := 'https://dw10wkbac.supabase.co/functions/v1/send-push',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT current_setting('vault.service_role_key', true))
          ),
          body := jsonb_build_object(
            'userId', NEW.onesignal_id,
            'title', 'Sesión en Espera ⚠️',
            'message', 'Tu sesión ha expirado por inactividad. Vuelve a conectarte para recibir pedidos.',
            'data', jsonb_build_object('type', 'desconexion')
          )::text
        );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_driver_offline ON public.repartidores;
CREATE TRIGGER trg_notify_driver_offline
  AFTER UPDATE OF estado ON public.repartidores
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_driver_offline();
