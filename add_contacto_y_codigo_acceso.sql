-- Migration to add contacto to locales and registration access code to global configuration

-- 1. Add contacto to locales
ALTER TABLE locales ADD COLUMN IF NOT EXISTS contacto TEXT;

-- 2. Add codigo_acceso to configuracion
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS codigo_acceso TEXT DEFAULT 'WEPI123';

-- 3. Populate existing global configuration with default access code if it's null
UPDATE configuracion SET codigo_acceso = 'WEPI123' WHERE id = 'global' AND codigo_acceso IS NULL;
