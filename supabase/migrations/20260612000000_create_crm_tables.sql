-- ═══════════════════════════════════════════════════
-- CRM & AUTOMATIONS SYSTEM
-- ═══════════════════════════════════════════════════

-- 1. Extend Core Users Table with CRM Fields
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS estado_crm TEXT DEFAULT 'REGISTRADO';
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS wepi_score INTEGER DEFAULT 0;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS cantidad_pedidos INTEGER DEFAULT 0;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS total_gastado NUMERIC DEFAULT 0;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS ticket_promedio NUMERIC DEFAULT 0;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS categoria_favorita TEXT;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS fecha_primer_pedido TIMESTAMPTZ;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS fecha_ultimo_pedido TIMESTAMPTZ;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS ultima_interaccion_crm TIMESTAMPTZ;

-- 2. Create CRM Tags Table
CREATE TABLE IF NOT EXISTS public.crm_tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for crm_tags
ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage crm_tags" ON public.crm_tags;
CREATE POLICY "Admins can manage crm_tags" ON public.crm_tags FOR ALL USING (TRUE);

-- 3. Create CRM User-Tags Mapping Table
CREATE TABLE IF NOT EXISTS public.crm_usuario_tags (
    usuario_id TEXT NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES public.crm_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (usuario_id, tag_id)
);

-- RLS for crm_usuario_tags
ALTER TABLE public.crm_usuario_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage crm_usuario_tags" ON public.crm_usuario_tags;
CREATE POLICY "Admins can manage crm_usuario_tags" ON public.crm_usuario_tags FOR ALL USING (TRUE);

-- 4. Create CRM Events Table
CREATE TABLE IF NOT EXISTS public.crm_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id TEXT NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_crm_events_user ON public.crm_events(usuario_id);
CREATE INDEX IF NOT EXISTS idx_crm_events_type ON public.crm_events(event_type);

-- RLS for crm_events
ALTER TABLE public.crm_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage crm_events" ON public.crm_events;
CREATE POLICY "Admins can manage crm_events" ON public.crm_events FOR ALL USING (TRUE);

-- 5. Create CRM Automations Table
CREATE TABLE IF NOT EXISTS public.crm_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    estado BOOLEAN DEFAULT TRUE,
    evento_disparador TEXT NOT NULL,
    condiciones JSONB DEFAULT '{}'::jsonb,
    canal TEXT NOT NULL, -- 'push', 'whatsapp', 'email', 'sms'
    mensaje TEXT NOT NULL,
    tiempo_espera INTEGER DEFAULT 0, -- in minutes
    prioridad INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for crm_automations
ALTER TABLE public.crm_automations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage crm_automations" ON public.crm_automations;
CREATE POLICY "Admins can manage crm_automations" ON public.crm_automations FOR ALL USING (TRUE);

-- 6. Create CRM History (Logs) Table
CREATE TABLE IF NOT EXISTS public.crm_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id TEXT NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL, -- 'mensaje_enviado', 'automatizacion_ejecutada', 'cambio_estado', 'cambio_score', 'pedido', 'recuperacion', 'evento_importante'
    descripcion TEXT NOT NULL,
    canal TEXT,
    automation_id UUID REFERENCES public.crm_automations(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_crm_history_user ON public.crm_history(usuario_id);

-- RLS for crm_history
ALTER TABLE public.crm_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage crm_history" ON public.crm_history;
CREATE POLICY "Admins can manage crm_history" ON public.crm_history FOR ALL USING (TRUE);

-- 7. Create CRM Campaigns Table
CREATE TABLE IF NOT EXISTS public.crm_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    filtros JSONB DEFAULT '{}'::jsonb,
    canal TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    estado TEXT DEFAULT 'Borrador', -- 'Borrador', 'Programada', 'Enviada'
    fecha_programada TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for crm_campaigns
ALTER TABLE public.crm_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage crm_campaigns" ON public.crm_campaigns;
CREATE POLICY "Admins can manage crm_campaigns" ON public.crm_campaigns FOR ALL USING (TRUE);

-- 8. Create CRM Wepi Score Configuration Table
CREATE TABLE IF NOT EXISTS public.crm_score_config (
    id TEXT PRIMARY KEY,
    puntos INTEGER NOT NULL,
    nombre TEXT NOT NULL
);

-- RLS for crm_score_config
ALTER TABLE public.crm_score_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage crm_score_config" ON public.crm_score_config;
CREATE POLICY "Admins can manage crm_score_config" ON public.crm_score_config FOR ALL USING (TRUE);

-- 9. Seed default Wepi Score configurations
INSERT INTO public.crm_score_config (id, puntos, nombre) VALUES
('register', 10, 'Registro de usuario'),
('first_order', 20, 'Primer pedido entregado'),
('second_order', 15, 'Segundo pedido entregado'),
('5_orders', 25, 'Quinto pedido entregado'),
('10_orders', 50, 'VIP alcanzado (10 pedidos)'),
('inactivity_30', -10, '30 días sin actividad'),
('recovery', 30, 'Recuperación de cliente')
ON CONFLICT (id) DO UPDATE SET puntos = EXCLUDED.puntos, nombre = EXCLUDED.nombre;


-- ═══════════════════════════════════════════════════
-- TRIGGER FUNCTIONS & BUSINESS LOGIC
-- ═══════════════════════════════════════════════════

-- A. Trigger for User Registration
CREATE OR REPLACE FUNCTION public.on_crm_user_registered()
RETURNS TRIGGER AS $$
DECLARE
    v_points INTEGER;
    v_city_tag TEXT;
BEGIN
    -- 1. Get score for register
    SELECT puntos INTO v_points FROM public.crm_score_config WHERE id = 'register';
    v_points := COALESCE(v_points, 10);
    
    -- 2. Update user initial score & state
    UPDATE public.usuarios 
    SET estado_crm = 'REGISTRADO', 
        wepi_score = v_points 
    WHERE id = NEW.id;

    -- 3. Log registration event
    INSERT INTO public.crm_events (usuario_id, event_type, metadata)
    VALUES (NEW.id, 'USER_REGISTERED', jsonb_build_object('ciudad', NEW.ciudad));

    -- 4. Create and map city tag dynamically
    IF NEW.ciudad IS NOT NULL AND NEW.ciudad <> '' THEN
        v_city_tag := UPPER(REPLACE(REPLACE(NEW.ciudad, ' ', '_'), 'ó', 'O'));
        v_city_tag := REPLACE(v_city_tag, 'á', 'A');
        v_city_tag := REPLACE(v_city_tag, 'é', 'E');
        v_city_tag := REPLACE(v_city_tag, 'í', 'I');
        v_city_tag := REPLACE(v_city_tag, 'ú', 'U');
        
        INSERT INTO public.crm_tags (id, name) 
        VALUES (v_city_tag, NEW.ciudad) 
        ON CONFLICT DO NOTHING;
        
        INSERT INTO public.crm_usuario_tags (usuario_id, tag_id)
        VALUES (NEW.id, v_city_tag)
        ON CONFLICT DO NOTHING;
    END IF;

    -- 5. Log in CRM History
    INSERT INTO public.crm_history (usuario_id, tipo, descripcion, metadata)
    VALUES (
        NEW.id, 
        'evento_importante', 
        'Usuario registrado en ' || COALESCE(NEW.ciudad, 'Santo Tomé'),
        jsonb_build_object('ciudad', NEW.ciudad, 'score_added', v_points)
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_on_crm_user_registered ON public.usuarios;
CREATE TRIGGER trigger_on_crm_user_registered
AFTER INSERT ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.on_crm_user_registered();


-- B. Trigger for Order Delivered
CREATE OR REPLACE FUNCTION public.on_crm_order_delivered()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id TEXT;
    v_count INTEGER;
    v_total_spent NUMERIC;
    v_ticket_avg NUMERIC;
    v_first_order_date TIMESTAMPTZ;
    v_last_order_date TIMESTAMPTZ;
    v_fav_cat TEXT;
    v_prev_state TEXT;
    v_new_state TEXT;
    v_score INTEGER;
    v_score_reg INTEGER;
    v_score_1st INTEGER;
    v_score_2nd INTEGER;
    v_score_5th INTEGER;
    v_score_10th INTEGER;
    v_score_rec INTEGER;
    v_score_inact INTEGER;
    v_recovered BOOLEAN := FALSE;
    
    -- Item loops for tagging
    item_record RECORD;
    v_cat_tag TEXT;
    v_order_hour INTEGER;
BEGIN
    -- Only act on Entregado
    IF NEW.estado = 'Entregado' AND (OLD.estado IS NULL OR OLD.estado <> 'Entregado') THEN
        v_user_id := NEW.usuario_id;
        IF v_user_id IS NULL THEN
            RETURN NEW;
        END IF;

        -- 1. Fetch current CRM state of the user
        SELECT estado_crm INTO v_prev_state FROM public.usuarios WHERE id = v_user_id;
        v_prev_state := COALESCE(v_prev_state, 'REGISTRADO');

        -- 2. Recalculate Stats from all Delivered orders
        SELECT count(*), COALESCE(sum(total), 0), min(created_at), max(created_at)
        INTO v_count, v_total_spent, v_first_order_date, v_last_order_date
        FROM public.pedidos_general
        WHERE usuario_id = v_user_id AND estado = 'Entregado';

        -- Ticket Avg
        v_ticket_avg := v_total_spent / v_count;

        -- Favorite Category
        SELECT m.categoria INTO v_fav_cat
        FROM public.pedidos_items pi
        JOIN public.menu m ON pi.item_id = m.id
        WHERE pi.pedido_id IN (SELECT id FROM public.pedidos_general WHERE usuario_id = v_user_id AND estado = 'Entregado')
        GROUP BY m.categoria
        ORDER BY sum(pi.cantidad) DESC
        LIMIT 1;

        -- 3. Determine if customer was Dormido and is now Recovered
        IF v_prev_state = 'DORMIDO' THEN
            v_new_state := 'RECUPERADO';
            v_recovered := TRUE;
            
            -- Log USER_RECOVERED Event
            INSERT INTO public.crm_events (usuario_id, event_type, metadata)
            VALUES (v_user_id, 'USER_RECOVERED', jsonb_build_object('order_id', NEW.id, 'inactive_to_recovered', true));
            
            -- Remove INACTIVO tag if exists
            DELETE FROM public.crm_usuario_tags WHERE usuario_id = v_user_id AND tag_id = 'INACTIVO';
        ELSE
            -- Normal growth states
            IF v_count = 1 THEN
                v_new_state := 'PRIMER_PEDIDO';
            ELSIF v_count >= 2 AND v_count < 5 THEN
                v_new_state := 'CLIENTE_ACTIVO';
            ELSIF v_count >= 5 AND v_count < 10 THEN
                v_new_state := 'CLIENTE_FRECUENTE';
            ELSE
                v_new_state := 'VIP';
            END IF;
        END IF;

        -- 4. Calculate Wepi Score based on crm_score_config
        SELECT puntos INTO v_score_reg FROM public.crm_score_config WHERE id = 'register';
        SELECT puntos INTO v_score_1st FROM public.crm_score_config WHERE id = 'first_order';
        SELECT puntos INTO v_score_2nd FROM public.crm_score_config WHERE id = 'second_order';
        SELECT puntos INTO v_score_5th FROM public.crm_score_config WHERE id = '5_orders';
        SELECT puntos INTO v_score_10th FROM public.crm_score_config WHERE id = '10_orders';
        SELECT puntos INTO v_score_rec FROM public.crm_score_config WHERE id = 'recovery';
        SELECT puntos INTO v_score_inact FROM public.crm_score_config WHERE id = 'inactivity_30';
        
        v_score_reg := COALESCE(v_score_reg, 10);
        v_score_1st := COALESCE(v_score_1st, 20);
        v_score_2nd := COALESCE(v_score_2nd, 15);
        v_score_5th := COALESCE(v_score_5th, 25);
        v_score_10th := COALESCE(v_score_10th, 50);
        v_score_rec := COALESCE(v_score_rec, 30);
        v_score_inact := COALESCE(v_score_inact, -10);

        v_score := v_score_reg;
        IF v_count >= 1 THEN v_score := v_score + v_score_1st; END IF;
        IF v_count >= 2 THEN v_score := v_score + v_score_2nd; END IF;
        IF v_count >= 5 THEN v_score := v_score + v_score_5th; END IF;
        IF v_count >= 10 THEN v_score := v_score + v_score_10th; END IF;
        
        -- Check if recovered event exists
        IF EXISTS (SELECT 1 FROM public.crm_events WHERE usuario_id = v_user_id AND event_type = 'USER_RECOVERED') THEN
            v_score := v_score + v_score_rec;
        END IF;
        -- Check if dormant event exists
        IF EXISTS (SELECT 1 FROM public.crm_events WHERE usuario_id = v_user_id AND event_type = 'USER_DORMANT_30') THEN
            v_score := v_score + v_score_inact;
        END IF;

        -- 5. Update user stats
        UPDATE public.usuarios
        SET estado_crm = v_new_state,
            wepi_score = v_score,
            cantidad_pedidos = v_count,
            total_gastado = v_total_spent,
            ticket_promedio = v_ticket_avg,
            categoria_favorita = v_fav_cat,
            fecha_primer_pedido = v_first_order_date,
            fecha_ultimo_pedido = v_last_order_date
        WHERE id = v_user_id;

        -- 6. Insert order event
        IF v_count = 1 THEN
            INSERT INTO public.crm_events (usuario_id, event_type, metadata) 
            VALUES (v_user_id, 'FIRST_ORDER', jsonb_build_object('order_id', NEW.id, 'total', NEW.total));
        ELSIF v_count = 2 THEN
            INSERT INTO public.crm_events (usuario_id, event_type, metadata) 
            VALUES (v_user_id, 'SECOND_ORDER', jsonb_build_object('order_id', NEW.id, 'total', NEW.total));
        ELSIF v_count = 3 THEN
            INSERT INTO public.crm_events (usuario_id, event_type, metadata) 
            VALUES (v_user_id, 'THIRD_ORDER', jsonb_build_object('order_id', NEW.id, 'total', NEW.total));
        ELSIF v_count = 5 THEN
            INSERT INTO public.crm_events (usuario_id, event_type, metadata) 
            VALUES (v_user_id, 'FIFTH_ORDER', jsonb_build_object('order_id', NEW.id, 'total', NEW.total));
        ELSIF v_count = 10 THEN
            INSERT INTO public.crm_events (usuario_id, event_type, metadata) 
            VALUES (v_user_id, 'VIP_REACHED', jsonb_build_object('order_id', NEW.id, 'total', NEW.total));
            
            -- Tag VIP
            INSERT INTO public.crm_tags (id, name) VALUES ('VIP', 'VIP') ON CONFLICT DO NOTHING;
            INSERT INTO public.crm_usuario_tags (usuario_id, tag_id) VALUES (v_user_id, 'VIP') ON CONFLICT DO NOTHING;
        END IF;

        -- 7. Dynamically tag based on order details
        
        -- Category tags
        FOR item_record IN 
            SELECT DISTINCT m.categoria 
            FROM public.pedidos_items pi 
            JOIN public.menu m ON pi.item_id = m.id 
            WHERE pi.pedido_id = NEW.id AND m.categoria IS NOT NULL AND m.categoria <> ''
        LOOP
            v_cat_tag := UPPER(REPLACE(REPLACE(item_record.categoria, ' ', '_'), 'í', 'I'));
            v_cat_tag := REPLACE(v_cat_tag, 'ó', 'O');
            v_cat_tag := REPLACE(v_cat_tag, 'á', 'A');
            v_cat_tag := REPLACE(v_cat_tag, 'é', 'E');
            v_cat_tag := REPLACE(v_cat_tag, 'ú', 'U');
            
            -- Insert tags and map
            INSERT INTO public.crm_tags (id, name) VALUES (v_cat_tag, item_record.categoria) ON CONFLICT DO NOTHING;
            INSERT INTO public.crm_usuario_tags (usuario_id, tag_id) VALUES (v_user_id, v_cat_tag) ON CONFLICT DO NOTHING;
            
            -- Special Desayuno/Merienda mapping
            IF v_cat_tag = 'DESAYUNOS' OR v_cat_tag = 'CAFETERIA' THEN
                INSERT INTO public.crm_tags (id, name) VALUES ('DESAYUNO', 'Desayuno') ON CONFLICT DO NOTHING;
                INSERT INTO public.crm_usuario_tags (usuario_id, tag_id) VALUES (v_user_id, 'DESAYUNO') ON CONFLICT DO NOTHING;
            ELSIF v_cat_tag = 'MERIENDAS' THEN
                INSERT INTO public.crm_tags (id, name) VALUES ('MERIENDA', 'Merienda') ON CONFLICT DO NOTHING;
                INSERT INTO public.crm_usuario_tags (usuario_id, tag_id) VALUES (v_user_id, 'MERIENDA') ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;

        -- Nocturno Tag: Hour between 23h and 06h
        v_order_hour := EXTRACT(HOUR FROM NEW.created_at AT TIME ZONE 'GMT-3');
        IF v_order_hour >= 23 OR v_order_hour < 6 THEN
            INSERT INTO public.crm_tags (id, name) VALUES ('NOCTURNO', 'Nocturno') ON CONFLICT DO NOTHING;
            INSERT INTO public.crm_usuario_tags (usuario_id, tag_id) VALUES (v_user_id, 'NOCTURNO') ON CONFLICT DO NOTHING;
        END IF;

        -- Delivery Tag
        IF NEW.tipo_entrega = 'envio' THEN
            INSERT INTO public.crm_tags (id, name) VALUES ('DELIVERY', 'Delivery') ON CONFLICT DO NOTHING;
            INSERT INTO public.crm_usuario_tags (usuario_id, tag_id) VALUES (v_user_id, 'DELIVERY') ON CONFLICT DO NOTHING;
        END IF;

        -- 8. Add CRM History Logs
        INSERT INTO public.crm_history (usuario_id, tipo, descripcion, metadata)
        VALUES (
            v_user_id,
            'pedido',
            'Pedido entregado #' || NEW.id || ' de $' || NEW.total,
            jsonb_build_object('order_id', NEW.id, 'total', NEW.total, 'new_order_count', v_count)
        );

        IF v_prev_state <> v_new_state THEN
            INSERT INTO public.crm_history (usuario_id, tipo, descripcion, metadata)
            VALUES (
                v_user_id,
                'cambio_estado',
                'Cambio de estado: ' || v_prev_state || ' ➡️ ' || v_new_state,
                jsonb_build_object('old_state', v_prev_state, 'new_state', v_new_state)
            );
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_on_crm_order_delivered ON public.pedidos_general;
CREATE TRIGGER trigger_on_crm_order_delivered
AFTER UPDATE ON public.pedidos_general
FOR EACH ROW EXECUTE FUNCTION public.on_crm_order_delivered();


-- C. Trigger for Order Cancelled
CREATE OR REPLACE FUNCTION public.on_crm_order_cancelled()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.estado = 'Cancelado' OR NEW.estado = 'Rechazado') AND (OLD.estado <> 'Cancelado' AND OLD.estado <> 'Rechazado') THEN
        IF NEW.usuario_id IS NOT NULL THEN
            -- Log event
            INSERT INTO public.crm_events (usuario_id, event_type, metadata)
            VALUES (NEW.usuario_id, 'ORDER_CANCELLED', jsonb_build_object('order_id', NEW.id, 'status', NEW.estado));
            
            -- Log history
            INSERT INTO public.crm_history (usuario_id, tipo, descripcion, metadata)
            VALUES (
                NEW.usuario_id,
                'evento_importante',
                'Pedido cancelado o rechazado #' || NEW.id,
                jsonb_build_object('order_id', NEW.id, 'status', NEW.estado)
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_on_crm_order_cancelled ON public.pedidos_general;
CREATE TRIGGER trigger_on_crm_order_cancelled
AFTER UPDATE ON public.pedidos_general
FOR EACH ROW EXECUTE FUNCTION public.on_crm_order_cancelled();


-- ═══════════════════════════════════════════════════
-- INACTIVITY CHECK FUNCTION (pg_cron or manual RPC)
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_and_update_crm_inactivity()
RETURNS JSONB AS $$
DECLARE
    r RECORD;
    v_days INTEGER;
    v_last_active TIMESTAMPTZ;
    v_dormant_30_points INTEGER;
    v_current_score INTEGER;
    v_updated_count INTEGER := 0;
    v_results JSONB := '[]'::jsonb;
BEGIN
    SELECT puntos INTO v_dormant_30_points FROM public.crm_score_config WHERE id = 'inactivity_30';
    v_dormant_30_points := COALESCE(v_dormant_30_points, -10);

    FOR r IN 
        SELECT id, nombre, estado_crm, wepi_score, fecha_ultimo_pedido, created_at 
        FROM public.usuarios 
        WHERE role = 'user' OR role IS NULL
    LOOP
        -- Determine last activity date
        v_last_active := COALESCE(r.fecha_ultimo_pedido, r.created_at);
        v_days := EXTRACT(DAY FROM NOW() - v_last_active);
        
        -- Check 30 Days Inactivity (DORMIDO)
        IF v_days >= 30 AND r.estado_crm <> 'DORMIDO' THEN
            -- Check if dormant event already exists in last 30 days to prevent duplicate penalties
            IF NOT EXISTS (
                SELECT 1 FROM public.crm_events 
                WHERE usuario_id = r.id AND event_type = 'USER_DORMANT_30' AND created_at > NOW() - INTERVAL '30 days'
            ) THEN
                v_current_score := GREATEST(0, r.wepi_score + v_dormant_30_points);
                
                -- Update User
                UPDATE public.usuarios 
                SET estado_crm = 'DORMIDO',
                    wepi_score = v_current_score
                WHERE id = r.id;

                -- Map INACTIVO tag
                INSERT INTO public.crm_tags (id, name) VALUES ('INACTIVO', 'Inactivo') ON CONFLICT DO NOTHING;
                INSERT INTO public.crm_usuario_tags (usuario_id, tag_id) VALUES (r.id, 'INACTIVO') ON CONFLICT DO NOTHING;

                -- Log event
                INSERT INTO public.crm_events (usuario_id, event_type, metadata)
                VALUES (r.id, 'USER_DORMANT_30', jsonb_build_object('days_inactive', v_days, 'last_activity', v_last_active));

                -- Log history
                INSERT INTO public.crm_history (usuario_id, tipo, descripcion, metadata)
                VALUES (
                    r.id,
                    'cambio_estado',
                    'Cliente pasó a estado DORMIDO (30 días de inactividad)',
                    jsonb_build_object('old_state', r.estado_crm, 'new_state', 'DORMIDO', 'score_penalty', v_dormant_30_points)
                );

                v_updated_count := v_updated_count + 1;
                v_results := v_results || jsonb_build_object('user_id', r.id, 'name', r.nombre, 'days', v_days, 'new_state', 'DORMIDO');
            END IF;

        -- Check 15 Days Inactivity
        ELSIF v_days >= 15 AND v_days < 30 THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.crm_events 
                WHERE usuario_id = r.id AND event_type = 'USER_DORMANT_15' AND created_at > NOW() - INTERVAL '15 days'
            ) THEN
                INSERT INTO public.crm_events (usuario_id, event_type, metadata)
                VALUES (r.id, 'USER_DORMANT_15', jsonb_build_object('days_inactive', v_days, 'last_activity', v_last_active));
                
                INSERT INTO public.crm_history (usuario_id, tipo, descripcion, metadata)
                VALUES (r.id, 'evento_importante', 'Alerta: 15 días sin realizar pedidos', jsonb_build_object('days', v_days));
                
                v_results := v_results || jsonb_build_object('user_id', r.id, 'name', r.nombre, 'days', v_days, 'event', 'USER_DORMANT_15');
            END IF;

        -- Check 7 Days Inactivity
        ELSIF v_days >= 7 AND v_days < 15 THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.crm_events 
                WHERE usuario_id = r.id AND event_type = 'USER_DORMANT_7' AND created_at > NOW() - INTERVAL '7 days'
            ) THEN
                INSERT INTO public.crm_events (usuario_id, event_type, metadata)
                VALUES (r.id, 'USER_DORMANT_7', jsonb_build_object('days_inactive', v_days, 'last_activity', v_last_active));
                
                INSERT INTO public.crm_history (usuario_id, tipo, descripcion, metadata)
                VALUES (r.id, 'evento_importante', 'Alerta: 7 días sin realizar pedidos', jsonb_build_object('days', v_days));
                
                v_results := v_results || jsonb_build_object('user_id', r.id, 'name', r.nombre, 'days', v_days, 'event', 'USER_DORMANT_7');
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'updated_count', v_updated_count, 'details', v_results);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════
-- RETROACTIVE INITIALIZATION MIGRATION FOR OLD DATA
-- ═══════════════════════════════════════════════════

DO $$
DECLARE
    r RECORD;
    v_count INTEGER;
    v_total_spent NUMERIC;
    v_ticket_avg NUMERIC;
    v_fav_cat TEXT;
    v_first_order_date TIMESTAMPTZ;
    v_last_order_date TIMESTAMPTZ;
    v_score INTEGER;
    v_state TEXT;
    v_city_tag TEXT;
BEGIN
    FOR r IN SELECT id, nombre, ciudad, created_at FROM public.usuarios LOOP
        -- Count delivered orders
        SELECT count(*), COALESCE(sum(total), 0), min(created_at), max(created_at)
        INTO v_count, v_total_spent, v_first_order_date, v_last_order_date
        FROM public.pedidos_general
        WHERE usuario_id = r.id AND estado = 'Entregado';
        
        IF v_count > 0 THEN
            v_ticket_avg := v_total_spent / v_count;
            
            -- Fav category
            SELECT m.categoria INTO v_fav_cat
            FROM public.pedidos_items pi
            JOIN public.menu m ON pi.item_id = m.id
            WHERE pi.pedido_id IN (SELECT id FROM public.pedidos_general WHERE usuario_id = r.id AND estado = 'Entregado')
            GROUP BY m.categoria
            ORDER BY sum(pi.cantidad) DESC
            LIMIT 1;
            
            -- State based on order count
            IF v_count = 1 THEN
                v_state := 'PRIMER_PEDIDO';
            ELSIF v_count >= 2 AND v_count < 5 THEN
                v_state := 'CLIENTE_ACTIVO';
            ELSIF v_count >= 5 AND v_count < 10 THEN
                v_state := 'CLIENTE_FRECUENTE';
            ELSE
                v_state := 'VIP';
            END IF;
        ELSE
            v_ticket_avg := 0;
            v_fav_cat := NULL;
            v_state := 'REGISTRADO';
        END IF;
        
        -- Score Calculation
        v_score := 10; -- Register
        IF v_count >= 1 THEN v_score := v_score + 20; END IF;
        IF v_count >= 2 THEN v_score := v_score + 15; END IF;
        IF v_count >= 5 THEN v_score := v_score + 25; END IF;
        IF v_count >= 10 THEN v_score := v_score + 50; END IF;
        
        -- Update user row
        UPDATE public.usuarios
        SET estado_crm = v_state,
            wepi_score = v_score,
            cantidad_pedidos = v_count,
            total_gastado = v_total_spent,
            ticket_promedio = v_ticket_avg,
            categoria_favorita = v_fav_cat,
            fecha_primer_pedido = v_first_order_date,
            fecha_ultimo_pedido = v_last_order_date
        WHERE id = r.id;
        
        -- Add City Tag
        IF r.ciudad IS NOT NULL AND r.ciudad <> '' THEN
            v_city_tag := UPPER(REPLACE(REPLACE(r.ciudad, ' ', '_'), 'ó', 'O'));
            v_city_tag := REPLACE(v_city_tag, 'á', 'A');
            v_city_tag := REPLACE(v_city_tag, 'é', 'E');
            v_city_tag := REPLACE(v_city_tag, 'í', 'I');
            v_city_tag := REPLACE(v_city_tag, 'ú', 'U');
            
            INSERT INTO public.crm_tags (id, name) VALUES (v_city_tag, r.ciudad) ON CONFLICT DO NOTHING;
            INSERT INTO public.crm_usuario_tags (usuario_id, tag_id) VALUES (r.id, v_city_tag) ON CONFLICT DO NOTHING;
        END IF;
        
        -- Add category tags and delivery tags
        IF v_count > 0 THEN
            IF v_state = 'VIP' THEN
                INSERT INTO public.crm_tags (id, name) VALUES ('VIP', 'VIP') ON CONFLICT DO NOTHING;
                INSERT INTO public.crm_usuario_tags (usuario_id, tag_id) VALUES (r.id, 'VIP') ON CONFLICT DO NOTHING;
            END IF;
            
            IF EXISTS (
                SELECT 1 FROM public.pedidos_items pi
                JOIN public.menu m ON pi.item_id = m.id
                WHERE pi.pedido_id IN (SELECT id FROM public.pedidos_general WHERE usuario_id = r.id AND estado = 'Entregado')
                  AND m.categoria = 'Helados'
            ) THEN
                INSERT INTO public.crm_tags (id, name) VALUES ('HELADOS', 'Helados') ON CONFLICT DO NOTHING;
                INSERT INTO public.crm_usuario_tags (usuario_id, tag_id) VALUES (r.id, 'HELADOS') ON CONFLICT DO NOTHING;
            END IF;
            
            IF EXISTS (
                SELECT 1 FROM public.pedidos_items pi
                JOIN public.menu m ON pi.item_id = m.id
                WHERE pi.pedido_id IN (SELECT id FROM public.pedidos_general WHERE usuario_id = r.id AND estado = 'Entregado')
                  AND m.categoria = 'Farmacia'
            ) THEN
                INSERT INTO public.crm_tags (id, name) VALUES ('FARMACIA', 'Farmacia') ON CONFLICT DO NOTHING;
                INSERT INTO public.crm_usuario_tags (usuario_id, tag_id) VALUES (r.id, 'FARMACIA') ON CONFLICT DO NOTHING;
            END IF;
            
            IF EXISTS (
                SELECT 1 FROM public.pedidos_items pi
                JOIN public.menu m ON pi.item_id = m.id
                WHERE pi.pedido_id IN (SELECT id FROM public.pedidos_general WHERE usuario_id = r.id AND estado = 'Entregado')
                  AND m.categoria = 'Shops'
            ) THEN
                INSERT INTO public.crm_tags (id, name) VALUES ('SHOPS', 'Shops') ON CONFLICT DO NOTHING;
                INSERT INTO public.crm_usuario_tags (usuario_id, tag_id) VALUES (r.id, 'SHOPS') ON CONFLICT DO NOTHING;
            END IF;
            
            IF EXISTS (
                SELECT 1 FROM public.pedidos_general WHERE usuario_id = r.id AND estado = 'Entregado' AND tipo_entrega = 'envio'
            ) THEN
                INSERT INTO public.crm_tags (id, name) VALUES ('DELIVERY', 'Delivery') ON CONFLICT DO NOTHING;
                INSERT INTO public.crm_usuario_tags (usuario_id, tag_id) VALUES (r.id, 'DELIVERY') ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    END LOOP;
END $$;
