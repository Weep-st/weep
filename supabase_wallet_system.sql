-- ═══════════════════════════════════════════════════
-- WALLET SYSTEM: Credits, Transactions and Campaigns
-- ═══════════════════════════════════════════════════

-- 0. Update Core Order Table (Optional but recommended for tracking)
ALTER TABLE public.pedidos_general ADD COLUMN IF NOT EXISTS credito_wallet NUMERIC DEFAULT 0;
ALTER TABLE public.pedidos_locales ADD COLUMN IF NOT EXISTS credito_wallet NUMERIC DEFAULT 0;

-- 1. Create Wallets Table
CREATE TABLE IF NOT EXISTS public.user_wallets (
    user_id TEXT PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
    balance NUMERIC NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT positive_balance CHECK (balance >= 0)
);

-- Row Level Security for Wallets
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own wallet" ON public.user_wallets;
CREATE POLICY "Users can view their own wallet" ON public.user_wallets FOR SELECT USING (auth.uid()::text = user_id);

-- 2. Create Wallet Transactions Table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'expire', 'refund', 'admin_adjustment')),
    amount NUMERIC NOT NULL,
    order_id TEXT REFERENCES public.pedidos_general(id) ON DELETE SET NULL,
    campaign_id UUID, -- Optional: link to campaign
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ -- Optional: date when this specific credit expires
);

-- Index for performance
CREATE INDEX idx_wallet_transactions_user ON public.wallet_transactions(user_id);

-- 3. Create Wallet Campaigns Table
CREATE TABLE IF NOT EXISTS public.wallet_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
    value NUMERIC NOT NULL, -- % or fixed amount
    min_order_amount NUMERIC DEFAULT 0,
    max_cap NUMERIC DEFAULT NULL, -- Added: Maximum credit to earn per order
    max_usage_percentage NUMERIC DEFAULT 30, -- Covering up to X% of the order
    expiry_days INTEGER DEFAULT 7,
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Function to Update Wallet Balance
CREATE OR REPLACE FUNCTION public.update_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_wallets (user_id, balance, last_updated)
    VALUES (NEW.user_id, NEW.amount, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET balance = public.user_wallets.balance + CASE 
        WHEN NEW.type IN ('earn', 'refund', 'admin_adjustment') THEN NEW.amount
        ELSE -NEW.amount
    END,
    last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_wallet_balance ON public.wallet_transactions;
CREATE TRIGGER trigger_update_wallet_balance
AFTER INSERT ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_wallet_balance();

-- 5. Helper Function to earn credit post-order (DYNAMIC)
CREATE OR REPLACE FUNCTION public.earn_wallet_credit_from_order(p_order_id TEXT)
RETURNS VOID AS $$
DECLARE
    v_user_id TEXT;
    v_plates_value NUMERIC;
    v_campaign RECORD;
    v_earn_amount NUMERIC;
    -- Defaults requested by user
    v_perc NUMERIC := 5; 
    v_max NUMERIC := 500;
    v_min NUMERIC := 8000;
    v_expiry INTEGER := 5;
BEGIN
    SELECT usuario_id INTO v_user_id FROM public.pedidos_general WHERE id = p_order_id;
    
    -- Calculate value of "plates" only (sum of items)
    SELECT COALESCE(SUM(precio * cantidad), 0) INTO v_plates_value 
    FROM public.pedidos_items 
    WHERE pedido_id = p_order_id;
    
    -- Try to find an active "earn" campaign
    SELECT * INTO v_campaign FROM public.wallet_campaigns 
    WHERE active = TRUE AND (end_date IS NULL OR end_date > NOW())
    ORDER BY created_at DESC LIMIT 1;

    -- If campaign exists, use its values
    IF v_campaign IS NOT NULL THEN
        v_perc := v_campaign.value;
        v_min := v_campaign.min_order_amount;
        v_expiry := v_campaign.expiry_days;
        IF v_campaign.max_cap IS NOT NULL THEN
            v_max := v_campaign.max_cap;
        END IF;
    END IF;

    IF v_user_id IS NOT NULL AND v_plates_value >= v_min THEN
        v_earn_amount := floor(v_plates_value * (v_perc / 100));
        
        -- Apply cap
        IF v_earn_amount > v_max THEN
            v_earn_amount := v_max;
        END IF;
        
        INSERT INTO public.wallet_transactions (user_id, type, amount, order_id, description, expires_at)
        VALUES (v_user_id, 'earn', v_earn_amount, p_order_id, 'Reintegro por pedido #' || p_order_id, NOW() + (v_expiry || ' days')::INTERVAL);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC to spend wallet credit
CREATE OR REPLACE FUNCTION public.spend_wallet_credit(p_user_id TEXT, p_amount NUMERIC, p_order_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_balance NUMERIC;
BEGIN
    SELECT balance INTO v_balance FROM public.user_wallets WHERE user_id = p_user_id;
    
    IF v_balance IS NULL OR v_balance < p_amount THEN
        RETURN FALSE;
    END IF;
    
    INSERT INTO public.wallet_transactions (user_id, type, amount, order_id, description)
    VALUES (p_user_id, 'spend', p_amount, p_order_id, 'Uso de crédito en pedido #' || p_order_id);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
