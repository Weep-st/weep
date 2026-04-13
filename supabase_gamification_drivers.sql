-- ==============================================================================
-- WEEP - Sistema de Gamificación y Recompensas para Repartidores
-- ==============================================================================

-- 1. Ampliar tabla de estado para control de ciclos y ventanas de gracia
ALTER TABLE public.system_activation_status 
ADD COLUMN IF NOT EXISTS l1_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS current_cycle_id TEXT;

-- 2. Tabla de historial de puntos
CREATE TABLE IF NOT EXISTS public.driver_points_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id TEXT REFERENCES public.repartidores(id) ON DELETE CASCADE,
    cycle_id TEXT,
    puntos INT NOT NULL,
    motivo TEXT NOT NULL, -- 'L1_RESPONSE', 'FIRST_RESPONDER', 'STREAK_BONUS', etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de estadísticas de gamificación
CREATE TABLE IF NOT EXISTS public.driver_gamification_stats (
    driver_id TEXT PRIMARY KEY REFERENCES public.repartidores(id) ON DELETE CASCADE,
    puntos_totales INT DEFAULT 0,
    puntos_canjeables INT DEFAULT 0,
    streak_actual INT DEFAULT 0,
    last_response_at TIMESTAMPTZ,
    rank_posicion INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inicializar stats para repartidores existentes
INSERT INTO public.driver_gamification_stats (driver_id)
SELECT id FROM public.repartidores
ON CONFLICT (driver_id) DO NOTHING;

-- 4. Actualizar lógica de evaluación para registrar inicio de ciclo
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
        v_push_message := '¡Ganás $' || (v_base_envio + v_incentivo) || ' por envío! 🚀 Demanda detectada, conéctate ahora.';
        
        -- INICIO DE CICLO Y VENTANA DE GRACIA
        UPDATE public.system_activation_status 
        SET l1_started_at = NOW(), 
            current_cycle_id = 'CYC-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS')
        WHERE id = 1;

    ELSIF v_current_state = 'ALERTED_L1' AND v_last_alert <= NOW() - INTERVAL '4 minutes' AND v_score >= 40 THEN
        v_current_state := 'ALERTED_L2';
        v_incentivo := 500;
        v_push_message := '¡URGENTE: Pagamos $' || (v_base_envio + v_incentivo) || ' el envío! 🔥 Los clientes esperan.';
    ELSIF v_current_state = 'ALERTED_L2' AND v_last_alert <= NOW() - INTERVAL '4 minutes' AND v_score >= 60 THEN
        v_current_state := 'ALERTED_L3';
        v_incentivo := 800;
        v_push_message := '¡OFERTA LÍMITE: $' || (v_base_envio + v_incentivo) || ' por envío! 💎 ¡Conéctate ya!';
    ELSIF v_score < 15 AND v_current_state != 'IDLE' THEN
        v_current_state := 'IDLE';
        v_incentivo := 0;
    END IF;

    -- Aplicar cambios y enviar Push
    IF v_current_state != 'IDLE' AND (v_current_state != (SELECT current_state FROM public.system_activation_status WHERE id = 1) OR v_last_alert <= NOW() - INTERVAL '10 minutes') THEN
        UPDATE public.system_activation_status 
        SET current_state = v_current_state, valor_incentivo = v_incentivo, current_score = v_score, last_alert_sent_at = NOW(), updated_at = NOW()
        WHERE id = 1;

        IF v_push_message IS NOT NULL THEN
            v_push_payload := jsonb_build_object(
                'included_segments', jsonb_build_array('Inactive Drivers'),
                'title', '¡Oportunidad de Ganancia!',
                'message', v_push_message,
                'data', jsonb_build_object('type', 'demand_activation', 'bonus', v_incentivo)
            );
            PERFORM net.http_post(
                url := 'https://jskxfescamdjesdrcnkf.supabase.co/functions/v1/send-push',
                headers := '{"Content-Type": "application/json"}'::jsonb,
                body := v_push_payload
            );
        END IF;
    ELSE
        UPDATE public.system_activation_status SET current_score = v_score, updated_at = NOW() WHERE id = 1;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Motor de Gamificación: Asignación de puntos al conectarse
CREATE OR REPLACE FUNCTION public.fn_process_gamification_on_activation()
RETURNS trigger AS $$
DECLARE
    v_status RECORD;
    v_puntos_base INT := 0;
    v_puntos_extra INT := 0;
    v_tiempo_desde_l1 INT;
    v_streak INT;
    v_last_resp TIMESTAMPTZ;
BEGIN
    -- Solo actuar si pasa de Inactivo a Activo
    IF NEW.estado = 'Activo' AND (OLD.estado IS NULL OR OLD.estado != 'Activo') THEN
        
        -- Obtener estado de demanda
        SELECT * INTO v_status FROM public.system_activation_status WHERE id = 1;

        IF v_status.current_state != 'IDLE' AND v_status.current_cycle_id IS NOT NULL THEN
            
            -- 1. LÓGICA DE PUNTOS POR NIVEL Y VENTANA DE GRACIA (3 MINUTOS)
            v_tiempo_desde_l1 := EXTRACT(EPOCH FROM (NOW() - v_status.l1_started_at)) / 60;

            IF v_tiempo_desde_l1 <= 3 THEN
                v_puntos_base := 100; -- Premio máximo por rapidez (Gracia L1)
            ELSE
                IF v_status.current_state = 'ALERTED_L1' THEN v_puntos_base := 100;
                ELSIF v_status.current_state = 'ALERTED_L2' THEN v_puntos_base := 60;
                ELSIF v_status.current_state = 'ALERTED_L3' THEN v_puntos_base := 30;
                END IF;
            END IF;

            -- 2. BONUS FIRST RESPONDER (+150 pts)
            -- Si el ciclo sigue activo, el primero en conectar se lo lleva
            v_puntos_extra := 150;

            -- 3. LOGUEAR PUNTOS
            INSERT INTO public.driver_points_log (driver_id, cycle_id, puntos, motivo)
            VALUES (NEW.id, v_status.current_cycle_id, v_puntos_base + v_puntos_extra, 'RESPONSE_' || v_status.current_state);

            -- 4. ACTUALIZAR ESTADÍSTICAS Y RACHAS
            SELECT streak_actual, last_response_at INTO v_streak, v_last_resp 
            FROM public.driver_gamification_stats WHERE driver_id = NEW.id;

            -- Si su última respuesta fue en las últimas 24hs, suma racha
            IF v_last_resp >= NOW() - INTERVAL '24 hours' THEN
                v_streak := COALESCE(v_streak, 0) + 1;
            ELSE
                v_streak := 1;
            END IF;

            -- Bonus por Racha
            IF v_streak = 3 THEN 
                 INSERT INTO public.driver_points_log (driver_id, cycle_id, puntos, motivo) VALUES (NEW.id, v_status.current_cycle_id, 100, 'STREAK_3');
                 v_puntos_extra := v_puntos_extra + 100;
            ELSIF v_streak = 5 THEN
                 INSERT INTO public.driver_points_log (driver_id, cycle_id, puntos, motivo) VALUES (NEW.id, v_status.current_cycle_id, 250, 'STREAK_5');
                 v_puntos_extra := v_puntos_extra + 250;
            END IF;

            UPDATE public.driver_gamification_stats 
            SET puntos_totales = puntos_totales + v_puntos_base + v_puntos_extra,
                puntos_canjeables = puntos_canjeables + v_puntos_base + v_puntos_extra,
                streak_actual = v_streak,
                last_response_at = NOW()
            WHERE driver_id = NEW.id;

            -- 5. RESET DEL SISTEMA (Él fue el responsable)
            UPDATE public.system_activation_status 
            SET current_state = 'IDLE', 
                valor_incentivo = 0, 
                current_cycle_id = NULL,
                updated_at = NOW() 
            WHERE id = 1;

        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Re-vincular Triggers
DROP TRIGGER IF EXISTS tr_gamification_on_activation ON public.repartidores;
CREATE TRIGGER tr_gamification_on_activation
BEFORE UPDATE OF estado ON public.repartidores
FOR EACH ROW
EXECUTE FUNCTION public.fn_process_gamification_on_activation();

-- 7. View para Ranking Semanal
CREATE OR REPLACE VIEW public.view_driver_ranking AS
SELECT 
    r.nombre,
    r.foto_url,
    s.puntos_totales,
    s.streak_actual,
    RANK() OVER (ORDER BY s.puntos_totales DESC) as posicion
FROM public.repartidores r
JOIN public.driver_gamification_stats s ON r.id = s.driver_id
WHERE r.admin_status = 'Aceptado'
LIMIT 5;
