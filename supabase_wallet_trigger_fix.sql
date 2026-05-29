-- ═══════════════════════════════════════════════════
-- TRIGGER: Automatic Credit Earning on Delivery
-- ═══════════════════════════════════════════════════

-- Función de trigger para llamar a earn_wallet_credit_from_order
CREATE OR REPLACE FUNCTION public.on_pedido_entregado_earn_credit()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo actuar cuando el estado cambia a 'Entregado'
    IF (NEW.estado = 'Entregado' AND (OLD.estado IS NULL OR OLD.estado != 'Entregado')) THEN
        -- Ejecutar la lógica de reintegro
        PERFORM public.earn_wallet_credit_from_order(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el trigger en pedidos_general
DROP TRIGGER IF EXISTS trigger_on_pedido_entregado ON public.pedidos_general;
CREATE TRIGGER trigger_on_pedido_entregado
AFTER UPDATE OF estado ON public.pedidos_general
FOR EACH ROW
EXECUTE FUNCTION public.on_pedido_entregado_earn_credit();

-- ═══════════════════════════════════════════════════
-- SEED: Default Global Configuration
-- ═══════════════════════════════════════════════════

-- Insertar una configuración global por defecto si no existe ninguna
-- Esto asegura que el sistema funcione de inmediato con un 10% de reintegro base.
INSERT INTO public.wallet_config_locales (
    local_id, 
    activo, 
    porcentaje_ganancia, 
    tope_maximo_ganancia, 
    compra_minima_generar, 
    duracion_dias, 
    tipo_vencimiento,
    objetivo
)
SELECT NULL, TRUE, 10, 1500, 1000, 7, 'fija', 'activacion'
WHERE NOT EXISTS (SELECT 1 FROM public.wallet_config_locales);
