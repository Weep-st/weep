-- ==============================================================================
-- WEPI - Desactivar RLS para Campaña Mundialista 2026
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase para corregir
-- el error de políticas de Row Level Security (401 Unauthorized / 42501).
-- ==============================================================================

ALTER TABLE IF EXISTS public.mundial_partidos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mundial_figuritas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mundial_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mundial_usuario_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mundial_pronosticos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mundial_misiones DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mundial_misiones_usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mundial_calendario_premios DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mundial_calendario_reclamos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mundial_usuario_figuritas DISABLE ROW LEVEL SECURITY;
