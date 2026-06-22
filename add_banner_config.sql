-- ==============================================================================
-- WEPI - Agregar Columnas de Banner y Enlaces de Misiones a Campaña Mundialista 2026
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase.
-- ==============================================================================

-- 1. Agregar columnas para Banner a la tabla mundial_config
ALTER TABLE public.mundial_config ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE public.mundial_config ADD COLUMN IF NOT EXISTS banner_link TEXT;

-- 2. Agregar columna para Enlace Externo a la tabla de misiones mundial_misiones
ALTER TABLE public.mundial_misiones ADD COLUMN IF NOT EXISTS enlace_url TEXT;

-- 3. Actualizar la restricción de tipos de misiones para incluir 'link_verificacion'
ALTER TABLE public.mundial_misiones DROP CONSTRAINT IF EXISTS mundial_misiones_tipo_check;
ALTER TABLE public.mundial_misiones ADD CONSTRAINT mundial_misiones_tipo_check 
CHECK (tipo IN ('pedido', 'pronostico', 'login_diario', 'imagen_verificacion', 'minijuego_penales', 'minijuego_trivia', 'link_verificacion'));
