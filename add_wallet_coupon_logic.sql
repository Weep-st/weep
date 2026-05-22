-- ═══════════════════════════════════════════════════
-- WEEP — Wallet Redeemable Coupons Migration
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.redeem_wallet_coupon(
  p_user_id TEXT,
  p_coupon_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_promo RECORD;
  v_expires_at TIMESTAMPTZ;
  v_already_redeemed BOOLEAN;
  v_usage_count INT;
  v_limit_uses INT;
  v_val NUMERIC;
  v_vencimiento_dias INT;
BEGIN
  -- 1. Buscar la promoción de tipo cupón con beneficio regalo_wallet (insensible a mayúsculas/minúsculas y espacios)
  SELECT * INTO v_promo 
  FROM public.promociones
  WHERE activo = TRUE 
    AND tipo = 'cupon'
    AND (beneficios->>'tipo_beneficio') = 'regalo_wallet'
    AND UPPER(TRIM(triggers->>'codigo_cupon')) = UPPER(TRIM(p_coupon_code))
  LIMIT 1;

  IF v_promo IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'El cupón no existe o no está habilitado para canje de saldo.');
  END IF;

  -- 2. Validar expiración de la promoción
  IF (v_promo.requisitos->>'fecha_expiracion') IS NOT NULL 
     AND (v_promo.requisitos->>'fecha_expiracion') <> '' 
     AND (v_promo.requisitos->>'fecha_expiracion')::TIMESTAMPTZ < NOW() THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Este cupón ha expirado.');
  END IF;

  -- 3. Validar si el usuario ya canjeó esta promoción (campaign_id = promo.id)
  SELECT EXISTS(
    SELECT 1 
    FROM public.wallet_transactions 
    WHERE user_id = p_user_id 
      AND campaign_id = v_promo.id
  ) INTO v_already_redeemed;

  IF v_already_redeemed THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Ya has canjeado este cupón anteriormente.');
  END IF;

  -- 4. Validar límite máximo de usos globales
  v_limit_uses := NULLIF(v_promo.limites->>'uso_total', '')::INT;
  IF v_limit_uses IS NOT NULL AND v_limit_uses > 0 THEN
    SELECT COUNT(*) INTO v_usage_count 
    FROM public.wallet_transactions 
    WHERE campaign_id = v_promo.id;

    IF v_usage_count >= v_limit_uses THEN
      RETURN jsonb_build_object('success', FALSE, 'message', 'Este cupón ha alcanzado su límite de usos permitido.');
    END IF;
  END IF;

  -- 5. Calcular valor y vencimiento
  v_val := COALESCE((v_promo.beneficios->>'valor')::NUMERIC, 0);
  IF v_val <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'El cupón no posee un valor de saldo válido.');
  END IF;

  v_vencimiento_dias := COALESCE(NULLIF(v_promo.requisitos->>'vencimiento_dias', '')::INT, 7);
  v_expires_at := NOW() + (v_vencimiento_dias || ' days')::INTERVAL;

  -- 6. Insertar transacción en la billetera
  INSERT INTO public.wallet_transactions (
    user_id,
    type,
    amount,
    campaign_id,
    description,
    expires_at
  ) VALUES (
    p_user_id,
    'earn',
    v_val,
    v_promo.id,
    'Regalo por cupón ' || UPPER(TRIM(p_coupon_code)),
    v_expires_at
  );

  RETURN jsonb_build_object(
    'success', TRUE, 
    'message', '¡Canje exitoso! Se cargó el saldo en tu billetera.', 
    'amount', v_val
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
