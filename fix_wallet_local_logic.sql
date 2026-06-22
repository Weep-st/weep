-- ═══════════════════════════════════════════════════
-- FIX: Wallet Local Logic and Data Migration
-- ═══════════════════════════════════════════════════

-- 1. Migrate existing transactions to populate local_id
UPDATE public.wallet_transactions t
SET local_id = p.local_id
FROM public.pedidos_general p
WHERE t.order_id = p.id AND t.local_id IS NULL;

-- 2. Improved RPC to handle restriction correctly
CREATE OR REPLACE FUNCTION public.get_applicable_wallet_balance(p_user_id TEXT, p_local_id TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v_uso_local_exclusivo BOOLEAN;
    v_balance NUMERIC;
BEGIN
    -- 1. Get the applicable config (Local or Global)
    SELECT uso_local_exclusivo INTO v_uso_local_exclusivo 
    FROM public.wallet_config_locales 
    WHERE (local_id = p_local_id OR local_id IS NULL) AND activo = TRUE
    ORDER BY local_id NULLS LAST LIMIT 1;

    -- 2. If no config found or restriction is FALSE, return total balance
    IF v_uso_local_exclusivo IS NULL OR v_uso_local_exclusivo = FALSE THEN
        SELECT balance INTO v_balance FROM public.user_wallets WHERE user_id = p_user_id;
    ELSE
        -- 3. If restricted, sum transactions for THIS local + transactions with NULL local_id (Global)
        -- This ensures that global credits (e.g. admin adjustments or signup bonuses) are still usable.
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

-- 3. Ensure the trigger is active and correct
CREATE OR REPLACE FUNCTION public.update_wallet_transaction_local()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set local_id if it's currently NULL and we have an order_id
    IF NEW.order_id IS NOT NULL AND NEW.local_id IS NULL THEN
        SELECT local_id INTO NEW.local_id FROM public.pedidos_general WHERE id = NEW.order_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
