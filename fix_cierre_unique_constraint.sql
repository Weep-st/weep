-- Eliminar la restricción de unicidad para permitir múltiples cierres por día
-- (Útil para locales que cierran de madrugada y luego al final del día siguiente)
ALTER TABLE cierre_caja DROP CONSTRAINT IF EXISTS cierre_caja_local_id_fecha_key;

-- Si se creó como un índice único manual, también lo eliminamos
DROP INDEX IF EXISTS idx_cierre_caja_local_fecha_unique;
