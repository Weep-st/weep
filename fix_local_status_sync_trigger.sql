-- ═══════════════════════════════════════════════════
-- CORRECCIÓN: FIX DE SINCRONIZACIÓN DE ESTADO EN PEDIDOS LOCALES
-- Ejecutar en Supabase (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════

-- 1. Reemplazar la función de sincronización de la tabla pedidos_locales
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
        -- Si pedidos_general ya está 'Cancelado' o 'Rechazado', forzarlo
        IF (v_general_estado IN ('Cancelado', 'Rechazado')) THEN
            NEW.estado := v_general_estado;
        -- Si pedidos_general ya está 'Retirado' y es con envío, forzarlo a 'Entregado'
        ELSIF (v_general_estado = 'Retirado' AND v_general_tipo_entrega = 'Con Envío') THEN
            NEW.estado := 'Entregado';
        -- En inserciones nuevas, si el general ya está confirmado, inicializarlo como confirmado
        ELSIF (TG_OP = 'INSERT' AND v_general_estado = 'Confirmado') THEN
            NEW.estado := 'Confirmado';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Asegurar que el trigger BEFORE INSERT OR UPDATE esté recreado en la tabla pedidos_locales
DROP TRIGGER IF EXISTS trg_sync_locales_status_sync ON public.pedidos_locales;
CREATE TRIGGER trg_sync_locales_status_sync
BEFORE INSERT OR UPDATE ON public.pedidos_locales
FOR EACH ROW
EXECUTE FUNCTION public.handle_pedidos_locales_status_sync();
