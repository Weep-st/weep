-- ==============================================================================
-- WEPI - Migración de Tabla public.wepi_ads para Wepi Ads
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.wepi_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  imagenes TEXT[] DEFAULT '{}',
  contacto_url TEXT,
  contacto_texto TEXT DEFAULT 'Contactar por WhatsApp',
  precio TEXT,
  ubicacion TEXT,
  categoria TEXT DEFAULT 'Otros',
  activo BOOLEAN DEFAULT TRUE,
  posicion INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar que la columna de categoría existe por si la tabla ya había sido creada antes
ALTER TABLE public.wepi_ads ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'Otros';

-- 1. Habilitar Row Level Security (RLS)
ALTER TABLE public.wepi_ads ENABLE ROW LEVEL SECURITY;

-- 2. Permitir que cualquier usuario (incluyendo anónimos) pueda consultar anuncios activos
DROP POLICY IF EXISTS "Anyone can view active ads" ON public.wepi_ads;
CREATE POLICY "Anyone can view active ads" ON public.wepi_ads
  FOR SELECT USING (activo = TRUE);

-- 3. Permitir gestión total para administradores (en el backend / con claves de servicio)
DROP POLICY IF EXISTS "Admins can manage ads" ON public.wepi_ads;
CREATE POLICY "Admins can manage ads" ON public.wepi_ads
  FOR ALL USING (TRUE);
