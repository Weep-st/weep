-- ==============================================================================
-- WEPI - Agregar Columna de Sobres de Regalo a Misiones de Campaña Mundialista 2026
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase.
-- ==============================================================================

-- 1. Agregar columna para Sobres de Premio a la tabla mundial_misiones
ALTER TABLE public.mundial_misiones ADD COLUMN IF NOT EXISTS sobres_premio INTEGER DEFAULT 0;

-- 2. Recargar caché de la API (por si acaso)
NOTIFY pgrst, 'reload schema';
