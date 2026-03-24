-- ═══════════════════════════════════════════════════
-- SCRIPT: Desactivar Triggers de Email Automático
-- Copia y pega esto en el EDITOR SQL de Supabase
-- ═══════════════════════════════════════════════════

-- ─── 1. LISTAR TRIGGERS EXISTENTES (Para tu información) ───
-- Ejecuta esto primero si quieres ver qué triggers hay:
-- SELECT trigger_name, event_object_table, action_statement 
-- FROM information_schema.triggers 
-- WHERE event_object_table IN ('pedidos_general', 'pedidos_locales');

-- ─── 2. ELIMINAR TRIGGERS QUE ENVIAN CORREOS DE FORMA REDUNDANTE ───
-- (Ajusta los nombres si el tuyo se llama diferente)

-- Ejemplo común si hay un trigger llamado 'trigger_notify_driver' o similar:
DROP TRIGGER IF EXISTS trigger_notify_driver ON pedidos_general;
DROP TRIGGER IF EXISTS trigger_notify_locals ON pedidos_general;
DROP TRIGGER IF EXISTS trigger_notify_customer ON pedidos_general;

-- Si están en pedidos_locales:
DROP TRIGGER IF EXISTS trigger_notify_driver ON pedidos_locales;
DROP TRIGGER IF EXISTS trigger_notify_locals ON pedidos_locales;

-- ─── NOTA ───
-- Si los correos se envían por un TRIGGER, al borrarlo dejarán de salir doble.
-- El código React (RestaurantDashboard) y el Webhook-MP ya están configurados
-- para hacerlo en el momento correcto (al Aceptar el pedido).
