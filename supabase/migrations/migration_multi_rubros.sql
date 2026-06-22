-- 1. Añadir la columna rubros como array de texto
ALTER TABLE locales ADD COLUMN IF NOT EXISTS rubros text[] DEFAULT '{}';

-- 2. Migrar datos existentes de rubro (singular) a rubros (array)
UPDATE locales 
SET rubros = ARRAY[rubro] 
WHERE rubro IS NOT NULL AND (rubros IS NULL OR cardinality(rubros) = 0);

-- 3. Crear función para sincronizar rubro (singular) con el primer elemento de rubros (array)
CREATE OR REPLACE FUNCTION sync_local_rubro_singular()
RETURNS TRIGGER AS $$
BEGIN
    -- Si rubros cambió, actualizar rubro con el primer elemento
    IF (TG_OP = 'INSERT' OR OLD.rubros IS DISTINCT FROM NEW.rubros) THEN
        IF cardinality(NEW.rubros) > 0 THEN
            NEW.rubro = NEW.rubros[1];
        ELSE
            NEW.rubro = NULL;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Crear trigger para sincronizar rubro (singular) cuando cambie rubros (array)
DROP TRIGGER IF EXISTS trg_sync_rubro_singular ON locales;
CREATE TRIGGER trg_sync_rubro_singular
BEFORE INSERT OR UPDATE OF rubros ON locales
FOR EACH ROW
EXECUTE FUNCTION sync_local_rubro_singular();

-- 5. Crear función para sincronizar rubros (array) si se actualiza rubro (singular) por medios legados
CREATE OR REPLACE FUNCTION sync_local_rubros_array()
RETURNS TRIGGER AS $$
BEGIN
    -- Si rubro cambió pero rubros no, actualizar rubros con el nuevo rubro
    IF (OLD.rubro IS DISTINCT FROM NEW.rubro AND OLD.rubros IS NOT DISTINCT FROM NEW.rubros) THEN
        NEW.rubros = ARRAY[NEW.rubro];
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Crear trigger para sincronizar rubros (array) cuando cambie rubro (singular)
DROP TRIGGER IF EXISTS trg_sync_rubros_array ON locales;
CREATE TRIGGER trg_sync_rubros_array
BEFORE UPDATE OF rubro ON locales
FOR EACH ROW
EXECUTE FUNCTION sync_local_rubros_array();
