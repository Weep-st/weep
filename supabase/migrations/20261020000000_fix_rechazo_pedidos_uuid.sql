-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Corrección de error de tipo UUID en rechazo de pedidos
-- "invalid input syntax for type uuid: USR-AC3A39C1"
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Eliminar triggers conflictivos que usan UUID para comparar IDs de usuarios con formato 'USR-...'
DROP TRIGGER IF EXISTS trigger_prevent_customer_invalid_reject_locales ON public.pedidos_locales;
DROP FUNCTION IF EXISTS public.prevent_customer_invalid_reject_locales();

DROP TRIGGER IF EXISTS trigger_prevent_customer_invalid_reject ON public.pedidos_general;
DROP FUNCTION IF EXISTS public.prevent_customer_invalid_reject();


-- 2. Asegurar centinela en pedidos_locales sin referencias a usuario_id
CREATE OR REPLACE FUNCTION public.check_order_state_transition_local()
RETURNS TRIGGER AS $$
BEGIN
    -- Regla A: Estados finales inmutables
    IF (OLD.estado IN ('Entregado', 'Cancelado', 'Rechazado')) THEN
        IF (NEW.estado IS DISTINCT FROM OLD.estado) THEN
            NEW.estado := OLD.estado;
        END IF;
        RETURN NEW;
    END IF;

    -- Regla B: Anti-regresión (no volver de estados avanzados a iniciales)
    IF (OLD.estado IN ('Listo', 'Retirado', 'En camino') AND NEW.estado IN ('Confirmado', 'Pendiente', 'Pendiente de Pago', 'Buscando Repartidor')) THEN
        NEW.estado := OLD.estado;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_state_sentinel_local ON public.pedidos_locales;
CREATE TRIGGER trg_state_sentinel_local
BEFORE UPDATE OF estado ON public.pedidos_locales
FOR EACH ROW
EXECUTE FUNCTION public.check_order_state_transition_local();


-- 3. Centinela en pedidos_general con tipado seguro
CREATE OR REPLACE FUNCTION public.check_order_state_transition_general()
RETURNS TRIGGER AS $$
BEGIN
    -- Regla A: Estados finales inmutables
    IF (OLD.estado IN ('Entregado', 'Cancelado', 'Rechazado')) THEN
        IF (NEW.estado IS DISTINCT FROM OLD.estado) THEN
            NEW.estado := OLD.estado;
        END IF;
        RETURN NEW;
    END IF;

    -- Regla B: Anti-regresión
    IF (OLD.estado IN ('Listo', 'Retirado', 'En camino') AND NEW.estado IN ('Confirmado', 'Pendiente', 'Pendiente de Pago', 'Buscando Repartidor')) THEN
        NEW.estado := OLD.estado;
        RETURN NEW;
    END IF;

    -- Regla C: Bloqueo de cancelación por parte del cliente si ya está Confirmado/Aceptado/Preparando.
    -- (Los locales y admins sí pueden rechazarlo libremente).
    IF (OLD.estado IN ('Confirmado', 'Aceptado', 'Preparando') AND NEW.estado IN ('Rechazado', 'Cancelado')) THEN
        IF (auth.uid() IS NOT NULL) THEN
            IF EXISTS (
                SELECT 1 FROM public.usuarios 
                WHERE id = OLD.usuario_id 
                  AND auth_id = auth.uid()
            ) THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.locales 
                    WHERE auth_id = auth.uid() OR id = OLD.usuario_id
                ) THEN
                    NEW.estado := OLD.estado;
                    RETURN NEW;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_state_sentinel ON public.pedidos_general;
CREATE TRIGGER trg_state_sentinel
BEFORE UPDATE OF estado ON public.pedidos_general
FOR EACH ROW
EXECUTE FUNCTION public.check_order_state_transition_general();
