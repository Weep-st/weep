-- ═══════════════════════════════════════════════════
-- MIGRACIÓN: REGLAS DE ENVÍO PARA OBERÁ Y OTRAS CIUDADES
-- Ejecutar en Supabase (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════

-- 1. Agregar columnas de configuración de entrega por ciudad
ALTER TABLE public.ciudades_config 
ADD COLUMN IF NOT EXISTS city_slug TEXT,
ADD COLUMN IF NOT EXISTS center_name TEXT,
ADD COLUMN IF NOT EXISTS center_lat NUMERIC,
ADD COLUMN IF NOT EXISTS center_lng NUMERIC,
ADD COLUMN IF NOT EXISTS base_radius_km NUMERIC DEFAULT 2,
ADD COLUMN IF NOT EXISTS min_delivery_fee NUMERIC DEFAULT 2500,
ADD COLUMN IF NOT EXISTS extra_fee_per_km NUMERIC DEFAULT 200,
ADD COLUMN IF NOT EXISTS max_delivery_distance_km NUMERIC DEFAULT 8;

-- 2. Crear tabla para caché de geocodificación de direcciones
CREATE TABLE IF NOT EXISTS public.delivery_address_cache (
    id BIGSERIAL PRIMARY KEY,
    city_slug TEXT NOT NULL,
    normalized_address TEXT NOT NULL,
    lat NUMERIC NOT NULL,
    lng NUMERIC NOT NULL,
    formatted_address TEXT,
    google_place_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    usage_count INTEGER DEFAULT 1
);

-- Índices de búsqueda para la caché
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_address_cache_slug_address 
ON public.delivery_address_cache(city_slug, normalized_address);

-- Habilitar permisos públicos/RSL para las tablas si aplica (o acceso directo por clave anon)
ALTER TABLE public.delivery_address_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a anon y authenticated" ON public.delivery_address_cache;
CREATE POLICY "Permitir todo a anon y authenticated" ON public.delivery_address_cache
    FOR ALL USING (true) WITH CHECK (true);

-- 3. Crear tabla para logs de uso de Google API
CREATE TABLE IF NOT EXISTS public.google_api_usage_logs (
    id BIGSERIAL PRIMARY KEY,
    api_name TEXT NOT NULL,
    city_slug TEXT,
    context TEXT,
    cache_hit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.google_api_usage_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir insertar a anon y authenticated" ON public.google_api_usage_logs;
CREATE POLICY "Permitir insertar a anon y authenticated" ON public.google_api_usage_logs
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir leer a anon y authenticated" ON public.google_api_usage_logs
    FOR SELECT USING (true);

-- 4. Establecer configuraciones iniciales para las ciudades
-- Oberá
UPDATE public.ciudades_config 
SET 
  city_slug = 'obera',
  center_name = 'Centro Cívico Oberá',
  center_lat = -27.48561,
  center_lng = -55.12495,
  base_radius_km = 2,
  min_delivery_fee = 2500,
  extra_fee_per_km = 200,
  max_delivery_distance_km = 8
WHERE ciudad = 'Oberá';

-- Santo Tomé
UPDATE public.ciudades_config 
SET 
  city_slug = 'santo-tome',
  center_name = 'Plaza San Martín Santo Tomé',
  center_lat = -28.54891,
  center_lng = -56.04112,
  base_radius_km = 2,
  min_delivery_fee = 2000,
  extra_fee_per_km = 0,
  max_delivery_distance_km = 10
WHERE ciudad = 'Santo Tomé';
