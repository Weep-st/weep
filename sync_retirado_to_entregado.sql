-- ==============================================================================
-- WEEP - Sincronización Automática de Estado 'Retirado' -> 'Entregado'
-- ==============================================================================
-- Objetivo: Cuando un repartidor marca un pedido como 'Retirado' en la tabla
-- pedidos_general, el estado del pedido en la tabla pedidos_locales debe cambiar
-- automáticamente a 'Entregado' (solo para pedidos con envío).
-- Además, sincroniza los estados 'Cancelado' y 'Rechazado' de forma automática.
-- ==============================================================================

-- 1. Crear o reemplazar la función controladora del trigger para pedidos_general
CREATE OR REPLACE FUNCTION public.handle_retirado_status_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Sincronizar estado 'Retirado' -> 'Entregado' para pedidos con envío
    -- NEW.tipo_entrega debe ser 'Con Envío' (valor exacto usado en el sistema)
    IF (NEW.estado = 'Retirado') THEN
        -- Solo aplicamos si es un pedido con envío y no está ya entregado
        IF (NEW.tipo_entrega = 'Con Envío') THEN
            UPDATE public.pedidos_locales 
            SET estado = 'Entregado' 
            WHERE pedido_id = NEW.id 
              AND (estado IS NULL OR estado <> 'Entregado');
        END IF;
    END IF;

    -- 2. Sincronizar estados 'Cancelado' o 'Rechazado' en pedidos_locales
    IF (NEW.estado IN ('Cancelado', 'Rechazado')) THEN
        UPDATE public.pedidos_locales 
        SET estado = NEW.estado 
        WHERE pedido_id = NEW.id 
          AND (estado IS NULL OR estado <> NEW.estado);
    END IF;

    -- 3. Sincronizar estado 'Confirmado' en pedidos_locales para impresión automática y dashboard
    -- Se dispara siempre que NEW.estado sea 'Confirmado', asegurando que pedidos_locales se actualice
    -- si está en cualquier otro estado diferente, previniendo discrepancias.
    IF (NEW.estado = 'Confirmado') THEN
        UPDATE public.pedidos_locales 
        SET estado = 'Confirmado' 
        WHERE pedido_id = NEW.id 
          AND (estado IS NULL OR estado <> 'Confirmado');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Crear el trigger en la tabla pedidos_general
DROP TRIGGER IF EXISTS trg_sync_retirado_to_entregado ON public.pedidos_general;
CREATE TRIGGER trg_sync_retirado_to_entregado
AFTER UPDATE ON public.pedidos_general
FOR EACH ROW
EXECUTE FUNCTION public.handle_retirado_status_sync();

-- ==============================================================================
-- NUEVO: Sincronización en Sentido Inverso (pedidos_locales -> pedidos_general)
-- ==============================================================================
-- Objetivo: Si pedidos_general ya está en estado 'Confirmado' (o Cancelado/Rechazado/Retirado),
-- cualquier inserción o actualización en pedidos_locales para ese pedido se fuerza
-- al estado correspondiente. Esto previene condiciones de carrera causadas por el orden de inserción
-- en transacciones o actualizaciones directas desde pasarelas de pago.

-- 3. Crear o reemplazar la función para la tabla pedidos_locales
CREATE OR REPLACE FUNCTION public.handle_pedidos_locales_status_sync()
RETURNS TRIGGER AS $$
DECLARE
    v_general_estado TEXT;
    v_general_tipo_entrega TEXT;
BEGIN
    -- Obtener el estado y tipo de entrega actuales de pedidos_general
    SELECT estado, tipo_entrega INTO v_general_estado, v_general_tipo_entrega 
    FROM public.pedidos_general 
    WHERE id = NEW.pedido_id;

    IF v_general_estado IS NOT NULL THEN
        -- Si pedidos_general ya está 'Confirmado', pedidos_locales DEBE ser 'Confirmado'
        IF (v_general_estado = 'Confirmado') THEN
            NEW.estado := 'Confirmado';
        -- Si pedidos_general ya está 'Cancelado' o 'Rechazado', forzarlo
        ELSIF (v_general_estado IN ('Cancelado', 'Rechazado')) THEN
            NEW.estado := v_general_estado;
        -- Si pedidos_general ya está 'Retirado' y es con envío, forzarlo a 'Entregado'
        ELSIF (v_general_estado = 'Retirado' AND v_general_tipo_entrega = 'Con Envío') THEN
            NEW.estado := 'Entregado';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Crear el trigger BEFORE INSERT OR UPDATE en la tabla pedidos_locales
DROP TRIGGER IF EXISTS trg_sync_locales_status_sync ON public.pedidos_locales;
CREATE TRIGGER trg_sync_locales_status_sync
BEFORE INSERT OR UPDATE ON public.pedidos_locales
FOR EACH ROW
EXECUTE FUNCTION public.handle_pedidos_locales_status_sync();

-- Comentario informativo para el usuario:
-- Este script asegura que la sincronización sea inmediata a nivel de base de datos,
-- sin depender de la lógica del cliente (React) para esta actualización cruzada.
