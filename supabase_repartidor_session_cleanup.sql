-- ==============================================================================
-- WEEP - Limpieza Automática de Sesiones Exhaustas de Repartidores
-- Este script asegura que los repartidores pasen a estado 'Inactivo' apenas
-- su sesión expire, incluso si no tienen la aplicación abierta.
-- ==============================================================================

-- 1. Función que realiza la limpieza
CREATE OR REPLACE FUNCTION public.fn_cleanup_expired_driver_sessions()
RETURNS void AS $$
BEGIN
  -- Marcar como Inactivos a todos los repartidores cuya sesión haya vencido
  -- y que actualmente figuren como 'Activo' u 'Ocupado' (opcional, pero seguro).
  -- Nota: Si está 'Ocupado' quizás convenga esperar, pero el usuario pidió "si o si".
  -- Para ser más amigables, solo inactivamos a los que están 'Activo'.
  UPDATE public.repartidores 
  SET estado = 'Inactivo'
  WHERE (estado = 'Activo' OR estado = 'Ocupado')
    AND sesion_vence_en IS NOT NULL 
    AND sesion_vence_en <= (NOW() - INTERVAL '3 hours');

  RAISE NOTICE 'Limpieza de sesiones de repartidores completada.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Programar el CRON JOB (cada 1 minuto)
DO $$
  BEGIN
    PERFORM cron.unschedule('cleanup_driver_sessions_job');
  EXCEPTION WHEN OTHERS THEN
    -- El job no existía
  END;
$$;

SELECT cron.schedule(
  'cleanup_driver_sessions_job',
  '* * * * *', -- Cada 1 minuto
  'SELECT public.fn_cleanup_expired_driver_sessions();'
);
