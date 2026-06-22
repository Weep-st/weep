-- ═══════════════════════════════════════════════════
-- MIGRACIÓN: LOCALES SPONSOR Y BONOS SEMANALES (AISLADO MUNDIAL 2026)
-- Ejecutar en Supabase (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════

-- 1. Revertir columnas directas en locales y menu si se hubieran creado
ALTER TABLE public.locales DROP COLUMN IF EXISTS es_sponsor_mundial;
ALTER TABLE public.menu DROP COLUMN IF EXISTS es_combo_mundial;

-- 2. Agregar columnas de configuración a mundial_config
ALTER TABLE public.mundial_config 
ADD COLUMN IF NOT EXISTS pts_pedido_normal INT DEFAULT 250,
ADD COLUMN IF NOT EXISTS sobres_pedido_normal INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS pts_pedido_sponsor INT DEFAULT 400,
ADD COLUMN IF NOT EXISTS sobres_pedido_sponsor INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS pts_combo_mundialista INT DEFAULT 500,
ADD COLUMN IF NOT EXISTS sobres_combo_mundialista INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS pts_combo_sponsor INT DEFAULT 700,
ADD COLUMN IF NOT EXISTS sobres_combo_sponsor INT DEFAULT 2,
ADD COLUMN IF NOT EXISTS pts_doblete_semanal INT DEFAULT 300,
ADD COLUMN IF NOT EXISTS pts_triplete_semanal INT DEFAULT 600;

-- Asegurar que la configuración global tenga valores no nulos
UPDATE public.mundial_config 
SET 
  pts_pedido_normal = COALESCE(pts_pedido_normal, 250),
  sobres_pedido_normal = COALESCE(sobres_pedido_normal, 0),
  pts_pedido_sponsor = COALESCE(pts_pedido_sponsor, 400),
  sobres_pedido_sponsor = COALESCE(sobres_pedido_sponsor, 1),
  pts_combo_mundialista = COALESCE(pts_combo_mundialista, 500),
  sobres_combo_mundialista = COALESCE(sobres_combo_mundialista, 1),
  pts_combo_sponsor = COALESCE(pts_combo_sponsor, 700),
  sobres_combo_sponsor = COALESCE(sobres_combo_sponsor, 2),
  pts_doblete_semanal = COALESCE(pts_doblete_semanal, 300),
  pts_triplete_semanal = COALESCE(pts_triplete_semanal, 600)
WHERE id = 'global';

-- 3. Crear tablas para Sponsors y Combos aislados
CREATE TABLE IF NOT EXISTS public.mundial_sponsors_locales (
    local_id TEXT PRIMARY KEY REFERENCES public.locales(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mundial_combos_productos (
    menu_id TEXT PRIMARY KEY REFERENCES public.menu(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deshabilitar RLS para que coincida con el resto de las tablas de la campaña
ALTER TABLE IF EXISTS public.mundial_sponsors_locales DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mundial_combos_productos DISABLE ROW LEVEL SECURITY;

-- 4. Agregar columnas de control de bonos semanales a mundial_usuario_stats
ALTER TABLE public.mundial_usuario_stats 
ADD COLUMN IF NOT EXISTS ultimo_doblete_semana TEXT,
ADD COLUMN IF NOT EXISTS ultimo_triplete_semana TEXT;
