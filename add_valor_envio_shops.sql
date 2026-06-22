-- Migration: Add valor_envio_shops to configuracion table
-- Run this in your Supabase SQL Editor

ALTER TABLE public.configuracion
ADD COLUMN IF NOT EXISTS valor_envio_shops NUMERIC DEFAULT 2000;

COMMENT ON COLUMN public.configuracion.valor_envio_shops IS 'Costo de envío base para la rama de Shops';
