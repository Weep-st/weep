-- ─── 1. Add missing columns to gestion_cobros ───
ALTER TABLE gestion_cobros ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'Solicitud';
ALTER TABLE gestion_cobros ADD COLUMN IF NOT EXISTS comprobante_url TEXT;

-- ─── 2. Ensure indices (optional but good) ───
CREATE INDEX IF NOT EXISTS idx_gestion_cobros_tipo ON gestion_cobros(tipo);
