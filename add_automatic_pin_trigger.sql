-- ==============================================================================
-- WEEP - Generación Automática y Resiliente de PINs (num_confirmacion)
-- ==============================================================================

-- 1. Crear la función del trigger para asegurar que num_confirmacion NUNCA sea NULL
CREATE OR REPLACE FUNCTION public.ensure_num_confirmacion()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el PIN de confirmación es nulo o vacío, generamos uno automáticamente de 4 dígitos (1000-9999)
  IF NEW.num_confirmacion IS NULL OR NEW.num_confirmacion = '' THEN
    NEW.num_confirmacion := floor(random() * 9000 + 1000)::TEXT;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Vincular el trigger a la tabla pedidos_general para que se ejecute ANTES de cada inserción
DROP TRIGGER IF EXISTS trg_ensure_num_confirmacion ON public.pedidos_general;
CREATE TRIGGER trg_ensure_num_confirmacion
BEFORE INSERT ON public.pedidos_general
FOR EACH ROW
EXECUTE FUNCTION public.ensure_num_confirmacion();

-- 3. MIGRACIÓN: Corregir y completar los pedidos históricos que tengan el PIN vacío o nulo
UPDATE public.pedidos_general
SET num_confirmacion = floor(random() * 9000 + 1000)::TEXT
WHERE num_confirmacion IS NULL OR num_confirmacion = '';
