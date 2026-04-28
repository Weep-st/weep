-- 1. Create a function to fetch wallet balance securely bypassing RLS
-- This is necessary because the app uses custom Auth (usuarios table) instead of Supabase Auth.
CREATE OR REPLACE FUNCTION public.get_wallet_balance_v1(p_user_id TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v_balance NUMERIC;
BEGIN
    SELECT balance INTO v_balance FROM public.user_wallets WHERE user_id = p_user_id;
    RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Grant access to the anon role
GRANT EXECUTE ON FUNCTION public.get_wallet_balance_v1(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_wallet_balance_v1(TEXT) TO authenticated;

-- 3. (Optional but recommended) Fix RLS for select if you still want to allow direct table queries
-- Note: This is less secure but works for custom auth if you don't want to use RPC for everything.
-- DROP POLICY IF EXISTS "Users can view their own wallet" ON public.user_wallets;
-- CREATE POLICY "Allow anyone to read wallet if they know the ID" ON public.user_wallets 
-- FOR SELECT USING (TRUE); 
