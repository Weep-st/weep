-- ═══════════════════════════════════════════════════
-- WALLET FEATURE: Database-Level FIFO Active Balance
-- ═══════════════════════════════════════════════════

-- 1. Redefine get_applicable_wallet_balance to calculate chronological FIFO balance
CREATE OR REPLACE FUNCTION public.get_applicable_wallet_balance(p_user_id TEXT, p_local_id TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v_uso_local_exclusivo BOOLEAN;
    v_balance NUMERIC := 0;
    r RECORD;
    r_dep RECORD;
    v_remaining NUMERIC;
    v_deduct NUMERIC;
BEGIN
    -- Get the applicable config (Local or Global)
    SELECT uso_local_exclusivo INTO v_uso_local_exclusivo 
    FROM public.wallet_config_locales 
    WHERE (local_id = p_local_id OR local_id IS NULL) AND activo = TRUE
    ORDER BY local_id NULLS LAST LIMIT 1;

    -- Default to FALSE if null
    v_uso_local_exclusivo := COALESCE(v_uso_local_exclusivo, FALSE);

    -- Create a temporary table to store active deposits
    CREATE TEMP TABLE IF NOT EXISTS temp_active_deposits (
        id SERIAL,
        amount NUMERIC,
        expires_at TIMESTAMPTZ
    ) ON COMMIT DROP;
    
    TRUNCATE temp_active_deposits;

    -- Process all transactions chronologically (FIFO)
    FOR r IN (
        SELECT type, amount, expires_at 
        FROM public.wallet_transactions 
        WHERE user_id = p_user_id 
          AND (NOT v_uso_local_exclusivo OR local_id = p_local_id)
        ORDER BY created_at ASC, id ASC
    ) LOOP
        IF r.type IN ('earn', 'refund', 'admin_adjustment') THEN
            INSERT INTO temp_active_deposits (amount, expires_at)
            VALUES (r.amount, r.expires_at);
        ELSIF r.type IN ('spend', 'expire') THEN
            v_remaining := r.amount;
            FOR r_dep IN (
                SELECT id, amount 
                FROM temp_active_deposits 
                WHERE amount > 0 
                ORDER BY id ASC
            ) LOOP
                EXIT WHEN v_remaining <= 0;
                v_deduct := LEAST(r_dep.amount, v_remaining);
                
                UPDATE temp_active_deposits 
                SET amount = amount - v_deduct 
                WHERE id = r_dep.id;
                
                v_remaining := v_remaining - v_deduct;
            END LOOP;
        END IF;
    END LOOP;

    -- Sum all active deposits that have not expired at the current time (NOW())
    SELECT COALESCE(SUM(amount), 0) INTO v_balance
    FROM temp_active_deposits
    WHERE amount > 0 AND (expires_at IS NULL OR expires_at > NOW());

    RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Redefine get_wallet_balance_v1 to use the new FIFO logic
CREATE OR REPLACE FUNCTION public.get_wallet_balance_v1(p_user_id TEXT)
RETURNS NUMERIC AS $$
BEGIN
    RETURN public.get_applicable_wallet_balance(p_user_id, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Redefine spend_wallet_credit to ensure spending is based on active FIFO balance
CREATE OR REPLACE FUNCTION public.spend_wallet_credit(p_user_id TEXT, p_amount NUMERIC, p_order_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_balance NUMERIC;
BEGIN
    v_balance := public.get_applicable_wallet_balance(p_user_id, NULL);
    
    IF v_balance IS NULL OR v_balance < p_amount THEN
        RETURN FALSE;
    END IF;
    
    INSERT INTO public.wallet_transactions (user_id, type, amount, order_id, description)
    VALUES (p_user_id, 'spend', p_amount, p_order_id, 'Uso de crédito en pedido #' || p_order_id);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant access to the anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_applicable_wallet_balance(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_applicable_wallet_balance(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_wallet_balance_v1(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_wallet_balance_v1(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_wallet_credit(TEXT, NUMERIC, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.spend_wallet_credit(TEXT, NUMERIC, TEXT) TO authenticated;
