-- ═══════════════════════════════════════════════════
-- WEEP — Admin Panel Expansion: Driver Moderation
-- ═══════════════════════════════════════════════════

-- 1. Add admin_status to repartidores (similar to locales)
ALTER TABLE repartidores ADD COLUMN IF NOT EXISTS admin_status TEXT DEFAULT 'Pendiente';

-- 2. Update existing drivers to 'Aceptado' so they don't lose access
UPDATE repartidores SET admin_status = 'Aceptado' WHERE admin_status IS NULL;

-- 3. Ensure gestion_cobros has the necessary columns for driver payouts (already verified, but safety first)
ALTER TABLE gestion_cobros ADD COLUMN IF NOT EXISTS repartidor_id TEXT REFERENCES repartidores(id);
ALTER TABLE gestion_cobros ADD COLUMN IF NOT EXISTS comprobante_url TEXT;

-- 4. Update index for performance
CREATE INDEX IF NOT EXISTS idx_gestion_cobros_repartidor ON gestion_cobros(repartidor_id);
