-- ==============================================================================
-- SCRIPT: Eliminación Forzada de Pedidos Específicos
-- Objetivo: Eliminar registros de ORD-4ZZ5CVZR2W, ORD-51R5A0S597 y PED-1776049920107
-- ==============================================================================

BEGIN;

-- 1. Eliminar ítems relacionados en pedidos_items
DELETE FROM public.pedidos_items 
WHERE pedido_id IN (
  'ORD-4ZZ5CVZR2W',
  'ORD-51R5A0S597',
  'PED-1776049920107',
  'ORD-SAPZ32PYOL',
  'PED-1776050508150'
);

-- 2. Eliminar de pedidos_locales
DELETE FROM public.pedidos_locales 
WHERE pedido_id IN (
  'ORD-4ZZ5CVZR2W',
  'ORD-51R5A0S597',
  'PED-1776049920107',
  'ORD-SAPZ32PYOL',
  'PED-1776050508150'
);

-- 3. Eliminar de pedidos_general (Tabla Principal)
DELETE FROM public.pedidos_general 
WHERE id IN (
  'ORD-4ZZ5CVZR2W',
  'ORD-51R5A0S597',
  'PED-1776049920107',
  'ORD-SAPZ32PYOL',
  'PED-1776050508150'
);

COMMIT;

-- Verificación:
-- SELECT id, estado FROM pedidos_general WHERE id IN ('ORD-4ZZ5CVZR2W', 'ORD-51R5A0S597', 'PED-1776049920107');
