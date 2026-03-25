-- ═══════════════════════════════════════════════════
-- WEEP — Add Terms & Privacy Confirmation Columns
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- ─── 1. Update 'usuarios' table ───
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS privacy_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS terms_version TEXT DEFAULT 'v1';

-- ─── 2. Update 'locales' table ───
ALTER TABLE locales ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE locales ADD COLUMN IF NOT EXISTS privacy_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE locales ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE locales ADD COLUMN IF NOT EXISTS terms_version TEXT DEFAULT 'v1';

-- ─── 3. Update 'repartidores' table ───
ALTER TABLE repartidores ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE repartidores ADD COLUMN IF NOT EXISTS privacy_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE repartidores ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE repartidores ADD COLUMN IF NOT EXISTS terms_version TEXT DEFAULT 'v1';
