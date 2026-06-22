-- ==============================================================================
-- WEPI COPA 2026 - ACTUALIZACIÓN DE PUNTOS POR PRONÓSTICOS
-- Ejecutar en el SQL Editor de Supabase para aplicar la actualización al instante.
-- ==============================================================================

-- Re-definir la función del trigger para asignar 250 puntos (exacto) y 100 puntos (ganador/empate)
CREATE OR REPLACE FUNCTION public.fn_procesar_puntos_partido()
RETURNS trigger AS $$
DECLARE
    v_pronostico RECORD;
    v_puntos INT;
BEGIN
    IF NEW.estado = 'finalizado' AND NEW.goles_a IS NOT NULL AND NEW.goles_b IS NOT NULL THEN
        FOR v_pronostico IN 
            SELECT * FROM public.mundial_pronosticos 
            WHERE partido_id = NEW.id AND procesado = FALSE
        LOOP
            v_puntos := 0;

            -- Acierto Exacto (250 Puntos)
            IF v_pronostico.pronostico_a = NEW.goles_a AND v_pronostico.pronostico_b = NEW.goles_b THEN
                v_puntos := 250;
            -- Acierto de Ganador o Empate sin marcador exacto (100 Puntos)
            -- Usamos la función SIGN matemática para evitar operadores de mayor/menor
            ELSIF SIGN(v_pronostico.pronostico_a - v_pronostico.pronostico_b) = SIGN(NEW.goles_a - NEW.goles_b) THEN
                v_puntos := 100;
            END IF;

            UPDATE public.mundial_pronosticos 
            SET puntos_ganados = v_puntos, procesado = TRUE 
            WHERE id = v_pronostico.id;

            -- Incrementar puntos totales del usuario de manera segura
            INSERT INTO public.mundial_usuario_stats (usuario_id, puntos_totales)
            VALUES (v_pronostico.usuario_id, v_puntos)
            ON CONFLICT (usuario_id) 
            DO UPDATE SET puntos_totales = mundial_usuario_stats.puntos_totales + EXCLUDED.puntos_totales;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-enlazar el trigger de forma segura
DROP TRIGGER IF EXISTS tr_procesar_puntos_partido ON public.mundial_partidos;
CREATE TRIGGER tr_procesar_puntos_partido
AFTER UPDATE OF estado ON public.mundial_partidos
FOR EACH ROW
EXECUTE FUNCTION public.fn_procesar_puntos_partido();

-- Mensaje de confirmación
SELECT '¡Puntos de pronósticos actualizados con éxito! Exacto = 250 Pts, Ganador/Empate = 100 Pts.' AS resultado;
