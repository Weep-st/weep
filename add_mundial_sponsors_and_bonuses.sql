-- ═══════════════════════════════════════════════════
-- MIGRACIÓN: LOCALES SPONSOR Y BONOS SEMANALES
-- Ejecutar en Supabase (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════

-- 1. Agregar columnas de configuración a mundial_config
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

-- 2. Agregar columna 'es_sponsor_mundial' a locales
ALTER TABLE public.locales 
ADD COLUMN IF NOT EXISTS es_sponsor_mundial BOOLEAN DEFAULT FALSE;

-- 3. Agregar columna 'es_combo_mundial' a menu
ALTER TABLE public.menu 
ADD COLUMN IF NOT EXISTS es_combo_mundial BOOLEAN DEFAULT FALSE;

-- 4. Agregar columnas de control de bonos semanales a mundial_usuario_stats
ALTER TABLE public.mundial_usuario_stats 
ADD COLUMN IF NOT EXISTS ultimo_doblete_semana TEXT,
ADD COLUMN IF NOT EXISTS ultimo_triplete_semana TEXT;
