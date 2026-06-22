-- ═══════════════════════════════════════════════════
-- AGREGAR onesignal_id A LA TABLA DE USUARIOS
-- ═══════════════════════════════════════════════════

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS onesignal_id TEXT;
CREATE INDEX IF NOT EXISTS idx_usuarios_onesignal_id ON usuarios(onesignal_id);
