-- ==============================================================================
-- SCRIPT: Eliminación Forzada de Pedidos
-- Objetivo: Eliminar registros específicos de pedidos_general y tablas relacionadas
-- ==============================================================================

BEGIN;

-- IDs de pedidos a eliminar
-- PED-1775739708772, PED-1775843624495, PED-1775844275087, PED-1775848176794, 
-- PED-1775852934598, PED-1775852968113, PED-1775853534101, PED-1775874997162, 
-- PED-1775875473084

-- 1. Eliminar ítems relacionados en pedidos_items
DELETE FROM public.pedidos_items 
WHERE pedido_id IN (
  'PED-1775739708772',
  'PED-1775843624495',
  'PED-1775844275087',
  'PED-1775848176794',
  'PED-1775852934598',
  'PED-1775852968113',
  'PED-1775853534101',
  'PED-1775874997162',
  'PED-1775875473084'
);

-- 2. Eliminar de pedidos_locales
DELETE FROM public.pedidos_locales 
WHERE pedido_id IN (
  'PED-1775739708772',
  'PED-1775843624495',
  'PED-1775844275087',
  'PED-1775848176794',
  'PED-1775852934598',
  'PED-1775852968113',
  'PED-1775853534101',
  'PED-1775874997162',
  'PED-1775875473084'
);

-- 3. Eliminar de pedidos_general (Tabla Principal)
DELETE FROM public.pedidos_general 
WHERE id IN (
  'PED-1775739708772',
  'PED-1775843624495',
  'PED-1775844275087',
  'PED-1775848176794',
  'PED-1775852934598',
  'PED-1775852968113',
  'PED-1775853534101',
  'PED-1775874997162',
  'PED-1775875473084'
);

COMMIT;

-- Verificación opcional:
-- SELECT id, estado FROM pedidos_general WHERE id LIKE 'PED-1775%';
