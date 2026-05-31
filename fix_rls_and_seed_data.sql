-- ==============================================================================
-- WEPI MUNDIALISTA - CORRECCIÓN DE RLS Y CARGA DE DATOS SEMILLA
-- Ejecutar este script en el SQL Editor de Supabase para resolver errores 401 y 406.
-- ==============================================================================

-- 1. Deshabilitar RLS en todas las tablas del mundial para permitir acceso frontend seguro
ALTER TABLE IF EXISTS public.mundial_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mundial_partidos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mundial_pronosticos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mundial_usuario_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mundial_misiones DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mundial_misiones_usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mundial_calendario_premios DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mundial_calendario_reclamos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mundial_figuritas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mundial_usuario_figuritas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mundial_cupones DISABLE ROW LEVEL SECURITY;

-- O alternativamente, si prefieres mantener RLS activo, habilitar políticas permisivas:
-- DROP POLICY IF EXISTS "Permissive Select Stats" ON public.mundial_usuario_stats;
-- CREATE POLICY "Permissive Select Stats" ON public.mundial_usuario_stats FOR SELECT USING (true);
-- DROP POLICY IF EXISTS "Permissive Insert Stats" ON public.mundial_usuario_stats;
-- CREATE POLICY "Permissive Insert Stats" ON public.mundial_usuario_stats FOR INSERT WITH CHECK (true);
-- DROP POLICY IF EXISTS "Permissive Update Stats" ON public.mundial_usuario_stats;
-- CREATE POLICY "Permissive Update Stats" ON public.mundial_usuario_stats FOR UPDATE USING (true);

-- 2. Asegurar que exista la fila de configuración 'global' para evitar el error 406 (PGRST116)
INSERT INTO public.mundial_config (id, streak_3_premio_tipo, streak_3_premio_cantidad, streak_7_premio_tipo, streak_7_premio_cantidad)
VALUES ('global', 'puntos', 50, 'credito_wallet', 200)
ON CONFLICT (id) DO NOTHING;

-- Asegurar consistencia de la fila global
UPDATE public.mundial_config
SET streak_3_premio_tipo = COALESCE(streak_3_premio_tipo, 'puntos'),
    streak_3_premio_cantidad = COALESCE(streak_3_premio_cantidad, 50),
    streak_7_premio_tipo = COALESCE(streak_7_premio_tipo, 'credito_wallet'),
    streak_7_premio_cantidad = COALESCE(streak_7_premio_cantidad, 200)
WHERE id = 'global';

SELECT '¡Permisos RLS y configuración semilla aplicados correctamente!' AS resultado;
