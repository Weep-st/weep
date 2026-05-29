-- ═══════════════════════════════════════════════════
-- FIX: Strict Wallet Balance and Local Enforcement
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_applicable_wallet_balance(p_user_id TEXT, p_local_id TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v_uso_local_exclusivo BOOLEAN;
    v_balance NUMERIC;
BEGIN
    -- 1. Get the applicable config (Local or Global)
    -- We filter by active = TRUE to ensure only enabled configs are used.
    SELECT uso_local_exclusivo INTO v_uso_local_exclusivo 
    FROM public.wallet_config_locales 
    WHERE (local_id = p_local_id OR local_id IS NULL) AND activo = TRUE
    ORDER BY local_id NULLS LAST LIMIT 1;

    -- 2. If NO configuration exists for this local context, return 0.
    -- This prevents using credits in locals that haven't opted into the wallet system.
    IF v_uso_local_exclusivo IS NULL THEN
        RETURN 0;
    END IF;

    -- 3. If restriction is FALSE, return total balance
    IF v_uso_local_exclusivo = FALSE THEN
        SELECT balance INTO v_balance FROM public.user_wallets WHERE user_id = p_user_id;
    ELSE
        -- 4. If restricted, sum transactions for THIS local + transactions with NULL local_id (Global)
        SELECT SUM(
            CASE 
                WHEN type IN ('earn', 'refund', 'admin_adjustment') THEN amount 
                ELSE -amount 
            END
        ) INTO v_balance
        FROM public.wallet_transactions
        WHERE user_id = p_user_id 
          AND (local_id = p_local_id OR local_id IS NULL);
    END IF;

    RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
