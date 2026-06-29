-- Agregar campos SKU y Código de barras a la tabla menu
ALTER TABLE menu ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS codigo_barras TEXT;

-- Crear la restricción única compuesta
ALTER TABLE menu DROP CONSTRAINT IF EXISTS unique_local_sku;
ALTER TABLE menu ADD CONSTRAINT unique_local_sku UNIQUE (local_id, sku);

-- Agregar la columna de configuración de sincronización a la tabla locales
ALTER TABLE locales ADD COLUMN IF NOT EXISTS sync_config_data JSONB DEFAULT '{}'::jsonb;
