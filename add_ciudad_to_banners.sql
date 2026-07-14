-- ==============================================================================
-- WEPI - Agregar Columna Ciudad a la tabla de Banners
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase.
-- ==============================================================================

ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS ciudad TEXT DEFAULT NULL;
