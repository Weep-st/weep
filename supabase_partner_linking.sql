-- ==============================================================================
-- MIGRACIÓN: VINCULACIÓN DE REPARTIDORES A PARTNERS POR PIN Y SOCIO OFICIAL
-- Ejecutar en el SQL Editor de Supabase
-- ==============================================================================

-- 1. Agregar columnas a la tabla de repartidores
ALTER TABLE public.repartidores 
ADD COLUMN IF NOT EXISTS partner_pin TEXT,
ADD COLUMN IF NOT EXISTS partner_vinculo_status TEXT DEFAULT 'Ninguno', -- 'Ninguno', 'Pendiente', 'Aceptado', 'Rechazado'
ADD COLUMN IF NOT EXISTS partner_vinculo_solicitado_id TEXT;

-- 2. Crear un índice para búsquedas rápidas por PIN de vinculación
CREATE INDEX IF NOT EXISTS idx_repartidores_partner_pin ON public.repartidores(partner_pin) WHERE es_partner = true;

-- 3. Agregar columna partner_oficial_id a la tabla ciudades_config
ALTER TABLE public.ciudades_config 
ADD COLUMN IF NOT EXISTS partner_oficial_id TEXT REFERENCES public.repartidores(id) ON DELETE SET NULL;
