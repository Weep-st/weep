-- Migration: Add tipo_servicio to locales
-- Run this in your Supabase SQL Editor

ALTER TABLE public.locales 
ADD COLUMN IF NOT EXISTS tipo_servicio VARCHAR(50) DEFAULT 'delivery';

COMMENT ON COLUMN public.locales.tipo_servicio IS 'Define si el local es "delivery" (comidas, farmacias) o "shops" (tiendas de ropa, juguetes, regalos, etc.)';
