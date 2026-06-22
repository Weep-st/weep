-- ─── Sincronización Automática de Notificaciones Telegram ───
-- Este script crea el trigger necesario para que Supabase envíe una 
-- notificación a tu bot de Telegram apenas se cree un nuevo pedido.

-- 1. Habilitar la extensión pg_net para llamadas HTTP si no está habilitada
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Función que procesa la notificación de Telegram
CREATE OR REPLACE FUNCTION public.fn_notify_telegram_on_order()
RETURNS TRIGGER AS $$
DECLARE
  v_payload JSONB;
  v_headers JSONB;
BEGIN
  -- Construir el payload con el ID del pedido
  v_payload := jsonb_build_object(
    'pedidoId', NEW.id
  );

  -- Configurar headers
  v_headers := '{"Content-Type": "application/json"}'::jsonb;

  -- Realizar la llamada a la Edge Function de forma asíncrona
  -- NOTA: Reemplaza con la URL correcta de tu proyecto si es necesario
  PERFORM net.http_post(
    url := 'https://jskxfescamdjesdrcnkf.supabase.co/functions/v1/send-telegram-notification',
    headers := v_headers,
    body := v_payload
  );
  
  RAISE NOTICE 'Notificación Telegram enviada para el pedido %', NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear el Trigger
DROP TRIGGER IF EXISTS tr_notify_telegram_on_order ON public.pedidos_general;

CREATE TRIGGER tr_notify_telegram_on_order
  AFTER INSERT
  ON public.pedidos_general
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_telegram_on_order();
