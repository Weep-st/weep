-- ═══════════════════════════════════════════════════
-- MIGRACIÓN: CONFIGURACIÓN DE TARIFAS DE ENVÍO POR CIUDAD
-- Ejecutar en Supabase (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════

-- 1. Agregar columnas a ciudades_config
ALTER TABLE public.ciudades_config 
ADD COLUMN IF NOT EXISTS cobro_envio_tipo TEXT DEFAULT 'fijo',
ADD COLUMN IF NOT EXISTS cobro_envio_fijo_valor NUMERIC,
ADD COLUMN IF NOT EXISTS cobro_envio_base_valor NUMERIC,
ADD COLUMN IF NOT EXISTS cobro_envio_por_km_valor NUMERIC;

-- 2. Establecer valores por defecto iniciales para las ciudades existentes
UPDATE public.ciudades_config 
SET cobro_envio_tipo = 'fijo', cobro_envio_fijo_valor = 2000 
WHERE cobro_envio_fijo_valor IS NULL;
