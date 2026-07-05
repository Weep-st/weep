-- ═══════════════════════════════════════════════════
-- MIGRACIÓN: CONTROL DE TIEMPOS, NOTIFICACIONES Y RECORDATORIOS
-- Ejecutar en Supabase (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════

-- 1. Agregar columnas a pedidos_general para control de tiempos
ALTER TABLE public.pedidos_general 
ADD COLUMN IF NOT EXISTS fecha_confirmado TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS fecha_listo TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS fecha_retirado TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS fecha_entregado TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tiempo_preparacion INTEGER, -- en segundos (Confirmado -> Retirado)
ADD COLUMN IF NOT EXISTS tiempo_retiro INTEGER, -- en segundos (Listo -> Retirado)
ADD COLUMN IF NOT EXISTS tiempo_entrega INTEGER, -- en segundos (Retirado -> Entregado)
ADD COLUMN IF NOT EXISTS recordatorio_listo_enviado BOOLEAN DEFAULT FALSE;

-- 2. Crear índices para optimizar consultas de rendimiento por repartidor
CREATE INDEX IF NOT EXISTS idx_pedidos_general_repartidor_tiempo_retiro 
ON public.pedidos_general(repartidor_id, tiempo_retiro) 
WHERE tiempo_retiro IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_general_estado_listo 
ON public.pedidos_general(estado) 
WHERE estado = 'Listo';

-- 3. Trigger para registrar timestamps y duraciones de los estados de forma atómica
CREATE OR REPLACE FUNCTION public.handle_order_timestamps_and_durations()
RETURNS TRIGGER AS $$
BEGIN
    -- Confirmado
    IF (TG_OP = 'INSERT' AND NEW.estado = 'Confirmado') OR 
       (TG_OP = 'UPDATE' AND NEW.estado = 'Confirmado' AND (OLD.estado IS DISTINCT FROM 'Confirmado')) THEN
        IF NEW.fecha_confirmado IS NULL THEN
            NEW.fecha_confirmado := NOW();
        END IF;
    END IF;

    -- Listo
    IF (TG_OP = 'INSERT' AND NEW.estado = 'Listo') OR 
       (TG_OP = 'UPDATE' AND NEW.estado = 'Listo' AND (OLD.estado IS DISTINCT FROM 'Listo')) THEN
        IF NEW.fecha_listo IS NULL THEN
            NEW.fecha_listo := NOW();
        END IF;
    END IF;

    -- Retirado
    IF (TG_OP = 'INSERT' AND NEW.estado = 'Retirado') OR 
       (TG_OP = 'UPDATE' AND NEW.estado = 'Retirado' AND (OLD.estado IS DISTINCT FROM 'Retirado')) THEN
        IF NEW.fecha_retirado IS NULL THEN
            NEW.fecha_retirado := NOW();
        END IF;
        
        -- Calcular tiempo_preparacion (Confirmado -> Retirado)
        IF NEW.fecha_confirmado IS NOT NULL AND NEW.tiempo_preparacion IS NULL THEN
            NEW.tiempo_preparacion := EXTRACT(EPOCH FROM (NEW.fecha_retirado - NEW.fecha_confirmado))::INTEGER;
        END IF;

        -- Calcular tiempo_retiro (Listo -> Retirado)
        IF NEW.fecha_listo IS NOT NULL AND NEW.tiempo_retiro IS NULL THEN
            NEW.tiempo_retiro := EXTRACT(EPOCH FROM (NEW.fecha_retirado - NEW.fecha_listo))::INTEGER;
        END IF;
    END IF;

    -- Entregado
    IF (TG_OP = 'INSERT' AND NEW.estado = 'Entregado') OR 
       (TG_OP = 'UPDATE' AND NEW.estado = 'Entregado' AND (OLD.estado IS DISTINCT FROM 'Entregado')) THEN
        IF NEW.fecha_entregado IS NULL THEN
            NEW.fecha_entregado := NOW();
        END IF;

        -- Calcular tiempo_entrega (Retirado -> Entregado)
        IF NEW.fecha_retirado IS NOT NULL AND NEW.tiempo_entrega IS NULL THEN
            NEW.tiempo_entrega := EXTRACT(EPOCH FROM (NEW.fecha_entregado - NEW.fecha_retirado))::INTEGER;
        END IF;
    END IF;

    -- Si se reasigna de repartidor en UPDATE, restablecer el estado del recordatorio listo
    IF (TG_OP = 'UPDATE' AND OLD.repartidor_id IS DISTINCT FROM NEW.repartidor_id) THEN
        NEW.recordatorio_listo_enviado := FALSE;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_order_timestamps_and_durations ON public.pedidos_general;
CREATE TRIGGER trg_order_timestamps_and_durations
BEFORE INSERT OR UPDATE OF estado ON public.pedidos_general
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_timestamps_and_durations();


-- 4. Trigger para enviar notificación Push al repartidor cuando el pedido pasa a 'Listo'
CREATE OR REPLACE FUNCTION public.fn_notify_repartidor_on_ready()
RETURNS TRIGGER AS $$
DECLARE
  v_onesignal_id TEXT;
  v_push_payload JSONB;
  v_headers JSONB;
BEGIN
  -- Solo si cambia a 'Listo' y tiene repartidor asignado
  IF (NEW.estado = 'Listo' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'Listo') AND NEW.repartidor_id IS NOT NULL) THEN
    -- Buscar el OneSignal ID del repartidor
    SELECT onesignal_id INTO v_onesignal_id 
    FROM public.repartidores 
    WHERE id = NEW.repartidor_id;

    -- Enviar por pg_net a la Edge Function de OneSignal
    IF (v_onesignal_id IS NOT NULL AND v_onesignal_id <> '') THEN
      v_push_payload := jsonb_build_object(
        'subscriptionIds', jsonb_build_array(v_onesignal_id),
        'title', '¡Pedido listo para retirar! 📦',
        'message', 'El pedido #' || COALESCE(split_part(NEW.id, '-', 2), NEW.id) || ' está listo en el local. Retíralo ya.',
        'data', jsonb_build_object('pedidoId', NEW.id, 'type', 'order_ready')
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

DROP TRIGGER IF EXISTS tr_notify_repartidor_ready ON public.pedidos_general;
CREATE TRIGGER tr_notify_repartidor_ready
AFTER INSERT OR UPDATE OF estado ON public.pedidos_general
FOR EACH ROW
EXECUTE FUNCTION public.fn_notify_repartidor_on_ready();


-- 5. Función de recordatorio automático a los 5 minutos y registro en pg_cron
CREATE OR REPLACE FUNCTION public.fn_check_ready_orders_reminders()
RETURNS void AS $$
DECLARE
  v_pedido record;
  v_onesignal_id TEXT;
  v_push_payload JSONB;
BEGIN
  -- Buscar pedidos listos con repartidor asignado, donde pasaron 5 min desde fecha_listo
  FOR v_pedido IN 
    SELECT * FROM public.pedidos_general 
    WHERE estado = 'Listo' 
      AND repartidor_id IS NOT NULL 
      AND fecha_listo <= NOW() - INTERVAL '5 minutes'
      AND COALESCE(recordatorio_listo_enviado, FALSE) = FALSE
  LOOP
    -- Buscar OneSignal ID
    SELECT onesignal_id INTO v_onesignal_id 
    FROM public.repartidores 
    WHERE id = v_pedido.repartidor_id;

    IF (v_onesignal_id IS NOT NULL AND v_onesignal_id <> '') THEN
      v_push_payload := jsonb_build_object(
        'subscriptionIds', jsonb_build_array(v_onesignal_id),
        'title', '⚠️ Recordatorio: Retiro Pendiente',
        'message', 'El pedido #' || COALESCE(split_part(v_pedido.id, '-', 2), v_pedido.id) || ' sigue listo esperando que lo retires.',
        'data', jsonb_build_object('pedidoId', v_pedido.id, 'type', 'order_ready_reminder')
      );

      PERFORM net.http_post(
        url := 'https://jskxfescamdjesdrcnkf.supabase.co/functions/v1/send-push',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := v_push_payload
      );
    END IF;

    -- Marcar recordatorio como enviado
    UPDATE public.pedidos_general 
    SET recordatorio_listo_enviado = TRUE 
    WHERE id = v_pedido.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Programar con pg_cron para correr cada 1 minuto
DO $$
  BEGIN
    PERFORM cron.unschedule('check_ready_orders_reminders_job');
  EXCEPTION WHEN OTHERS THEN
    -- Ignorar si no existe
  END;
$$;

SELECT cron.schedule(
  'check_ready_orders_reminders_job',
  '* * * * *', -- Cada 1 minuto
  'SELECT public.fn_check_ready_orders_reminders();'
);
