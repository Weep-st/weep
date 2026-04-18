-- ==============================================================================
-- WEEP - Corrección Definitiva de Confirmación de Pagos
-- Reemplaza la lógica anterior para asegurar la transición a 'Confirmado'
-- ==============================================================================

-- 1. Actualizar la función RPC principal para confirmación de pagos
CREATE OR REPLACE FUNCTION public.marcar_pedido_pagado(
    p_pedido_id text,
    p_payment_id text,
    p_preference_id text DEFAULT NULL::text,
    p_external_reference text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Actualizar el pedido en la tabla general
    UPDATE public.pedidos_general
    SET 
        estado = 'Confirmado',
        payment_id = p_payment_id,
        preference_id = COALESCE(p_preference_id, preference_id),
        external_reference = COALESCE(p_external_reference, external_reference),
        fecha_pago = NOW()
    WHERE id = p_pedido_id;

    -- Actualizar el pedido en la tabla local para que el restaurante vea 'Confirmado'
    UPDATE public.pedidos_locales
    SET estado = 'Confirmado'
    WHERE pedido_id = p_pedido_id;
END;
$$;

-- 2. Trigger de Backup Robusto (Si el estado es Pendiente de Pago y se asigna un ID de pago)
CREATE OR REPLACE FUNCTION public.handle_payment_confirmation()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.payment_id IS NOT NULL AND NEW.estado = 'Pendiente de Pago') THEN
    UPDATE public.pedidos_locales SET estado = 'Confirmado' WHERE pedido_id = NEW.id;
    NEW.estado := 'Confirmado';
    IF (NEW.fecha_pago IS NULL) THEN
      NEW.fecha_pago := NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_confirm_order_on_payment ON public.pedidos_general;
CREATE TRIGGER trg_confirm_order_on_payment
BEFORE UPDATE ON public.pedidos_general
FOR EACH ROW
EXECUTE FUNCTION public.handle_payment_confirmation();
