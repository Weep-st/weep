-- ==============================================================================
-- WEEP - Sistema Avanzado de Repartidores (Sesiones, Reputación y Auto-Offline)
-- Ejecutar en el SQL Editor de Supabase
-- ==============================================================================

-- 1. Añadir columnas de métricas de reputación e interacción a repartidores
ALTER TABLE public.repartidores 
ADD COLUMN IF NOT EXISTS ultima_interaccion_ui TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sesion_vence_en TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pedidos_aceptados_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS pedidos_rechazados_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS pedidos_ignorados_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS rachas_ignoradas INT DEFAULT 0;

-- 2. Modificar la lógica de "check_unaccepted_orders" para reasignar a 1 minuto y penalizar.
CREATE OR REPLACE FUNCTION public.fn_check_unaccepted_orders()
RETURNS void AS $$
DECLARE
  v_pedido record;
  v_nuevo_repartidor_id TEXT;
  v_nuevo_repartidor_onesignal TEXT;
  v_push_payload JSONB;
BEGIN
  -- Buscar pedidos pendientes que tengan un repartidor asignado, y donde 
  -- hayan pasado 1 minuto o más desde que se le notificó.
  FOR v_pedido IN 
    SELECT * FROM public.pedidos_general 
    WHERE estado = 'Pendiente' 
      AND repartidor_id IS NOT NULL 
      AND repartidor_notificado_en <= NOW() - INTERVAL '1 minute'
  LOOP
    -- Penalizar al repartidor que no contestó
    UPDATE public.repartidores 
    SET pedidos_ignorados_count = pedidos_ignorados_count + 1,
        rachas_ignoradas = rachas_ignoradas + 1
    WHERE id = v_pedido.repartidor_id;

    -- Si el repartidor ya ignoró 3 o más en racha, bajarlo a Inactivo
    UPDATE public.repartidores 
    SET estado = 'Inactivo' 
    WHERE id = v_pedido.repartidor_id AND rachas_ignoradas >= 3;

    -- Intentar buscar otro repartidor activo y aceptado que NO sea el actual
    -- Priorizar a los mejores calificados (% de aceptación)
    SELECT id, onesignal_id 
    INTO v_nuevo_repartidor_id, v_nuevo_repartidor_onesignal
    FROM public.repartidores
    WHERE estado = 'Activo' 
      AND admin_status = 'Aceptado'
      AND id != v_pedido.repartidor_id
    ORDER BY (pedidos_aceptados_count::FLOAT / GREATEST(1, pedidos_aceptados_count + pedidos_rechazados_count + pedidos_ignorados_count)) DESC, random()
    LIMIT 1;

    IF v_nuevo_repartidor_id IS NOT NULL THEN
      RAISE NOTICE 'Reasignando pedido %: de % a %', v_pedido.id, v_pedido.repartidor_id, v_nuevo_repartidor_id;
      
      -- Liberar al repartidor viejo y ocupar al nuevo
      -- Nota: si fue puesto Inactivo arriba por racha, no lo regresamos a Activo.
      UPDATE public.repartidores 
      SET estado = CASE WHEN rachas_ignoradas >= 3 THEN 'Inactivo' ELSE 'Activo' END 
      WHERE id = v_pedido.repartidor_id;

      UPDATE public.repartidores SET estado = 'Ocupado' WHERE id = v_nuevo_repartidor_id;
      
      -- Actualizar el pedido. 
      UPDATE public.pedidos_general 
      SET repartidor_id = v_nuevo_repartidor_id 
      WHERE id = v_pedido.id;

    ELSE
      RAISE NOTICE 'No hay otro repartidor para pedido %. Renotificando al actual (%)', v_pedido.id, v_pedido.repartidor_id;
      
      -- Resetear el temporizador del repartidor actual para darle 1 min extra
      UPDATE public.pedidos_general 
      SET repartidor_notificado_en = NOW() 
      WHERE id = v_pedido.id;
      
      -- Buscar el OneSignal ID del repartidor actual para enviarle un recordatorio
      SELECT onesignal_id INTO v_nuevo_repartidor_onesignal
      FROM public.repartidores 
      WHERE id = v_pedido.repartidor_id;

      IF (v_nuevo_repartidor_onesignal IS NOT NULL AND v_nuevo_repartidor_onesignal <> '') THEN
        v_push_payload := jsonb_build_object(
          'subscriptionIds', jsonb_build_array(v_nuevo_repartidor_onesignal),
          'title', '¡Se cancelará tu pedido!',
          'message', 'Atiéndelo rápido o será removido: Pedido #' || split_part(v_pedido.id, '-', 2),
          'data', jsonb_build_object('pedidoId', v_pedido.id, 'type', 'new_order')
        );

        PERFORM net.http_post(
          url := 'https://jskxfescamdjesdrcnkf.supabase.co/functions/v1/send-push',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := v_push_payload
        );
      END IF;
    END IF;

  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear CRON Job para Auto-Offline Inteligente
CREATE OR REPLACE FUNCTION public.fn_check_inactive_drivers()
RETURNS void AS $$
BEGIN
  -- Desconectar repartidores que superen su sesión (30 min) o no interactúen
  -- (solo si no están ocupados, es decir estado = 'Activo')
  UPDATE public.repartidores
  SET estado = 'Inactivo'
  WHERE estado = 'Activo' 
    AND (sesion_vence_en IS NOT NULL AND sesion_vence_en <= NOW())
     OR (ultima_interaccion_ui IS NOT NULL AND ultima_interaccion_ui <= NOW() - INTERVAL '30 minutes');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Asegurarnos que existe el CRON
DO $$
  BEGIN
    PERFORM cron.unschedule('check_inactive_drivers_job');
  EXCEPTION WHEN OTHERS THEN
    -- El job no existía, ignoramos el error
  END;
$$;

SELECT cron.schedule(
  'check_inactive_drivers_job',
  '* * * * *', -- Cada 1 minuto revisa inactividades
  'SELECT public.fn_check_inactive_drivers();'
);

-- 4. Sustituir Reasignar manual (reestablecer racha si acepta, o rechaza)
-- Cuando ACEPTA o RECHAZA, esto se hace en Edge o JS normalmente modificando la tabla.
-- Modificamos la funcion existente: reasignar_pedido_repartidor (usada por Rechazar)
CREATE OR REPLACE FUNCTION public.reasignar_pedido_repartidor(
  p_pedido_id TEXT,
  p_repartidor_actual_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_nuevo_repartidor_id TEXT;
  v_nuevo_repartidor_email TEXT;
  v_nuevo_repartidor_nombre TEXT;
  v_count INT;
BEGIN
  -- Penalidad por rechazo manual
  UPDATE public.repartidores 
  SET pedidos_rechazados_count = pedidos_rechazados_count + 1,
      rachas_ignoradas = 0 -- rechazó conscientemente, rompe racha de "ausencia"
  WHERE id = p_repartidor_actual_id;

  -- 1. Contar repartidores activos (excluyendo al actual)
  SELECT COUNT(*) INTO v_count 
  FROM repartidores 
  WHERE estado = 'Activo' 
    AND admin_status = 'Aceptado'
    AND id != p_repartidor_actual_id;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'No hay otros repartidores disponibles para este pedido.';
  END IF;

  -- 3. Seleccionar uno considerando reputacion
  SELECT id, email, nombre 
  INTO v_nuevo_repartidor_id, v_nuevo_repartidor_email, v_nuevo_repartidor_nombre
  FROM repartidores
  WHERE estado = 'Activo' 
    AND admin_status = 'Aceptado'
    AND id != p_repartidor_actual_id
  ORDER BY (pedidos_aceptados_count::FLOAT / GREATEST(1, pedidos_aceptados_count + pedidos_rechazados_count + pedidos_ignorados_count)) DESC, random()
  LIMIT 1;

  -- 4. Actualizar el pedido
  UPDATE pedidos_general 
  SET repartidor_id = v_nuevo_repartidor_id 
  WHERE id = p_pedido_id;

  -- 5. Actualizar estados
  UPDATE repartidores SET estado = 'Ocupado' WHERE id = v_nuevo_repartidor_id;
  UPDATE repartidores SET estado = 'Activo' WHERE id = p_repartidor_actual_id;

  RETURN jsonb_build_object(
    'id', v_nuevo_repartidor_id,
    'email', v_nuevo_repartidor_email,
    'nombre', v_nuevo_repartidor_nombre,
    'success', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
