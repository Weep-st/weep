-- ==============================================================================
-- WEEP - Sincronización Automática de Estado 'Retirado' -> 'Entregado'
-- ==============================================================================
-- Objetivo: Cuando un repartidor marca un pedido como 'Retirado' en la tabla
-- pedidos_general, el estado del pedido en la tabla pedidos_locales debe cambiar
-- automáticamente a 'Entregado' (solo para pedidos con envío).
-- ==============================================================================

-- 1. Crear o reemplazar la función controladora del trigger
CREATE OR REPLACE FUNCTION public.handle_retirado_status_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- Verificar si el estado cambió a 'Retirado'
    -- NEW.tipo_entrega debe ser 'Con Envío' (valor exacto usado en el sistema)
    IF (NEW.estado = 'Retirado' AND (OLD.estado IS NULL OR OLD.estado <> 'Retirado')) THEN
        -- Solo aplicamos si es un pedido con envío
        IF (NEW.tipo_entrega = 'Con Envío') THEN
            -- Actualizar pedidos_locales para que el restaurante vea el pedido como completado/entregado
            UPDATE public.pedidos_locales 
            SET estado = 'Entregado' 
            WHERE pedido_id = NEW.id;
        END IF;
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

-- Comentario informativo para el usuario:
-- Este script asegura que la sincronización sea inmediata a nivel de base de datos,
-- sin depender de la lógica del cliente (React) para esta actualización cruzada.
