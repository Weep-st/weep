-- ═══════════════════════════════════════════════════
-- WEEP — Discounts & Banners Migration
-- ═══════════════════════════════════════════════════

-- ─── 1. Update locales table ───
ALTER TABLE locales ADD COLUMN IF NOT EXISTS dias_descuento TEXT[] DEFAULT '{}';
ALTER TABLE locales ADD COLUMN IF NOT EXISTS descuento_general INTEGER DEFAULT 0;

-- ─── 2. Update menu table ───
ALTER TABLE menu ADD COLUMN IF NOT EXISTS descuento NUMERIC(12,2) DEFAULT 0;

-- ─── 3. Create banners table ───
CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imagen_url TEXT NOT NULL,
  link TEXT,
  activo BOOLEAN DEFAULT TRUE,
  posicion INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 4. Initial placeholder banner (Optional) ───
-- INSERT INTO banners (imagen_url, link, activo, posicion) 
-- VALUES ('https://placehold.co/1200x400/e63946/white?text=Bienvidos+a+Weep', '/', true, 1);

-- ─── 5. Enable RLS for banners (Optional, based on project style) ───
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read active banners
DROP POLICY IF EXISTS "Anyone can view active banners" ON banners;
CREATE POLICY "Anyone can view active banners" ON banners
FOR SELECT USING (activo = TRUE);

-- Only admins can manage banners (Assuming "role" column in auth or profiles)
-- This depends on the system's auth logic. For now, we'll keep it simple or follow existing patterns.
DROP POLICY IF EXISTS "Admins can manage banners" ON banners;
CREATE POLICY "Admins can manage banners" ON banners
FOR ALL USING (TRUE); -- Usually restricted by API keys or custom claims in Supabase
