-- ═══════════════════════════════════════════════════
-- WALLET FEATURE: Local-Specific Usage Restriction
-- ═══════════════════════════════════════════════════

-- 1. Add 'uso_local_exclusivo' to configuration
ALTER TABLE public.wallet_config_locales 
ADD COLUMN IF NOT EXISTS uso_local_exclusivo BOOLEAN DEFAULT FALSE;

-- 2. Add 'local_id' to transactions for tracking origin
ALTER TABLE public.wallet_transactions 
ADD COLUMN IF NOT EXISTS local_id TEXT REFERENCES public.locales(id) ON DELETE SET NULL;

-- 3. Update the transaction trigger to include local_id automatically
-- This ensures that when a transaction is created from an order, we know the local.
CREATE OR REPLACE FUNCTION public.update_wallet_transaction_local()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_id IS NOT NULL AND NEW.local_id IS NULL THEN
        SELECT local_id INTO NEW.local_id FROM public.pedidos_general WHERE id = NEW.order_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_set_transaction_local ON public.wallet_transactions;
CREATE TRIGGER trigger_set_transaction_local
BEFORE INSERT ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_wallet_transaction_local();

-- 4. RPC to get applicable balance based on local restriction
CREATE OR REPLACE FUNCTION public.get_applicable_wallet_balance(p_user_id TEXT, p_local_id TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v_uso_local_exclusivo BOOLEAN;
    v_balance NUMERIC;
BEGIN
    -- Check if the current local has usage restriction
    SELECT uso_local_exclusivo INTO v_uso_local_exclusivo 
    FROM public.wallet_config_locales 
    WHERE (local_id = p_local_id OR local_id IS NULL) AND activo = TRUE
    ORDER BY local_id NULLS LAST LIMIT 1;

    IF COALESCE(v_uso_local_exclusivo, FALSE) = TRUE THEN
        -- Sum only transactions for this local
        SELECT SUM(
            CASE 
                WHEN type IN ('earn', 'refund', 'admin_adjustment') THEN amount 
                ELSE -amount 
            END
        ) INTO v_balance
        FROM public.wallet_transactions
        WHERE user_id = p_user_id AND (local_id = p_local_id);
    ELSE
        -- Return total balance from the wallet table
        SELECT balance INTO v_balance FROM public.user_wallets WHERE user_id = p_user_id;
    END IF;

    RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_applicable_wallet_balance(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_applicable_wallet_balance(TEXT, TEXT) TO authenticated;
