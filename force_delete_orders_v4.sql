-- ==============================================================================
-- SCRIPT: Eliminación Forzada de Pedidos (v4)
-- Objetivo: Eliminar registros de pedidos_general, pedidos_locales y pedidos_items
--           desactivando únicamente los triggers de usuario para evitar bloqueos.
-- ==============================================================================

BEGIN;

-- 1. Desactivar temporalmente los triggers de usuario (evita el error de sistema)
ALTER TABLE public.pedidos_items DISABLE TRIGGER USER;
ALTER TABLE public.pedidos_locales DISABLE TRIGGER USER;
ALTER TABLE public.pedidos_general DISABLE TRIGGER USER;

-- 2. Eliminar registros de pedidos_items (Hijos)
DELETE FROM public.pedidos_items 
WHERE pedido_id IN (
  'ORD-86UPG3OKFD',
  'ORD-AJQYS2HC3W',
  'ORD-CUGBV921IE',
  'ORD-S8IV8LE2QP',
  'ORD-TT6DRNTTFE'
);

-- 3. Eliminar registros de pedidos_locales (Hijos)
DELETE FROM public.pedidos_locales 
WHERE pedido_id IN (
  'ORD-86UPG3OKFD',
  'ORD-AJQYS2HC3W',
  'ORD-CUGBV921IE',
  'ORD-S8IV8LE2QP',
  'ORD-TT6DRNTTFE'
);

-- 4. Eliminar de pedidos_general (Tabla Principal)
DELETE FROM public.pedidos_general 
WHERE id IN (
  'ORD-86UPG3OKFD',
  'ORD-AJQYS2HC3W',
  'ORD-CUGBV921IE',
  'ORD-S8IV8LE2QP',
  'ORD-TT6DRNTTFE'
);

-- 5. Reactivar todos los triggers de usuario
ALTER TABLE public.pedidos_items ENABLE TRIGGER USER;
ALTER TABLE public.pedidos_locales ENABLE TRIGGER USER;
ALTER TABLE public.pedidos_general ENABLE TRIGGER USER;

COMMIT;
