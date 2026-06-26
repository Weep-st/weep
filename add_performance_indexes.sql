-- ═══════════════════════════════════════════════════
-- SQL MIGRATION: ADD PERFORMANCE INDEXES
-- ═══════════════════════════════════════════════════

-- 1. Optimización para la lista de pedidos en el Dashboard del Repartidor (DriverDashboard)
CREATE INDEX IF NOT EXISTS idx_pedidos_general_repartidor_created 
ON public.pedidos_general(repartidor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pedidos_general_estado_created 
ON public.pedidos_general(estado, created_at DESC);

-- 2. Optimización para la lista de pedidos en el Dashboard del Restaurant (RestaurantDashboard)
CREATE INDEX IF NOT EXISTS idx_pedidos_locales_local_created 
ON public.pedidos_locales(local_id, created_at DESC);

-- 3. Optimización para cargar los productos/items de un pedido en los dashboards
CREATE INDEX IF NOT EXISTS idx_pedidos_items_pedido_local 
ON public.pedidos_items(pedido_id, local_id);

-- 4. Optimización para los chequeos frecuentes de repartidores activos
CREATE INDEX IF NOT EXISTS idx_repartidores_active_check 
ON public.repartidores(estado, admin_status);
