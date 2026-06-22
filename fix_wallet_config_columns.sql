-- Ensure all columns used by the Admin Panel exist in the wallet_config_locales table
-- This prevents "400 Bad Request" if the frontend sends fields that the DB doesn't have.

ALTER TABLE public.wallet_config_locales 
ADD COLUMN IF NOT EXISTS max_ganancia_usuario NUMERIC,
ADD COLUMN IF NOT EXISTS max_pedidos_generar INTEGER,
ADD COLUMN IF NOT EXISTS solo_primera_compra BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS max_creditos_activos INTEGER;

-- Refresh constraints just in case
ALTER TABLE public.wallet_config_locales 
DROP CONSTRAINT IF EXISTS unique_local_wallet_config;

ALTER TABLE public.wallet_config_locales 
ADD CONSTRAINT unique_local_wallet_config UNIQUE (local_id);
