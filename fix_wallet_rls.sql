-- ═══════════════════════════════════════════════════
-- WALLET RLS FIX: Allow system as secure execution
-- ═══════════════════════════════════════════════════

-- Ensure RLS is enabled but policies allow the user to see their own data
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own transactions" ON public.wallet_transactions;
CREATE POLICY "Users can view their own transactions" ON public.wallet_transactions 
FOR SELECT USING (auth.uid()::text = user_id);

-- Allow admins/system to insert transactions
DROP POLICY IF EXISTS "System can insert transactions" ON public.wallet_transactions;
CREATE POLICY "System can insert transactions" ON public.wallet_transactions 
FOR INSERT WITH CHECK (TRUE); 

-- Wallets RLS
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own wallet" ON public.user_wallets;
CREATE POLICY "Users can view their own wallet" ON public.user_wallets 
FOR SELECT USING (auth.uid()::text = user_id);

-- Allow updates to wallets from the trigger system
DROP POLICY IF EXISTS "System can manage wallets" ON public.user_wallets;
CREATE POLICY "System can manage wallets" ON public.user_wallets 
FOR ALL USING (TRUE) WITH CHECK (TRUE);
