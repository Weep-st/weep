-- ═══════════════════════════════════════════════════
-- MIGRACIÓN: PLAN DE EXPANSIÓN MULTI-CIUDAD (SANTO TOMÉ & OBERÁ)
-- Ejecutar en Supabase (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════

-- 1. Agregar columna 'ciudad' a la tabla de usuarios
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS ciudad TEXT DEFAULT 'Santo Tomé';

-- 2. Agregar columna 'ciudad' a la tabla de locales
ALTER TABLE public.locales 
ADD COLUMN IF NOT EXISTS ciudad TEXT DEFAULT 'Santo Tomé';

-- 3. Agregar columna 'ciudad' a la tabla de repartidores
ALTER TABLE public.repartidores 
ADD COLUMN IF NOT EXISTS ciudad TEXT DEFAULT 'Santo Tomé';

-- 4. Asegurar que los registros existentes tengan asignada la ciudad histórica
UPDATE public.usuarios SET ciudad = 'Santo Tomé' WHERE ciudad IS NULL;
UPDATE public.locales SET ciudad = 'Santo Tomé' WHERE ciudad IS NULL;
UPDATE public.repartidores SET ciudad = 'Santo Tomé' WHERE ciudad IS NULL;

-- 5. Crear índice para optimizar las consultas filtradas por ciudad
CREATE INDEX IF NOT EXISTS idx_locales_ciudad ON public.locales(ciudad);
CREATE INDEX IF NOT EXISTS idx_usuarios_ciudad ON public.usuarios(ciudad);
CREATE INDEX IF NOT EXISTS idx_repartidores_ciudad ON public.repartidores(ciudad);
