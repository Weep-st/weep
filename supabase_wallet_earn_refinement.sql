-- ═══════════════════════════════════════════════════
-- WALLET EARN REFINEMENT: Robust checks and COALESCE
-- ═══════════════════════════════════════════════════

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
    SELECT usuario_id, local_id, COALESCE(credito_wallet, 0)
    INTO v_user_id, v_local_id, v_used_wallet_credit 
    FROM public.pedidos_general 
    WHERE id = p_order_id;
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'Pedido % no tiene usuario_id o no existe.', p_order_id;
        RETURN;
    END IF;

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
    IF COALESCE(v_config.solo_primera_compra, FALSE) THEN
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
    IF v_used_wallet_credit > 0 AND NOT COALESCE(v_config.genera_credito_sobre_credito, FALSE) THEN
        RETURN; -- No genera si usó crédito y la config dice que no
    END IF;

    -- Determinar porcentaje (Normal vs Reducido por recompra)
    v_perc := COALESCE(v_config.porcentaje_ganancia, 0);
    IF v_used_wallet_credit > 0 AND v_config.genera_credito_sobre_credito AND v_config.porcentaje_reducido_recompra IS NOT NULL THEN
        v_perc := v_config.porcentaje_reducido_recompra;
    END IF;

    v_min := COALESCE(v_config.compra_minima_generar, 0);
    v_max := v_config.tope_maximo_ganancia;
    v_expiry := COALESCE(v_config.duracion_dias, 7);
    v_tipo_vencimiento := COALESCE(v_config.tipo_vencimiento, 'fija');

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
    VALUES (
        v_user_id, 
        'earn', 
        v_earn_amount, 
        p_order_id, 
        'Reintegro (' || COALESCE(v_config.objetivo, 'promo') || ') #' || p_order_id, 
        v_expires_at
    );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
