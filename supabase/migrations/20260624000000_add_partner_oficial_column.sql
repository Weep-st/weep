-- Agregar columna partner_oficial_id a la tabla ciudades_config
ALTER TABLE public.ciudades_config 
ADD COLUMN IF NOT EXISTS partner_oficial_id TEXT REFERENCES public.repartidores(id) ON DELETE SET NULL;
