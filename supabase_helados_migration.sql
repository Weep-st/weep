-- ═══════════════════════════════════════════════════
-- WEEP — Ice Cream Flavors Table
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS helado_sabores (
  id SERIAL PRIMARY KEY,
  local_id TEXT NOT NULL REFERENCES locales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  disponible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Security)
ALTER TABLE helado_sabores ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public read for flavors" ON helado_sabores
  FOR SELECT USING (true);

CREATE POLICY "Allow local owners to manage flavors" ON helado_sabores
  FOR ALL USING (true); -- Simplified for now, can be restricted by auth.uid() if needed
