-- ═══════════════════════════════════════════════════
-- MIGRACIÓN: MISIONES AVANZADAS, REGISTRO DE FOTOS Y RANKING
-- Ejecutar en Supabase (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════

-- 1. Actualizar la restricción de tipo de misión para incluir pedido_producto, pedido_categoria y pedido_rubro
ALTER TABLE public.mundial_misiones DROP CONSTRAINT IF EXISTS mundial_misiones_tipo_check;
ALTER TABLE public.mundial_misiones ADD CONSTRAINT mundial_misiones_tipo_check 
CHECK (tipo IN ('pedido', 'pedido_producto', 'pedido_categoria', 'pedido_rubro', 'pronostico', 'login_diario', 'imagen_verificacion', 'minijuego_penales', 'minijuego_trivia', 'link_verificacion'));

-- 2. Agregar columnas de segmentación, rango de tiempo y premio de figurita a mundial_misiones
ALTER TABLE public.mundial_misiones 
ADD COLUMN IF NOT EXISTS target_producto_id TEXT,
ADD COLUMN IF NOT EXISTS target_categoria TEXT,
ADD COLUMN IF NOT EXISTS target_rubro TEXT,
ADD COLUMN IF NOT EXISTS activo_desde TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS activo_hasta TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS figurita_premio_nro INT;

-- 3. Agregar columnas para control de comprobante y estado de verificación en misiones completadas
ALTER TABLE public.mundial_misiones_usuarios 
ADD COLUMN IF NOT EXISTS comprobante_url TEXT,
ADD COLUMN IF NOT EXISTS verificado BOOLEAN DEFAULT TRUE;
