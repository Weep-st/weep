-- ==============================================================================
-- WEEP - Sistema de Activación Automática por Demanda (Surge Pricing & Alertas)
-- ==============================================================================

-- 1. Tabla de señales de demanda (eventos de intención)
CREATE TABLE IF NOT EXISTS public.demand_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id TEXT NOT NULL, -- Para evitar spam de un solo usuario
    event_type TEXT NOT NULL, -- 'page_view', 'local_view', 'item_view', 'add_to_cart'
    weight INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices para rapidez en el cálculo del score
CREATE INDEX IF NOT EXISTS idx_demand_signals_created_at ON public.demand_signals(created_at);

-- 2. Tabla de estado global del sistema (Singleton)
CREATE TABLE IF NOT EXISTS public.system_activation_status (
    id INT PRIMARY KEY DEFAULT 1,
    current_state TEXT DEFAULT 'IDLE', -- IDLE, ALERTED_L1, ALERTED_L2, ALERTED_L3, DRIVER_ONLINE
    current_score INT DEFAULT 0,
    valor_incentivo INT DEFAULT 0, -- 0, 300, 500, 800
    last_alert_sent_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT one_row CHECK (id = 1)
);

-- Inicializar estado si no existe
INSERT INTO public.system_activation_status (id, current_state, current_score, valor_incentivo)
VALUES (1, 'IDLE', 0, 0)
ON CONFLICT (id) DO NOTHING;

-- 3. Función para calcular el score actual (Últimos 10 minutos)
CREATE OR REPLACE FUNCTION public.fn_get_current_demand_score()
RETURNS INT AS $$
DECLARE
    v_score INT;
BEGIN
    -- Sumamos pesos pero limitamos el aporte de una sola sesión para evitar ruido/falsos positivos
    -- Cada sesión puede aportar máximo 50 puntos al score total.
    SELECT SUM(session_score) INTO v_score
    FROM (
        SELECT session_id, LEAST(SUM(weight), 50) as session_score
        FROM public.demand_signals
        WHERE created_at >= NOW() - INTERVAL '10 minutes'
        GROUP BY session_id
    ) as scores;

    RETURN COALESCE(v_score, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Función de Evaluación y Alerta (Motor de la Máquina de Estados)
CREATE OR REPLACE FUNCTION public.fn_evaluate_demand_and_alert()
RETURNS void AS $$
DECLARE
    v_score INT;
    v_current_state TEXT;
    v_incentivo INT;
    v_last_alert TIMESTAMPTZ;
    v_repartidores_activos INT;
    v_base_envio INT := 1800;
    v_push_message TEXT;
    v_push_payload JSONB;
BEGIN
    -- 1. Obtener estado actual
    SELECT current_state, valor_incentivo, last_alert_sent_at 
    INTO v_current_state, v_incentivo, v_last_alert
    FROM public.system_activation_status WHERE id = 1;

    -- 2. Calcular Score
    v_score := public.fn_get_current_demand_score();
    
    -- 3. Contar repartidores activos
    SELECT COUNT(*) INTO v_repartidores_activos 
    FROM public.repartidores 
    WHERE estado = 'Activo' AND sesion_vence_en > NOW();

    -- SI HAY REPARTIDORES ONLINE -> RESET A IDLE
    IF v_repartidores_activos > 0 THEN
        UPDATE public.system_activation_status 
        SET current_state = 'IDLE', 
            valor_incentivo = 0, 
            current_score = v_score,
            updated_at = NOW()
        WHERE id = 1;
        RETURN;
    END IF;

    -- LÓGICA DE TRANSICIÓN SI NO HAY REPARTIDORES
    
    -- Caso A: De IDLE a Alerta Nivel 1
    IF v_current_state = 'IDLE' AND v_score >= 40 THEN
        v_current_state := 'ALERTED_L1';
        v_incentivo := 300;
        v_push_message := '¡Ganás $' || (v_base_envio + v_incentivo) || ' por el próximo envío! 🚀 Hay demanda detectada, conéctate ahora.';
    
    -- Caso B: Escalado a Nivel 2 (Si pasaron 4 min en L1 y sigue habiendo demanda)
    ELSIF v_current_state = 'ALERTED_L1' AND v_last_alert <= NOW() - INTERVAL '4 minutes' AND v_score >= 40 THEN
        v_current_state := 'ALERTED_L2';
        v_incentivo := 500;
        v_push_message := '¡URGENTE: Pagamos $' || (v_base_envio + v_incentivo) || ' el envío! 🔥 Los clientes están esperando, aprovechá.';

    -- Caso C: Escalado a Nivel 3 (Demanda crítica o mucho tiempo esperando)
    ELSIF v_current_state = 'ALERTED_L2' AND v_last_alert <= NOW() - INTERVAL '4 minutes' AND v_score >= 60 THEN
        v_current_state := 'ALERTED_L3';
        v_incentivo := 800;
        v_push_message := '¡OFERTA LÍMITE: $' || (v_base_envio + v_incentivo) || ' por envío! 💎 Precio de urgencia activo. ¡Conéctate ya!';
    
    -- Caso D: Volver a IDLE si el score cae mucho (Anti-ruido)
    ELSIF v_score < 15 AND v_current_state != 'IDLE' THEN
        v_current_state := 'IDLE';
        v_incentivo := 0;
    END IF;

    -- Actualizar estado si hubo cambios o enviar recordatorio
    IF v_current_state != 'IDLE' AND (v_current_state != (SELECT current_state FROM public.system_activation_status WHERE id = 1) OR v_last_alert <= NOW() - INTERVAL '10 minutes') THEN
        
        UPDATE public.system_activation_status 
        SET current_state = v_current_state,
            valor_incentivo = v_incentivo,
            current_score = v_score,
            last_alert_sent_at = NOW(),
            updated_at = NOW()
        WHERE id = 1;

        -- ENVIAR PUSH VIA ONESIGNAL (Solo a repartidores inactivos)
        IF v_push_message IS NOT NULL THEN
            -- Construir listado de suscripciones
            v_push_payload := jsonb_build_object(
                'included_segments', jsonb_build_array('Inactive Drivers'), -- Segmento sugerido en OneSignal
                'title', '¡Oportunidad de Ganancia!',
                'message', v_push_message,
                'data', jsonb_build_object('type', 'demand_activation', 'bonus', v_incentivo)
            );

            -- Nota: Usamos la función existente de push si está configurada, 
            -- o hacemos el POST directo a OneSignal vía Net extension si está disponible.
            PERFORM net.http_post(
                url := 'https://jskxfescamdjesdrcnkf.supabase.co/functions/v1/send-push',
                headers := '{"Content-Type": "application/json"}'::jsonb,
                body := v_push_payload
            );
        END IF;
    ELSE
        -- Actualizar solo el score para monitoreo
        UPDATE public.system_activation_status SET current_score = v_score, updated_at = NOW() WHERE id = 1;
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger para Reset instantáneo cuando alguien se conecta
CREATE OR REPLACE FUNCTION public.fn_reset_demand_on_driver_active()
RETURNS trigger AS $$
BEGIN
    IF NEW.estado = 'Activo' AND OLD.estado != 'Activo' THEN
        UPDATE public.system_activation_status 
        SET current_state = 'IDLE', 
            valor_incentivo = 0, 
            updated_at = NOW()
        WHERE id = 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_reset_demand_on_driver_active ON public.repartidores;
CREATE TRIGGER tr_reset_demand_on_driver_active
AFTER UPDATE OF estado ON public.repartidores
FOR EACH ROW
WHEN (NEW.estado = 'Activo')
EXECUTE FUNCTION public.fn_reset_demand_on_driver_active();

-- 6. Limpieza de señales viejas (para no saturar)
CREATE OR REPLACE FUNCTION public.fn_clean_old_demand_signals()
RETURNS void AS $$
BEGIN
    DELETE FROM public.demand_signals WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- 7. Programar CRONs
SELECT cron.unschedule('evaluate_demand_job');
SELECT cron.schedule(
    'evaluate_demand_job',
    '* * * * *', -- Cada minuto
    'SELECT public.fn_evaluate_demand_and_alert();'
);

SELECT cron.unschedule('clean_demand_signals_job');
SELECT cron.schedule(
    'clean_demand_signals_job',
    '0 * * * *', -- Cada hora
    'SELECT public.fn_clean_old_demand_signals();'
);
