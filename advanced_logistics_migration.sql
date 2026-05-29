-- ═══════════════════════════════════════════════════
-- MIGRACIÓN: LOGÍSTICA AVANZADA (NIVELES Y STACKING)
-- ═══════════════════════════════════════════════════

-- 1. Tabla de Configuración de Rubros
CREATE TABLE IF NOT EXISTS public.rubros_config (
    id SERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL,
    nivel_rapidez INT DEFAULT 1, -- 1: Rápido, 2: Lento
    ventana_stacking_minutos INT DEFAULT 5, -- Minutos para permitir stacking
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar valores iniciales
INSERT INTO public.rubros_config (nombre, nivel_rapidez, ventana_stacking_minutos)
VALUES 
    ('Heladería', 1, 5),
    ('Panadería', 1, 5),
    ('Market', 1, 5),
    ('Farmacia', 1, 5),
    ('Restaurante', 2, 10)
ON CONFLICT (nombre) DO UPDATE 
SET nivel_rapidez = EXCLUDED.nivel_rapidez, 
    ventana_stacking_minutos = EXCLUDED.ventana_stacking_minutos;

-- 2. Actualizar Tabla de Repartidores
ALTER TABLE public.repartidores 
ADD COLUMN IF NOT EXISTS tipo_vehiculo TEXT DEFAULT 'Moto',
ADD COLUMN IF NOT EXISTS nivel_repartidor INT DEFAULT 1; -- 1: Moto, 2: Bici

-- 3. Actualizar Tabla de Pedidos
ALTER TABLE public.pedidos_general
ADD COLUMN IF NOT EXISTS nivel_rapidez_pedido INT DEFAULT 1;

-- 4. Actualizar la función de creación de pedidos para capturar el nivel de rapidez
-- (Nota: Esto se integrará en el RPC create_pedido_completo si existe)

-- 5. Modificar RPC claim_pedido_broadcast para permitir múltiples pedidos
CREATE OR REPLACE FUNCTION public.claim_pedido_broadcast(
  p_pedido_id TEXT,
  p_repartidor_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_updated INT;
  v_current_estado TEXT;
  v_target_estado TEXT;
  v_metodo_pago TEXT;
  v_created_at TIMESTAMPTZ;
  v_segundos INT;
  v_puntos_base INT := 0;
  v_cycle_id TEXT;
  v_nivel_repartidor INT;
  v_pedidos_activos INT;
BEGIN
    -- 1. Obtener estado actual y método de pago
    SELECT estado, created_at, metodo_pago INTO v_current_estado, v_created_at, v_metodo_pago 
    FROM public.pedidos_general 
    WHERE id = p_pedido_id AND repartidor_id IS NULL;

    IF v_current_estado IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'El pedido ya no está disponible.');
    END IF;

    -- 2. Definir estado de destino
    IF v_current_estado IN ('Buscando Repartidor', 'Pendiente') THEN
        IF LOWER(v_metodo_pago) LIKE '%efectivo%' THEN
            v_target_estado := 'Confirmado';
        ELSE
            v_target_estado := 'Pendiente de Pago';
        END IF;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'El pedido no puede ser reclamado en su estado actual: ' || v_current_estado);
    END IF;

    -- 3. Intentar actualizar de forma atómica
    UPDATE public.pedidos_general 
    SET repartidor_id = p_repartidor_id, 
        estado = v_target_estado
    WHERE id = p_pedido_id 
      AND repartidor_id IS NULL 
      AND estado = v_current_estado;

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'El pedido ya fue tomado por otro repartidor.');
    END IF;

    -- 4. Sincronizar pedidos_locales
    UPDATE public.pedidos_locales SET estado = v_target_estado WHERE pedido_id = p_pedido_id;

    -- 5. Lógica de Ocupación Dinámica
    SELECT nivel_repartidor INTO v_nivel_repartidor FROM public.repartidores WHERE id = p_repartidor_id;
    
    -- Contar pedidos activos (que no estén entregados o cancelados)
    SELECT COUNT(*) INTO v_pedidos_activos 
    FROM public.pedidos_general 
    WHERE repartidor_id = p_repartidor_id 
      AND estado NOT IN ('Entregado', 'Cancelado', 'Rechazado');

    -- Solo marcar como Ocupado si llegó al límite (Moto: 2 pedidos, Bici: 1 pedido)
    -- O si el pedido actual es de Nivel 2 y es Bici
    IF (v_nivel_repartidor = 1 AND v_pedidos_activos >= 2) OR (v_nivel_repartidor = 2 AND v_pedidos_activos >= 1) THEN
        UPDATE public.repartidores SET estado = 'Ocupado' WHERE id = p_repartidor_id;
    ELSE
        -- Si todavía tiene capacidad, se mantiene en Activo (o cambia de Ocupado a Activo si estaba ocupado por error)
        UPDATE public.repartidores SET estado = 'Activo' WHERE id = p_repartidor_id;
    END IF;

    -- 6. Gamificación (Mantener lógica anterior)
    BEGIN
        v_segundos := EXTRACT(EPOCH FROM (NOW() - v_created_at));
        IF v_segundos <= 45 THEN
          v_puntos_base := v_puntos_base + 75;
          INSERT INTO public.driver_points_log (driver_id, puntos, motivo)
          VALUES (p_repartidor_id, 75, 'BROADCAST_FLASH');
        END IF;

        SELECT current_cycle_id INTO v_cycle_id FROM public.system_activation_status WHERE id = 1;
        IF v_cycle_id IS NOT NULL THEN
          v_puntos_base := v_puntos_base + 100;
          INSERT INTO public.driver_points_log (driver_id, cycle_id, puntos, motivo)
          VALUES (p_repartidor_id, v_cycle_id, 100, 'BROADCAST_INCENTIVE');
        END IF;

        IF v_puntos_base > 0 THEN
          INSERT INTO public.driver_gamification_stats (driver_id, puntos_totales, puntos_canjeables)
          VALUES (p_repartidor_id, v_puntos_base, v_puntos_base)
          ON CONFLICT (driver_id) DO UPDATE 
          SET puntos_totales = public.driver_gamification_stats.puntos_totales + v_puntos_base,
              puntos_canjeables = public.driver_gamification_stats.puntos_canjeables + v_puntos_base;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error en gamificación: %', SQLERRM;
    END;

    RETURN jsonb_build_object('success', true, 'mensaje', 'Pedido asignado con éxito', 'nuevo_estado', v_target_estado);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
