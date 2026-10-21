-- ══════════════════════════════════════════════════════════════════════════════
-- FIX: Error al rechazar pedidos en /locales:
-- "invalid input syntax for type uuid: USR-AC3A39C1"
-- ══════════════════════════════════════════════════════════════════════════════
-- Causa:
-- En el archivo `supabase_prevent_invalid_reject.sql`, se definieron dos triggers:
-- 1) `trigger_prevent_customer_invalid_reject_locales` en `pedidos_locales` que
--    declaró `v_usuario_id UUID` y ejecutó `SELECT usuario_id INTO v_usuario_id FROM pedidos_general`.
--    Como en Wepi los IDs de usuario son texto (ej. "USR-AC3A39C1"), PostgreSQL
--    falla al intentar convertir ese texto a UUID.
-- 2) `trigger_prevent_customer_invalid_reject` y `trg_state_sentinel` en `pedidos_general`
--    que comparan `auth.uid() = usuario_id`, donde `auth.uid()` es UUID y `usuario_id`
--    es TEXT (formato "USR-..."), lo que también dispara el error de sintaxis UUID.
--
-- Solución:
-- 1) Eliminar el trigger innecesario de `pedidos_locales` (el cliente nunca actualiza esta tabla).
-- 2) Eliminar el trigger conflictivo de `pedidos_general`.
-- 3) Actualizar `check_order_state_transition_local()` y `check_order_state_transition_general()`
--    con validación de tipos correcta y segura.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. ELIMINAR TRIGGERS Y FUNCIONES CONFLICTIVAS DE `supabase_prevent_invalid_reject.sql`
DROP TRIGGER IF EXISTS trigger_prevent_customer_invalid_reject_locales ON public.pedidos_locales;
DROP FUNCTION IF EXISTS public.prevent_customer_invalid_reject_locales();

DROP TRIGGER IF EXISTS trigger_prevent_customer_invalid_reject ON public.pedidos_general;
DROP FUNCTION IF EXISTS public.prevent_customer_invalid_reject();


-- 2. REGLAS PARA `pedidos_locales` (Los comercios pueden rechazar en cualquier momento previo a entrega)
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


-- 3. REGLAS PARA `pedidos_general` (Protección contra cancelación del cliente si ya fue aceptado)
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
        -- Si hay una sesión de Supabase Auth activa
        IF (auth.uid() IS NOT NULL) THEN
            -- Comprobar si el usuario actual es el cliente dueño del pedido (comparando con usuarios.auth_id UUID)
            IF EXISTS (
                SELECT 1 FROM public.usuarios 
                WHERE id = OLD.usuario_id 
                  AND auth_id = auth.uid()
            ) THEN
                -- Excepción: si además es dueño/administrador de un local (pedido de prueba), permitir el rechazo
                IF NOT EXISTS (
                    SELECT 1 FROM public.locales 
                    WHERE auth_id = auth.uid() OR id = OLD.usuario_id
                ) THEN
                    -- Es cliente normal: bloquear la cancelación
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
