-- Migration to add delivery configuration columns to locales
ALTER TABLE locales ADD COLUMN IF NOT EXISTS acepta_retiro BOOLEAN DEFAULT TRUE;
ALTER TABLE locales ADD COLUMN IF NOT EXISTS acepta_envio BOOLEAN DEFAULT TRUE;

-- Update existing records just in case
UPDATE locales SET acepta_retiro = TRUE WHERE acepta_retiro IS NULL;
UPDATE locales SET acepta_envio = TRUE WHERE acepta_envio IS NULL;
