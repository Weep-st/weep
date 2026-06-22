-- ═══════════════════════════════════════════════════
-- WALLET ADVANCED CONFIG: Per-local rules (Módulos A-F)
-- ═══════════════════════════════════════════════════

-- 1. Crear tabla de configuración avanzada
CREATE TABLE IF NOT EXISTS public.wallet_config_locales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id TEXT REFERENCES public.locales(id) ON DELETE CASCADE, -- NULL significa Global
    activo BOOLEAN DEFAULT TRUE,
    
    -- A) Generación de crédito
    porcentaje_ganancia NUMERIC DEFAULT 0, -- ej: 10 (10%)
    tope_maximo_ganancia NUMERIC,          -- ej: 1200
    compra_minima_generar NUMERIC DEFAULT 0, -- ej: 10000
    multiplicador_especial JSONB DEFAULT '{}', -- Opcional: { horarios: [], dias: [] }
    
    -- B) Validez
    duracion_dias INTEGER DEFAULT 7,
    tipo_vencimiento TEXT DEFAULT 'fija', -- 'fija' o 'dinamica'
    
    -- C) Uso del crédito
    porcentaje_maximo_uso_saldo NUMERIC DEFAULT 100, -- % del saldo que puede usar
    max_porcentaje_pedido NUMERIC DEFAULT 100,      -- % del total del pedido que puede cubrir
    compra_minima_uso NUMERIC DEFAULT 0,           -- Monto mín compra para usar
    uso_minimo_credito NUMERIC DEFAULT 0,           -- Min $ de crédito para aplicar
    
    -- D) Recompra / Loop
    genera_credito_sobre_credito BOOLEAN DEFAULT FALSE,
    porcentaje_reducido_recompra NUMERIC, -- % si usa crédito
    
    -- E) Restricciones
    acumulable_promos BOOLEAN DEFAULT TRUE,
    compatible_envio_gratis BOOLEAN DEFAULT TRUE,
    solo_primera_compra BOOLEAN DEFAULT FALSE,
    max_creditos_activos INTEGER, -- NULL = ilimitado
    
    -- F) Objetivo de campaña
    objetivo TEXT, -- activacion, recompra, ticket, horas_valle
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_local_wallet_config UNIQUE (local_id)
);

-- Row Level Security
ALTER TABLE public.wallet_config_locales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view wallet configs" ON public.wallet_config_locales;
DROP POLICY IF EXISTS "Admins can manage wallet configs" ON public.wallet_config_locales;

CREATE POLICY "Public can view wallet configs" ON public.wallet_config_locales FOR SELECT USING (TRUE);
CREATE POLICY "Admins can manage wallet configs" ON public.wallet_config_locales FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Admins can manage wallet configs anon" ON public.wallet_config_locales FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);

-- 2. Función actualizada para ganar crédito respeando configuraciones locales
CREATE OR REPLACE FUNCTION public.earn_wallet_credit_from_order(p_order_id TEXT)
RETURNS VOID AS $$
DECLARE
    v_user_id TEXT;
    v_local_id TEXT;
    v_plates_value NUMERIC;
    v_config RECORD;
    v_earn_amount NUMERIC;
    v_used_wallet_credit NUMERIC;
    v_active_credits_count INTEGER;
    v_orders_count INTEGER;
    
    -- Defaults si no hay config
    v_perc NUMERIC := 0; 
    v_max NUMERIC := 0;
    v_min NUMERIC := 0;
    v_expiry INTEGER := 7;
    v_tipo_vencimiento TEXT := 'fija';
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Obtener datos básicos del pedido
    SELECT usuario_id, local_id, credito_wallet 
    INTO v_user_id, v_local_id, v_used_wallet_credit 
    FROM public.pedidos_general 
    WHERE id = p_order_id;
    
    -- Calcular valor de platos (subtotal items)
    SELECT COALESCE(SUM(precio_unitario * cantidad), 0) INTO v_plates_value 
    FROM public.pedidos_items 
    WHERE pedido_id = p_order_id;
    
    -- Intentar obtener configuración (Local -> Global -> Default)
    SELECT * INTO v_config FROM public.wallet_config_locales 
    WHERE (local_id = v_local_id OR local_id IS NULL) AND activo = TRUE
    ORDER BY local_id NULLS LAST LIMIT 1;

    -- Si no hay config activa, no ganan nada
    IF v_config IS NULL THEN
        RETURN;
    END IF;

    -- APLICAR RESTRICCIONES (E)
    
    -- Solo primera compra
    IF v_config.solo_primera_compra THEN
        SELECT COUNT(*) INTO v_orders_count FROM public.pedidos_general 
        WHERE usuario_id = v_user_id AND estado = 'Entregado' AND id != p_order_id;
        IF v_orders_count > 0 THEN
            RETURN;
        END IF;
    END IF;

    -- Máximo créditos activos
    IF v_config.max_creditos_activos IS NOT NULL THEN
        SELECT COUNT(*) INTO v_active_credits_count 
        FROM public.wallet_transactions 
        WHERE user_id = v_user_id AND type = 'earn' AND (expires_at > NOW() OR expires_at IS NULL);
        
        -- Si ya tiene o supera el limite, no gana mas
        IF v_active_credits_count >= v_config.max_creditos_activos THEN
            RETURN;
        END IF;
    END IF;

    -- LÓGICA DE RECOMPRA (D)
    IF v_used_wallet_credit > 0 AND NOT v_config.genera_credito_sobre_credito THEN
        RETURN; -- No genera si usó crédito y la config dice que no
    END IF;

    -- Determinar porcentaje (Normal vs Reducido por recompra)
    v_perc := v_config.porcentaje_ganancia;
    IF v_used_wallet_credit > 0 AND v_config.genera_credito_sobre_credito AND v_config.porcentaje_reducido_recompra IS NOT NULL THEN
        v_perc := v_config.porcentaje_reducido_recompra;
    END IF;

    v_min := v_config.compra_minima_generar;
    v_max := v_config.tope_maximo_ganancia;
    v_expiry := v_config.duracion_dias;
    v_tipo_vencimiento := v_config.tipo_vencimiento;

    -- Validar compra mínima
    IF v_plates_value < v_min THEN
        RETURN;
    END IF;

    -- Calcular monto
    v_earn_amount := floor(v_plates_value * (v_perc / 100));
    
    -- Aplicar tope
    IF v_max IS NOT NULL AND v_earn_amount > v_max THEN
        v_earn_amount := v_max;
    END IF;

    IF v_earn_amount <= 0 THEN
        RETURN;
    END IF;

    -- Calcular vencimiento (B)
    IF v_tipo_vencimiento = 'dinamica' THEN
        -- Vence a las 23:59 del día X
        v_expires_at := (CURRENT_DATE + (v_expiry || ' days')::INTERVAL + INTERVAL '0 days 23:59:59');
    ELSE
        -- Fija (X días exactos)
        v_expires_at := NOW() + (v_expiry || ' days')::INTERVAL;
    END IF;
    
    -- Insertar transacción
    INSERT INTO public.wallet_transactions (user_id, type, amount, order_id, description, expires_at)
    VALUES (v_user_id, 'earn', v_earn_amount, p_order_id, 'Reintegro (' || v_config.objetivo || ') #' || p_order_id, v_expires_at);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
