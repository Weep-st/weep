-- ==============================================================================
-- WEEP - Parche para Zona Horaria Argentina en Panel
-- Ejecutar en el Editor SQL de Supabase
-- ==============================================================================

-- 1. Actualizamos la función del CRON para que `NOW()` esté forzado a -3 horas (Argentina)
-- Así empatará con el horario que el JavaScript está guardando engañando a UTC.
CREATE OR REPLACE FUNCTION public.fn_check_inactive_drivers()
RETURNS void AS $$
DECLARE
  v_now_arg TIMESTAMP;
BEGIN
  -- Calcular el tiempo actual en Argentina (UTC -3) para emparejar con los registros del Frontend
  v_now_arg := NOW() - INTERVAL '3 hours';

  UPDATE public.repartidores
  SET estado = 'Inactivo'
  WHERE estado = 'Activo' 
    AND (sesion_vence_en IS NOT NULL AND sesion_vence_en <= v_now_arg)
     OR (ultima_interaccion_ui IS NOT NULL AND ultima_interaccion_ui <= v_now_arg - INTERVAL '30 minutes');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
