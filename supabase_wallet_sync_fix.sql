-- ═══════════════════════════════════════════════════
-- WALLET EARN SYSTEM: Data-Driven Refinement
-- Sincroniza el crédito ganado con el motor de promociones
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.earn_wallet_credit_from_order(p_order_id TEXT)
RETURNS VOID AS $$
DECLARE
    v_user_id TEXT;
    v_ganancia NUMERIC;
    v_promos JSONB;
    v_vencimiento_dias INTEGER := 7;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- 1. Obtener datos del pedido (Fuente de verdad: lo que calculó el motor en el checkout)
    SELECT usuario_id, ganancia_credito, promociones_aplicadas
    INTO v_user_id, v_ganancia, v_promos
    FROM public.pedidos_general
    WHERE id = p_order_id;

    -- 2. Validaciones básicas: si no hay ganancia o el usuario no existe, salimos.
    IF v_user_id IS NULL OR v_ganancia IS NULL OR v_ganancia <= 0 THEN
        RETURN;
    END IF;

    -- 3. Evitar duplicidad: No acreditar dos veces el mismo pedido.
    IF EXISTS (SELECT 1 FROM public.wallet_transactions WHERE order_id = p_order_id AND type = 'earn') THEN
        RETURN;
    END IF;

    -- 4. Determinar vencimiento basado en la promoción aplicada (Buscamos la promo de crédito)
    IF v_promos IS NOT NULL AND jsonb_array_length(v_promos) > 0 THEN
        SELECT (requisitos->>'vencimiento_dias')::INTEGER INTO v_vencimiento_dias
        FROM public.promociones
        WHERE id::TEXT IN (SELECT jsonb_array_elements_text(v_promos))
        AND tipo = 'credito'
        LIMIT 1;
    END IF;

    -- Fallback si no se encontró config en la promo o el campo estaba vacío
    IF v_vencimiento_dias IS NULL THEN v_vencimiento_dias := 7; END IF;

    -- Calculamos la fecha exacta de expiración
    v_expires_at := NOW() + (v_vencimiento_dias || ' days')::INTERVAL;

    -- 5. Insertar transacción en el historial
    INSERT INTO public.wallet_transactions (
        user_id, type, amount, order_id, description, expires_at, created_at
    ) VALUES (
        v_user_id, 
        'earn', 
        v_ganancia, 
        p_order_id, 
        'Crédito ganado por pedido #' || p_order_id, 
        v_expires_at,
        NOW()
    );

    -- Nota: Ya no actualizamos public.usuarios directamente para evitar errores 
    -- de columnas inexistentes y favorecer el cálculo dinámico de transacciones.

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
