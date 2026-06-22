-- 1. Añadir columna para rastrear el tiempo exacto en que entra en Pendiente de Pago
ALTER TABLE public.pedidos_general ADD COLUMN IF NOT EXISTS pago_pendiente_at TIMESTAMPTZ;

-- 2. Función para el Trigger
CREATE OR REPLACE FUNCTION public.fn_track_pago_pendiente_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Si el estado cambia a 'Pendiente de Pago', registramos el momento
    IF (NEW.estado = 'Pendiente de Pago' AND (OLD.estado IS NULL OR OLD.estado <> 'Pendiente de Pago')) THEN
        NEW.pago_pendiente_at := NOW();
    END IF;
    
    -- Si el estado deja de ser 'Pendiente de Pago', podemos limpiar la columna (opcional, pero útil para reintentos)
    IF (OLD.estado = 'Pendiente de Pago' AND NEW.estado <> 'Pendiente de Pago') THEN
        NEW.pago_pendiente_at := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Crear el Trigger
DROP TRIGGER IF EXISTS trg_track_pago_pendiente ON public.pedidos_general;
CREATE TRIGGER trg_track_pago_pendiente
BEFORE INSERT OR UPDATE ON public.pedidos_general
FOR EACH ROW
EXECUTE FUNCTION public.fn_track_pago_pendiente_status();

-- 4. Inicializar datos para pedidos existentes (opcional)
UPDATE public.pedidos_general 
SET pago_pendiente_at = created_at 
WHERE estado = 'Pendiente de Pago' AND pago_pendiente_at IS NULL;
