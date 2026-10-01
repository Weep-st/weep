ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS codigo_acceso_repartidores TEXT DEFAULT 'DRIVER123';
UPDATE configuracion SET codigo_acceso_repartidores = 'DRIVER123' WHERE id = 'global' AND codigo_acceso_repartidores IS NULL;
