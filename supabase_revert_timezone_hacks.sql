-- ==============================================================================
-- WEEP - ROLLBACK DE HACKS DE HUSO HORARIO
-- Ejecutar en el Editor SQL de Supabase para arreglar el bug de desconexión
-- ==============================================================================

-- 1. Eliminar el Trigger problemático que desfasaba el reloj 3 horas atrás y causaba
-- que el CRON creyera que el piloto llevaba 3 horas inactivo instantáneamente.
DROP TRIGGER IF EXISTS trg_force_arg_time ON public.repartidores;
DROP FUNCTION IF EXISTS public.fn_force_argentina_time_repartidores();

-- 2. Restaurar la logica originaria, pura y saneada del CRON, operando todo en el 
-- tiempo UTC universal real.
CREATE OR REPLACE FUNCTION public.fn_check_inactive_drivers()
RETURNS void AS $$
BEGIN
  UPDATE public.repartidores
  SET estado = 'Inactivo'
  WHERE estado = 'Activo' 
    AND (
         (sesion_vence_en IS NOT NULL AND sesion_vence_en <= NOW())
      OR (ultima_interaccion_ui IS NOT NULL AND ultima_interaccion_ui <= NOW() - INTERVAL '30 minutes')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
