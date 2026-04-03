-- ==============================================================================
-- WEEP - Forzar Husos Horarios a Nivel Servidor
-- Ejecutar en el Editor SQL de Supabase
-- ==============================================================================

-- 1. Crear la funcion que interceptara cualquier intento de escritura
-- de horario de los repartidores y la reescribira forzosamente a -3 horas
CREATE OR REPLACE FUNCTION public.fn_force_argentina_time_repartidores()
RETURNS trigger AS $$
BEGIN
  -- Si el frontend actualiza la ultima actividad, forzamos -3 horas reales.
  IF NEW.ultima_actividad IS DISTINCT FROM OLD.ultima_actividad THEN
    NEW.ultima_actividad := NOW() - INTERVAL '3 hours';
  END IF;

  IF NEW.ultima_conexion IS DISTINCT FROM OLD.ultima_conexion THEN
    NEW.ultima_conexion := NOW() - INTERVAL '3 hours';
  END IF;

  IF NEW.ultima_interaccion_ui IS DISTINCT FROM OLD.ultima_interaccion_ui THEN
    NEW.ultima_interaccion_ui := NOW() - INTERVAL '3 hours';
  END IF;

  -- Para la sesion, ya que se calcula "en el futuro", no le aplicamos esta resta automatica 
  -- para no romper el algoritmo que le suma tiempo, solo a los marcadores "now".
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Eliminar si existia previamente para evitar dobles trigers
DROP TRIGGER IF EXISTS trg_force_arg_time ON public.repartidores;

-- 3. Crear el Trigger a nivel de tabla
CREATE TRIGGER trg_force_arg_time
BEFORE UPDATE ON public.repartidores
FOR EACH ROW
EXECUTE FUNCTION public.fn_force_argentina_time_repartidores();
