-- ==============================================================================
-- WEEP - Sistema de Recuperación de Demanda (Demand Recovery)
-- ==============================================================================

-- 1. Tabla para registrar usuarios que quieren ser avisados
CREATE TABLE IF NOT EXISTS public.clientes_esperando_repartidor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id TEXT, -- Puede ser null si es invitado
    onesignal_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    notificado BOOLEAN DEFAULT FALSE
);

-- 2. Función para notificar a los clientes cuando un repartidor se conecta
CREATE OR REPLACE FUNCTION public.fn_notify_waiting_customers()
RETURNS TRIGGER AS $$
DECLARE
    v_customer RECORD;
    v_push_payload JSONB;
BEGIN
    -- Solo si el repartidor pasa a estar 'Activo' (conectado)
    IF (NEW.estado = 'Activo' AND (OLD.estado IS DISTINCT FROM 'Activo')) THEN
        
        -- Buscar clientes que no han sido notificados en las últimas 4 horas
        FOR v_customer IN 
            SELECT * FROM public.clientes_esperando_repartidor 
            WHERE notificado = FALSE 
              AND created_at >= NOW() - INTERVAL '4 hours'
        LOOP
            -- Enviar Push
            v_push_payload := jsonb_build_object(
                'subscriptionIds', jsonb_build_array(v_customer.onesignal_id),
                'title', '¡Ya hay repartidores disponibles! 🛵',
                'message', 'Hola! Te avisamos que ya hay repartidores conectados en tu zona. ¡Ya puedes realizar tu pedido!',
                'url', 'https://weep.com.ar/pedir',
                'data', jsonb_build_object('type', 'repartidor_disponible')
            );

            PERFORM net.http_post(
                url := 'https://jskxfescamdjesdrcnkf.supabase.co/functions/v1/send-push',
                headers := jsonb_build_object('Content-Type', 'application/json'),
                body := v_push_payload
            );

            -- Marcar como notificado
            UPDATE public.clientes_esperando_repartidor 
            SET notificado = TRUE 
            WHERE id = v_customer.id;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger en la tabla repartidores
DROP TRIGGER IF EXISTS tr_notify_waiting_customers ON public.repartidores;
CREATE TRIGGER tr_notify_waiting_customers
    AFTER UPDATE OF estado
    ON public.repartidores
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_notify_waiting_customers();

-- 4. Limpieza automática de registros viejos (Cron)
-- Se encarga de borrar registros de más de 24 horas para mantener la tabla limpia.
SELECT cron.schedule(
  'cleanup-waiting-customers',
  '0 0 * * *', -- Cada medianoche
  'DELETE FROM public.clientes_esperando_repartidor WHERE created_at < NOW() - INTERVAL ''1 day'''
);
