-- ═══════════════════════════════════════════════════
-- MIGRACIÓN: NOTIFICACIONES PUSH Y CONFIGURACIÓN REALTIME
-- ═══════════════════════════════════════════════════

-- 1. Habilitar Realtime para pedidos_general y pedidos_locales si no lo están
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
      and schemaname = 'public' 
      and tablename = 'pedidos_general'
  ) then
    alter publication supabase_realtime add table public.pedidos_general;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
      and schemaname = 'public' 
      and tablename = 'pedidos_locales'
  ) then
    alter publication supabase_realtime add table public.pedidos_locales;
  end if;
end $$;

-- 2. Actualizar función de notificaciones push de broadcast en pedidos_general
CREATE OR REPLACE FUNCTION public.fn_notify_repartidores_broadcast()
RETURNS TRIGGER AS $$
DECLARE
  v_push_payload JSONB;
  v_headers JSONB;
  v_onesignal_id TEXT;
  v_is_broadcast BOOLEAN := FALSE;
BEGIN
  -- CASO 1: PEDIDO BROADCAST (Nuevo pedido sin asignar)
  -- Se activa cuando repartidor_id es NULL, el tipo de entrega es 'Con Envío' y el estado es apto para repartir.
  IF (NEW.repartidor_id IS NULL AND NEW.tipo_entrega = 'Con Envío' AND NEW.estado IN ('Pendiente', 'Buscando Repartidor', 'Confirmado')) THEN
    IF (TG_OP = 'INSERT') THEN
      v_is_broadcast := TRUE;
    ELSIF (TG_OP = 'UPDATE') THEN
      -- Se envía si el estado cambió, o si antes tenía repartidor y ahora no (reasignación/rechazo)
      IF (OLD.estado IS DISTINCT FROM NEW.estado OR OLD.repartidor_id IS DISTINCT FROM NEW.repartidor_id) THEN
        v_is_broadcast := TRUE;
      END IF;
    END IF;
  END IF;

  IF (v_is_broadcast) THEN
    -- Enviamos broadcastOrderId para que la Edge Function maneje prioritarios, retardos y chequeo de estado de forma segura en el servidor
    v_push_payload := jsonb_build_object(
      'broadcastOrderId', NEW.id,
      'localId', NEW.local_id,
      'precioEnvio', NEW.precio_envio
    );

    v_headers := '{"Content-Type": "application/json"}'::jsonb;

    PERFORM net.http_post(
      url := 'https://jskxfescamdjesdrcnkf.supabase.co/functions/v1/send-push',
      headers := v_headers,
      body := v_push_payload
    );
    
    RAISE NOTICE 'Broadcast push para pedido % enviado a Edge Function', NEW.id;

  -- CASO 2: ASIGNACIÓN CONFIRMADA (Cuando un repartidor toma el pedido o se le asigna manualmente)
  ELSIF (TG_OP = 'UPDATE' AND OLD.repartidor_id IS NULL AND NEW.repartidor_id IS NOT NULL) THEN
    -- Buscar el OneSignal ID del repartidor asignado
    SELECT onesignal_id INTO v_onesignal_id 
    FROM public.repartidores 
    WHERE id = NEW.repartidor_id;

    -- Si tiene ID, notificarle de inmediato
    IF (v_onesignal_id IS NOT NULL AND v_onesignal_id <> '') THEN
      v_push_payload := jsonb_build_object(
        'subscriptionIds', jsonb_build_array(v_onesignal_id),
        'title', '¡Viaje Confirmado! ✅',
        'message', 'Has tomado el pedido #' || split_part(NEW.id, '-', 2) || '. Dirígete al local.',
        'data', jsonb_build_object('pedidoId', NEW.id, 'type', 'order_confirmed')
      );

      v_headers := '{"Content-Type": "application/json"}'::jsonb;

      PERFORM net.http_post(
        url := 'https://jskxfescamdjesdrcnkf.supabase.co/functions/v1/send-push',
        headers := v_headers,
        body := v_push_payload
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-vincular el trigger de broadcast de manera que escuche updates en estado y repartidor_id
DROP TRIGGER IF EXISTS tr_notify_repartidor_broadcast ON public.pedidos_general;
CREATE TRIGGER tr_notify_repartidor_broadcast
  AFTER INSERT OR UPDATE OF estado, repartidor_id
  ON public.pedidos_general
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_repartidores_broadcast();


-- 3. Crear función y trigger para avisar al repartidor cuando un pedido esté listo en pedidos_locales
CREATE OR REPLACE FUNCTION public.fn_notify_repartidor_on_order_ready()
RETURNS TRIGGER AS $$
DECLARE
  v_repartidor_id TEXT;
  v_onesignal_id TEXT;
  v_push_payload JSONB;
  v_headers JSONB;
  v_nombre_local TEXT;
BEGIN
  -- Verificar si el estado pasó de Aceptado a Listo
  IF (TG_OP = 'UPDATE' AND OLD.estado = 'Aceptado' AND NEW.estado = 'Listo') THEN
    
    -- Obtener el repartidor_id asignado al pedido en pedidos_general
    SELECT repartidor_id INTO v_repartidor_id
    FROM public.pedidos_general
    WHERE id = NEW.pedido_id;

    -- Si hay un repartidor asignado, buscar su onesignal_id
    IF (v_repartidor_id IS NOT NULL) THEN
      SELECT onesignal_id INTO v_onesignal_id
      FROM public.repartidores
      WHERE id = v_repartidor_id;

      -- Si el repartidor tiene un OneSignal ID válido, enviarle push
      IF (v_onesignal_id IS NOT NULL AND v_onesignal_id <> '') THEN
        
        -- Obtener el nombre del local
        SELECT nombre INTO v_nombre_local
        FROM public.locales
        WHERE id = NEW.local_id;

        v_push_payload := jsonb_build_object(
          'subscriptionIds', jsonb_build_array(v_onesignal_id),
          'title', '¡Pedido Listo! 🛵',
          'message', 'El local ' || COALESCE(v_nombre_local, 'socio') || ' ya preparó el pedido #' || split_part(NEW.pedido_id, '-', 2) || '. ¡Pasa a retirarlo!',
          'data', jsonb_build_object('pedidoId', NEW.pedido_id, 'type', 'order_ready_driver')
        );

        v_headers := '{"Content-Type": "application/json"}'::jsonb;

        PERFORM net.http_post(
          url := 'https://jskxfescamdjesdrcnkf.supabase.co/functions/v1/send-push',
          headers := v_headers,
          body := v_push_payload
        );

        RAISE NOTICE 'Notificación de Pedido Listo enviada al repartidor % para el pedido %', v_repartidor_id, NEW.pedido_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vincular el trigger a la tabla pedidos_locales
DROP TRIGGER IF EXISTS tr_notify_repartidor_order_ready ON public.pedidos_locales;
CREATE TRIGGER tr_notify_repartidor_order_ready
  AFTER UPDATE OF estado
  ON public.pedidos_locales
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_repartidor_on_order_ready();
