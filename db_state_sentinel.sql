-- ==============================================================================
-- WEEP - Sentinel de Estados (Seguro Anti-Regresión)
-- Evita que pedidos en estados finales o avanzados vuelvan a estados iniciales.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.check_order_state_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Definir estados finales (bloqueo absoluto de cambios de estado)
    IF (OLD.estado IN ('Entregado', 'Cancelado', 'Rechazado')) THEN
        -- Si intentan cambiar el estado, lo revertimos al valor anterior
        IF (NEW.estado IS DISTINCT FROM OLD.estado) THEN
            NEW.estado := OLD.estado;
        END IF;
        RETURN NEW;
    END IF;

    -- 2. Evitar regresiones de estados avanzados a iniciales
    -- Si el pedido ya está en camino o listo, no puede volver a 'Confirmado' o 'Pendiente'
    IF (OLD.estado IN ('Listo', 'Retirado', 'En camino') AND NEW.estado IN ('Confirmado', 'Pendiente', 'Pendiente de Pago', 'Buscando Repartidor')) THEN
        NEW.estado := OLD.estado;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a pedidos_general
DROP TRIGGER IF EXISTS trg_state_sentinel ON public.pedidos_general;
CREATE TRIGGER trg_state_sentinel
BEFORE UPDATE OF estado ON public.pedidos_general
FOR EACH ROW
EXECUTE FUNCTION public.check_order_state_transition();

-- Aplicar a pedidos_locales (para sincronía total)
DROP TRIGGER IF EXISTS trg_state_sentinel_local ON public.pedidos_locales;
CREATE TRIGGER trg_state_sentinel_local
BEFORE UPDATE OF estado ON public.pedidos_locales
FOR EACH ROW
EXECUTE FUNCTION public.check_order_state_transition();
