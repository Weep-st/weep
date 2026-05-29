-- ═══════════════════════════════════════════════════
-- WALLET LIMITS: Add max_pedidos_generar support
-- ═══════════════════════════════════════════════════

-- 1. Añadir columna a la tabla de configuración
ALTER TABLE public.wallet_config_locales ADD COLUMN IF NOT EXISTS max_pedidos_generar INTEGER;

-- 2. Actualizar función de acreditación
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
    v_total_earned_by_user NUMERIC;
    v_total_times_earned INTEGER;
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
    
    -- Solo primera compra (Check legacy/simple constraint)
    IF COALESCE(v_config.solo_primera_compra, FALSE) THEN
        SELECT COUNT(*) INTO v_orders_count FROM public.pedidos_general 
        WHERE usuario_id = v_user_id AND estado = 'Entregado' AND id != p_order_id;
        IF v_orders_count > 0 THEN
            RETURN;
        END IF;
    END IF;

    -- Límite de cantidad de pedidos que pueden generar crédito
    IF v_config.max_pedidos_generar IS NOT NULL THEN
        SELECT COUNT(*) INTO v_total_times_earned 
        FROM public.wallet_transactions 
        WHERE user_id = v_user_id AND type = 'earn' 
          AND (order_id IN (SELECT id FROM public.pedidos_general WHERE local_id = v_local_id) 
               OR v_local_id IS NULL);
               
        IF v_total_times_earned >= v_config.max_pedidos_generar THEN
            RETURN;
        END IF;
    END IF;

    -- Límite de ganancia TOTAL acumulada por usuario en esta config
    IF v_config.max_ganancia_usuario IS NOT NULL THEN
        SELECT COALESCE(SUM(amount), 0) INTO v_total_earned_by_user 
        FROM public.wallet_transactions 
        WHERE user_id = v_user_id AND type = 'earn' 
          AND (order_id IN (SELECT id FROM public.pedidos_general WHERE local_id = v_local_id) 
               OR v_local_id IS NULL);
               
        IF v_total_earned_by_user >= v_config.max_ganancia_usuario THEN
            RETURN;
        END IF;
    END IF;

    -- Máximo créditos activos simultáneos
    IF v_config.max_creditos_activos IS NOT NULL THEN
        SELECT COUNT(*) INTO v_active_credits_count 
        FROM public.wallet_transactions 
        WHERE user_id = v_user_id AND type = 'earn' AND (expires_at > NOW() OR expires_at IS NULL);
        
        IF v_active_credits_count >= v_config.max_creditos_activos THEN
            RETURN;
        END IF;
    END IF;

    -- LÓGICA DE RECOMPRA (D)
    IF v_used_wallet_credit > 0 AND NOT COALESCE(v_config.genera_credito_sobre_credito, FALSE) THEN
        RETURN;
    END IF;

    -- Determinar porcentaje
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

    -- Calcular monto inicial
    v_earn_amount := floor(v_plates_value * (v_perc / 100));
    
    -- Aplicar tope por pedido
    IF v_max IS NOT NULL AND v_earn_amount > v_max THEN
        v_earn_amount := v_max;
    END IF;

    -- Ajustar monto si excede el límite total por usuario
    IF v_config.max_ganancia_usuario IS NOT NULL THEN
        IF (v_total_earned_by_user + v_earn_amount) > v_config.max_ganancia_usuario THEN
            v_earn_amount := v_config.max_ganancia_usuario - v_total_earned_by_user;
        END IF;
    END IF;

    IF v_earn_amount <= 0 THEN
        RETURN;
    END IF;

    -- Calcular vencimiento
    IF v_tipo_vencimiento = 'dinamica' THEN
        v_expires_at := (CURRENT_DATE + (v_expiry || ' days')::INTERVAL + INTERVAL '0 days 23:59:59');
    ELSE
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
