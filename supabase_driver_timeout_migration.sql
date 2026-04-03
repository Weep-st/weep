-- ==============================================================================
-- WEEP - Automatización de Reasignación de Repartidores por Tiempo de Espera
-- Ejecutar en el SQL Editor de Supabase
-- ==============================================================================

-- 1. Asegurar que las extensiones requeridas estén habilitadas
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Añadir columna a pedidos_general para rastrear cuándo se notificó al repartidor
ALTER TABLE public.pedidos_general 
ADD COLUMN IF NOT EXISTS repartidor_notificado_en TIMESTAMPTZ;

-- 3. Crear Función y Trigger para establecer la fecha de notificación automáticamente
CREATE OR REPLACE FUNCTION public.fn_set_repartidor_notificado_en()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el repartidor_id ha cambiado, actualizamos el timestamp a AHORA.
  -- Esto ocurre tanto cuando se asigna por primera vez, como en futuras reasignaciones.
  IF (TG_OP = 'INSERT' AND NEW.repartidor_id IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND NEW.repartidor_id IS DISTINCT FROM OLD.repartidor_id) THEN
    NEW.repartidor_notificado_en := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_set_repartidor_notificado_en ON public.pedidos_general;
CREATE TRIGGER tr_set_repartidor_notificado_en
  BEFORE INSERT OR UPDATE OF repartidor_id
  ON public.pedidos_general
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_repartidor_notificado_en();

-- 4. Crear Función principal que ejecutará el CRON JOB cada 1 minuto
CREATE OR REPLACE FUNCTION public.fn_check_unaccepted_orders()
RETURNS void AS $$
DECLARE
  v_pedido record;
  v_nuevo_repartidor_id TEXT;
  v_nuevo_repartidor_onesignal TEXT;
  v_push_payload JSONB;
BEGIN
  -- Buscar pedidos pendientes que tengan un repartidor asignado, y donde 
  -- hayan pasado 5 minutos o más desde que se le notificó.
  FOR v_pedido IN 
    SELECT * FROM public.pedidos_general 
    WHERE estado = 'Pendiente' 
      AND repartidor_id IS NOT NULL 
      AND repartidor_notificado_en <= NOW() - INTERVAL '5 minutes'
  LOOP
    -- Intentar buscar otro repartidor activo y aceptado que NO sea el actual
    SELECT id, onesignal_id 
    INTO v_nuevo_repartidor_id, v_nuevo_repartidor_onesignal
    FROM public.repartidores
    WHERE estado = 'Activo' 
      AND admin_status = 'Aceptado'
      AND id != v_pedido.repartidor_id
    ORDER BY random()
    LIMIT 1;

    IF v_nuevo_repartidor_id IS NOT NULL THEN
      -- ENCONTRAMOS UN REEMPLAZO 
      RAISE NOTICE 'Reasignando pedido %: de % a %', v_pedido.id, v_pedido.repartidor_id, v_nuevo_repartidor_id;
      
      -- Liberar al repartidor viejo y ocupar al nuevo
      UPDATE public.repartidores SET estado = 'Activo' WHERE id = v_pedido.repartidor_id;
      UPDATE public.repartidores SET estado = 'Ocupado' WHERE id = v_nuevo_repartidor_id;
      
      -- Actualizar el pedido. 
      -- Esto DISPARARÁ el trigger `tr_set_repartidor_notificado_en` (que reseteará a NOW())
      -- Y también el trigger `tr_notify_repartidor_assignment` que le enviará el Push al NUEVO repartidor.
      UPDATE public.pedidos_general 
      SET repartidor_id = v_nuevo_repartidor_id 
      WHERE id = v_pedido.id;

    ELSE
      -- NO HAY MÁS REPARTIDORES DISPONIBLES 
      RAISE NOTICE 'No hay otro repartidor para pedido %. Renotificando al actual (%)', v_pedido.id, v_pedido.repartidor_id;
      
      -- Resetear el temporizador del repartidor actual para darle 5 min extra
      UPDATE public.pedidos_general 
      SET repartidor_notificado_en = NOW() 
      WHERE id = v_pedido.id;
      
      -- Buscar el OneSignal ID del repartidor actual para enviarle un recordatorio urgente
      SELECT onesignal_id INTO v_nuevo_repartidor_onesignal
      FROM public.repartidores 
      WHERE id = v_pedido.repartidor_id;

      IF (v_nuevo_repartidor_onesignal IS NOT NULL AND v_nuevo_repartidor_onesignal <> '') THEN
        v_push_payload := jsonb_build_object(
          'subscriptionIds', jsonb_build_array(v_nuevo_repartidor_onesignal),
          'title', '¡Recordatorio Urgente de Pedido!',
          'message', 'Por favor, acepta o rechaza el pedido #' || split_part(v_pedido.id, '-', 2) || ' para que el cliente no siga esperando.',
          'data', jsonb_build_object('pedidoId', v_pedido.id, 'type', 'new_order')
        );

        PERFORM net.http_post(
          url := 'https://jskxfescamdjesdrcnkf.supabase.co/functions/v1/send-push',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := v_push_payload
        );
      END IF;
    END IF;

  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Programar el CRON JOB (se ejecuta cada 1 minuto)
-- Asegurar de limpiar cualquier iteración vieja de este trabajo (ignorando si no existe)
DO $$
  BEGIN
    PERFORM cron.unschedule('check_unaccepted_orders_job');
  EXCEPTION WHEN OTHERS THEN
    -- El job no existía, ignoramos el error
  END;
$$;

SELECT cron.schedule(
  'check_unaccepted_orders_job',
  '* * * * *', -- Cada 1 minuto
  'SELECT public.fn_check_unaccepted_orders();'
);
