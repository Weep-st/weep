-- Añadir columnas de gestión de stock a la tabla menu
ALTER TABLE menu ADD COLUMN IF NOT EXISTS maneja_stock BOOLEAN DEFAULT false;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS stock_actual INTEGER DEFAULT 0;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS stock_minimo INTEGER DEFAULT 10;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS stock_base_id TEXT;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS unidades_por_venta INTEGER DEFAULT 1;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS ultima_confirmacion_stock TIMESTAMPTZ;

-- Comentario para legibilidad
COMMENT ON COLUMN menu.stock_base_id IS 'ID del ítem que centraliza el stock físico para este pack/producto';
