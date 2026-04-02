-- ═══════════════════════════════════════════════════
-- AGREGAR onesignal_id A LA TABLA DE REPARTIDORES
-- ═══════════════════════════════════════════════════

ALTER TABLE repartidores ADD COLUMN IF NOT EXISTS onesignal_id TEXT;
CREATE INDEX IF NOT EXISTS idx_repartidores_onesignal_id ON repartidores(onesignal_id);
