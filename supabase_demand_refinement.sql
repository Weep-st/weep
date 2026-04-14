-- ==============================================================================
-- WEEP - Refinamiento de Activación Inmediata y Gamificación
-- ==============================================================================

-- 1. Trigger para Evaluación Inmediata de Demanda
-- Evita esperar al CRON de 1 minuto cuando la demanda recién comienza.
CREATE OR REPLACE FUNCTION public.tr_evaluate_demand_on_signal()
RETURNS trigger AS $$
DECLARE
    v_state TEXT;
BEGIN
    SELECT current_state INTO v_state FROM public.system_activation_status WHERE id = 1;
    -- Solo evaluamos inmediatamente si el sistema está IDLE para despertar a los drivers.
    -- Si ya hay una alerta activa, el CRON manejará el escalado por tiempo (4 min entre niveles).
    IF v_state = 'IDLE' THEN
        PERFORM public.fn_evaluate_demand_and_alert();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_demand_signal_activation ON public.demand_signals;
CREATE TRIGGER tr_demand_signal_activation
AFTER INSERT ON public.demand_signals
FOR EACH ROW
EXECUTE FUNCTION public.tr_evaluate_demand_on_signal();

-- 2. Corregir Payload de Push en Activación por Demanda
-- Cambiamos 'included_segments' por 'subscriptionIds' directos para mayor confiabilidad.
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
    v_onesignal_ids TEXT[];
BEGIN
    SELECT current_state, valor_incentivo, last_alert_sent_at 
    INTO v_current_state, v_incentivo, v_last_alert
    FROM public.system_activation_status WHERE id = 1;

    v_score := public.fn_get_current_demand_score();
    
    SELECT COUNT(*) INTO v_repartidores_activos 
    FROM public.repartidores 
    WHERE estado = 'Activo' AND (sesion_vence_en IS NULL OR sesion_vence_en > NOW());

    -- Si hay alguien online, el sistema debe estar en IDLE
    IF v_repartidores_activos > 0 AND v_current_state != 'IDLE' THEN
        UPDATE public.system_activation_status 
        SET current_state = 'IDLE', valor_incentivo = 0, current_score = v_score, updated_at = NOW(), current_cycle_id = NULL
        WHERE id = 1;
        RETURN;
    END IF;

    -- LÓGICA DE ESCALADO
    IF v_current_state = 'IDLE' AND v_score >= 40 THEN
        v_current_state := 'ALERTED_L1';
        v_incentivo := 300;
        v_push_message := '¡Incentivo Activo! 🚀 Ganás $' || (v_base_envio + v_incentivo) || ' por envío. ¡Conéctate ahora!';
        UPDATE public.system_activation_status SET l1_started_at = NOW(), current_cycle_id = 'CYC-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS') WHERE id = 1;
    ELSIF v_current_state = 'ALERTED_L1' AND v_last_alert <= NOW() - INTERVAL '4 minutes' AND v_score >= 40 THEN
        v_current_state := 'ALERTED_L2';
        v_incentivo := 500;
        v_push_message := '¡Sube la apuesta! 🔥 Pagamos $' || (v_base_envio + v_incentivo) || ' el envío. ¡Aprovechá la demanda!';
    ELSIF v_current_state = 'ALERTED_L2' AND v_last_alert <= NOW() - INTERVAL '4 minutes' AND v_score >= 60 THEN
        v_current_state := 'ALERTED_L3';
        v_incentivo := 800;
        v_push_message := '¡URGENTE: $' || (v_base_envio + v_incentivo) || ' por envío! 💎 ¡Última oportunidad del ciclo!';
    ELSIF v_score < 15 AND v_current_state != 'IDLE' THEN
        v_current_state := 'IDLE';
        v_incentivo := 0;
    END IF;

    -- Aplicar cambios y enviar Push
    IF v_current_state != 'IDLE' AND (v_current_state != (SELECT (current_state) FROM public.system_activation_status WHERE id = 1) OR v_last_alert <= NOW() - INTERVAL '10 minutes') THEN
        UPDATE public.system_activation_status 
        SET current_state = v_current_state, valor_incentivo = v_incentivo, current_score = v_score, last_alert_sent_at = NOW(), updated_at = NOW()
        WHERE id = 1;

        IF v_push_message IS NOT NULL THEN
            -- Recolectar IDs de todos los repartidores inactivos
            SELECT array_agg(onesignal_id) INTO v_onesignal_ids
            FROM public.repartidores
            WHERE admin_status = 'Aceptado'
              AND estado != 'Activo'
              AND onesignal_id IS NOT NULL AND onesignal_id <> '';

            IF v_onesignal_ids IS NOT NULL AND array_length(v_onesignal_ids, 1) > 0 THEN
                v_push_payload := jsonb_build_object(
                    'subscriptionIds', v_onesignal_ids,
                    'title', '¡Demanda Detectada! ⚡',
                    'message', v_push_message,
                    'data', jsonb_build_object('type', 'demand_activation', 'bonus', v_incentivo)
                );
                PERFORM net.http_post(
                    url := 'https://jskxfescamdjesdrcnkf.supabase.co/functions/v1/send-push',
                    headers := '{"Content-Type": "application/json"}'::jsonb,
                    body := v_push_payload
                );
            END IF;
        END IF;
    ELSE
        UPDATE public.system_activation_status SET current_score = v_score, updated_at = NOW() WHERE id = 1;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
