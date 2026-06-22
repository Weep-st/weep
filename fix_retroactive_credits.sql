-- ═══════════════════════════════════════════════════
-- FIX: Retroactive Credit for Past Delivered Orders
-- ═══════════════════════════════════════════════════

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Recorrer todos los pedidos entregados
    FOR r IN SELECT id FROM public.pedidos_general WHERE estado = 'Entregado' LOOP
        -- Verificar si ya tiene transacción de 'earn' para este pedido (evitar duplicados)
        IF NOT EXISTS (SELECT 1 FROM public.wallet_transactions WHERE user_id = (SELECT usuario_id FROM public.pedidos_general WHERE id = r.id) AND metadata->>'order_id' = r.id AND type = 'earn') THEN
            PERFORM public.earn_wallet_credit_from_order(r.id);
        END IF;
    END LOOP;
END $$;
