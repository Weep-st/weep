-- ==============================================================================
-- WEEP - CRM CRON JOB (Versión 2: Serverless / Supabase nativo)
-- Evalúa las reglas de crm_automation_matrix cada 5 minutos
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.process_crm_chronological_triggers()
RETURNS void AS $$
DECLARE
    v_matrix JSONB;
    v_rule JSONB;
    v_trigger_type TEXT;
    v_trigger_config JSONB;
    v_rule_id TEXT;
    v_min INT;
    v_dias INT;
    v_estado_buscar TEXT;
    v_time_target TIMESTAMPTZ;
    v_time_window_start TIMESTAMPTZ;
    v_target_date TIMESTAMPTZ;
    v_start_date TIMESTAMPTZ;
    r_order RECORD;
    v_uid UUID;
    v_recent_orders BOOLEAN;
BEGIN
    SELECT matrix_data INTO v_matrix FROM public.crm_automation_matrix WHERE id = 'main_matrix';
    IF v_matrix IS NULL THEN
        SELECT crm_automation_matrix INTO v_matrix FROM public.configuracion WHERE id = 'global';
    END IF;
    IF v_matrix IS NULL THEN RETURN; END IF;

    FOR v_rule IN SELECT * FROM jsonb_array_elements(v_matrix) LOOP
        IF COALESCE((v_rule->>'enabled')::boolean, true) = false THEN CONTINUE; END IF;
        
        v_trigger_type := v_rule->>'trigger_type';
        v_trigger_config := v_rule->'trigger_config';
        v_rule_id := v_rule->>'id';
        
        IF v_trigger_config IS NULL THEN CONTINUE; END IF;

        IF v_trigger_type = 'minutos_post_entrega' THEN
            v_min := COALESCE((v_trigger_config->>'minutos')::int, 15);
            v_estado_buscar := 'Entregado';
            IF v_rule_id = 'esperando_repartidor' THEN v_estado_buscar := 'Pendiente de repartidor'; END IF;
            
            v_time_target := NOW() - (v_min || ' minutes')::interval;
            v_time_window_start := NOW() - ((v_min + 15) || ' minutes')::interval;
            
            FOR r_order IN 
                SELECT id, user_id FROM public.pedidos_general 
                WHERE estado = v_estado_buscar 
                  AND updated_at <= v_time_target 
                  AND updated_at >= v_time_window_start
            LOOP
                PERFORM public.dispatch_crm_rule(v_rule, r_order.user_id, jsonb_build_object('pedido_id', r_order.id));
            END LOOP;
            
        ELSIF v_trigger_type = 'dias_inactividad' THEN
            v_dias := COALESCE((v_trigger_config->>'dias')::int, 1);
            v_target_date := NOW() - (v_dias || ' days')::interval;
            v_start_date := NOW() - (v_dias || ' days 12 hours')::interval;
            
            FOR r_order IN 
                SELECT DISTINCT user_id FROM public.pedidos_general 
                WHERE created_at >= v_start_date AND created_at <= v_target_date
            LOOP
                v_uid := r_order.user_id;
                SELECT EXISTS (
                    SELECT 1 FROM public.pedidos_general WHERE user_id = v_uid AND created_at > v_target_date
                ) INTO v_recent_orders;
                
                IF NOT v_recent_orders THEN
                    PERFORM public.dispatch_crm_rule(v_rule, v_uid, '{}'::jsonb);
                END IF;
            END LOOP;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.dispatch_crm_rule(p_rule JSONB, p_user_id UUID, p_extra_metadata JSONB)
RETURNS void AS $$
DECLARE
    v_history_exists BOOLEAN;
    r_user RECORD;
    v_channels JSONB;
    v_ch TEXT;
    v_cfg JSONB;
    v_selected_channel TEXT := NULL;
    v_push_token TEXT;
    v_template_name TEXT;
    v_log_detail TEXT;
    v_success BOOLEAN := false;
    v_idx INT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.crm_history 
        WHERE usuario_id = p_user_id 
          AND metadata->>'rule_id' = p_rule->>'id'
          AND created_at >= NOW() - INTERVAL '24 hours'
    ) INTO v_history_exists;
    IF v_history_exists THEN RETURN; END IF;

    SELECT telefono, nombre, email, onesignal_player_id, onesignal_id 
    INTO r_user FROM public.usuarios WHERE id = p_user_id;
    IF r_user IS NULL THEN RETURN; END IF;
    
    v_push_token := COALESCE(r_user.onesignal_player_id, r_user.onesignal_id);
    v_channels := p_rule->'canales';
    
    FOR v_idx IN 0..jsonb_array_length(v_channels) - 1 LOOP
        v_ch := v_channels->>v_idx;
        IF v_ch = 'none' THEN CONTINUE; END IF;
        
        v_cfg := p_rule->'configs'->v_ch;
        IF v_cfg IS NULL OR NOT (v_cfg->>'enabled')::boolean THEN CONTINUE; END IF;
        
        IF v_ch = 'push' AND v_push_token IS NOT NULL THEN
            v_selected_channel := 'push';
            EXIT;
        ELSIF v_ch = 'whatsapp' AND r_user.telefono IS NOT NULL THEN
            v_selected_channel := 'whatsapp';
            EXIT;
        END IF;
    END LOOP;
    
    IF v_selected_channel IS NULL THEN RETURN; END IF;
    
    IF v_selected_channel = 'whatsapp' THEN
        v_template_name := COALESCE(p_rule->'configs'->'whatsapp'->>'template_name', 'retencion_1');
        
        PERFORM net.http_post(
            url := 'https://jskxfescamdjesdrcnkf.supabase.co/functions/v1/whatsapp-webhook',
            headers := '{"Content-Type": "application/json"}'::jsonb,
            body := jsonb_build_object(
                'type', 'SEND_TEMPLATE',
                'to', r_user.telefono,
                'templateName', v_template_name,
                'languageCode', 'es_AR'
            )
        );
        v_success := true;
        v_log_detail := 'WhatsApp disparado via pg_net (Template: ' || v_template_name || ')';
        
    ELSIF v_selected_channel = 'push' THEN
        PERFORM net.http_post(
            url := 'https://jskxfescamdjesdrcnkf.supabase.co/functions/v1/send-push',
            headers := '{"Content-Type": "application/json"}'::jsonb,
            body := jsonb_build_object(
                'included_segments', '[]'::jsonb,
                'include_player_ids', jsonb_build_array(v_push_token),
                'title', COALESCE(p_rule->'configs'->'push'->>'title', 'Wepi'),
                'message', COALESCE(p_rule->'configs'->'push'->>'body', 'Tienes una actualización.'),
                'data', jsonb_build_object('url', COALESCE(p_rule->'configs'->'push'->>'url', '/'))
            )
        );
        v_success := true;
        v_log_detail := 'Push disparado via pg_net';
    END IF;

    IF v_success THEN
        INSERT INTO public.crm_history (usuario_id, tipo, canal, descripcion, metadata, created_at)
        VALUES (
            p_user_id,
            'automatizacion_ejecutada_cron',
            v_selected_channel,
            'Disparo cronológico automático: ' || (p_rule->>'id') || ' vía ' || v_selected_channel,
            jsonb_build_object('rule_id', p_rule->>'id', 'dispatch_result', jsonb_build_object('success', true, 'logDetail', v_log_detail)) || p_extra_metadata,
            NOW()
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Programar el Cron Job cada 5 minutos
SELECT cron.unschedule('crm_automatizado_diario');
SELECT cron.unschedule('crm_chronological_triggers');
SELECT cron.schedule(
    'crm_chronological_triggers',
    '*/5 * * * *',
    $$ SELECT public.process_crm_chronological_triggers(); $$
);
