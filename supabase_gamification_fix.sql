-- ==============================================================================
-- WEEP - Corrección y Mejora del Sistema de Gamificación
-- ==============================================================================

-- 1. Asegurar que existe la columna order_id para evitar duplicidad de puntos
ALTER TABLE public.driver_points_log ADD COLUMN IF NOT EXISTS order_id TEXT;

-- 2. Función para procesar puntos por Entrega Realizada
CREATE OR REPLACE FUNCTION public.fn_process_gamification_on_delivery()
RETURNS trigger AS $$
DECLARE
    v_puntos_entrega INT := 100; -- Puntos base por cada entrega confirmada
    v_streak INT;
    v_last_resp TIMESTAMPTZ;
BEGIN
    -- Solo actuar cuando un pedido pasa a 'Entregado' y tiene un repartidor asignado
    IF NEW.estado = 'Entregado' AND (OLD.estado IS NULL OR OLD.estado != 'Entregado') AND NEW.repartidor_id IS NOT NULL THEN
        
        -- Evitar procesar el mismo pedido más de una vez (idempotencia)
        IF NOT EXISTS (SELECT 1 FROM public.driver_points_log WHERE order_id = NEW.id AND motivo = 'ORDER_COMPLETED') THEN
            
            -- Obtener estadísticas actuales
            SELECT streak_actual, last_response_at INTO v_streak, v_last_resp 
            FROM public.driver_gamification_stats WHERE driver_id = NEW.repartidor_id;

            -- Actualizar Racha (si la última actividad fue hace menos de 24 horas, incrementa)
            -- Nota: Esto incentiva el flujo constante de trabajo.
            IF v_last_resp >= NOW() - INTERVAL '24 hours' THEN
                v_streak := COALESCE(v_streak, 0) + 1;
            ELSE
                v_streak := 1;
            END IF;

            -- 1. Registrar el log de puntos
            INSERT INTO public.driver_points_log (driver_id, order_id, puntos, motivo)
            VALUES (NEW.repartidor_id, NEW.id, v_puntos_entrega, 'ORDER_COMPLETED');

            -- 2. Actualizar estadísticas globales
            INSERT INTO public.driver_gamification_stats (driver_id, puntos_totales, puntos_canjeables, streak_actual, last_response_at)
            VALUES (NEW.repartidor_id, v_puntos_entrega, v_puntos_entrega, v_streak, NOW())
            ON CONFLICT (driver_id) DO UPDATE SET
                puntos_totales = public.driver_gamification_stats.puntos_totales + EXCLUDED.puntos_totales,
                puntos_canjeables = public.driver_gamification_stats.puntos_canjeables + EXCLUDED.puntos_canjeables,
                streak_actual = EXCLUDED.streak_actual,
                last_response_at = EXCLUDED.last_response_at;

            -- 3. Bonus por Hitos de Racha (opcional, para dar recompensas extra)
            IF v_streak = 10 THEN
                INSERT INTO public.driver_points_log (driver_id, order_id, puntos, motivo) 
                VALUES (NEW.repartidor_id, NEW.id, 500, 'STREAK_10_DELIVERIES');
                
                UPDATE public.driver_gamification_stats 
                SET puntos_totales = puntos_totales + 500, puntos_canjeables = puntos_canjeables + 500
                WHERE driver_id = NEW.repartidor_id;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Crear el Trigger en la tabla pedidos_general
DROP TRIGGER IF EXISTS tr_gamification_on_delivery ON public.pedidos_general;
CREATE TRIGGER tr_gamification_on_delivery
AFTER UPDATE OF estado ON public.pedidos_general
FOR EACH ROW
EXECUTE FUNCTION public.fn_process_gamification_on_delivery();

-- 4. Asegurar que todos los repartidores tengan perfil de gamificación
INSERT INTO public.driver_gamification_stats (driver_id)
SELECT id FROM public.repartidores
ON CONFLICT (driver_id) DO NOTHING;

-- 5. ACTUALIZACIÓN RETROACTIVA: Otorgar puntos por entregas pasadas
DO $$
DECLARE
    r RECORD;
    v_puntos_base INT := 100;
BEGIN
    FOR r IN 
        SELECT id, repartidor_id, created_at 
        FROM public.pedidos_general 
        WHERE estado = 'Entregado' AND repartidor_id IS NOT NULL
    LOOP
        -- Solo si no se le han dado puntos ya por esta entrega
        IF NOT EXISTS (SELECT 1 FROM public.driver_points_log WHERE order_id = r.id AND motivo = 'ORDER_COMPLETED') THEN
             
             -- Insertar log
             INSERT INTO public.driver_points_log (driver_id, order_id, puntos, motivo, created_at)
             VALUES (r.repartidor_id, r.id, v_puntos_base, 'ORDER_COMPLETED', r.created_at);

             -- Actualizar acumulados
             UPDATE public.driver_gamification_stats 
             SET puntos_totales = puntos_totales + v_puntos_base,
                 puntos_canjeables = puntos_canjeables + v_puntos_base,
                 last_response_at = GREATEST(COALESCE(last_response_at, r.created_at), r.created_at)
             WHERE driver_id = r.repartidor_id;
             
             RAISE NOTICE 'Puntos retroactivos otorgados a % por pedido %', r.repartidor_id, r.id;
        END IF;
    END LOOP;
END;
$$;

-- 6. Refrescar el Ranking (Si es una vista materializada o tiene cache, aunque view_driver_ranking es una vista normal)
-- El ranking se actualiza automáticamente al ser una vista que lee de driver_gamification_stats.
