-- ==============================================================================
-- SCRIPT: Eliminación Forzada de Pedidos (v5)
-- Objetivo: Eliminar registros de pedidos_general, pedidos_locales y pedidos_items
--           desactivando únicamente los triggers de usuario para evitar bloqueos.
-- ==============================================================================

BEGIN;

-- 1. Desactivar temporalmente los triggers de usuario
ALTER TABLE public.pedidos_items DISABLE TRIGGER USER;
ALTER TABLE public.pedidos_locales DISABLE TRIGGER USER;
ALTER TABLE public.pedidos_general DISABLE TRIGGER USER;

-- 2. Eliminar registros de pedidos_items (Hijos)
DELETE FROM public.pedidos_items 
WHERE pedido_id IN (
  'ORD-0F1ZGTA3K2',
  'ORD-18D0JF9KN1',
  'ORD-196PGY38SP',
  'ORD-1M7S9974RM',
  'ORD-2YMQ7YC0D9',
  'ORD-7DQLFO490Z',
  'ORD-BY2839U4AP',
  'ORD-CHVF1O3AJN',
  'ORD-DUW1OEO79G',
  'ORD-DZ9VFOWWKY',
  'ORD-EOLIU870JG',
  'ORD-FF28HRN577',
  'ORD-G4HWP3HH7Y',
  'ORD-HC3C4GCFW7',
  'ORD-KNB7SBVXE8',
  'ORD-LAX4435IKV',
  'ORD-PGKP1W1U8U',
  'ORD-RPGN5F4QZ6',
  'ORD-RXDXA0BAAB',
  'ORD-VBUC9W5U33',
  'ORD-YBZYJO8G9D',
  'ORD-ZNRQT1TCV4'
);

-- 3. Eliminar registros de pedidos_locales (Hijos)
DELETE FROM public.pedidos_locales 
WHERE pedido_id IN (
  'ORD-0F1ZGTA3K2',
  'ORD-18D0JF9KN1',
  'ORD-196PGY38SP',
  'ORD-1M7S9974RM',
  'ORD-2YMQ7YC0D9',
  'ORD-7DQLFO490Z',
  'ORD-BY2839U4AP',
  'ORD-CHVF1O3AJN',
  'ORD-DUW1OEO79G',
  'ORD-DZ9VFOWWKY',
  'ORD-EOLIU870JG',
  'ORD-FF28HRN577',
  'ORD-G4HWP3HH7Y',
  'ORD-HC3C4GCFW7',
  'ORD-KNB7SBVXE8',
  'ORD-LAX4435IKV',
  'ORD-PGKP1W1U8U',
  'ORD-RPGN5F4QZ6',
  'ORD-RXDXA0BAAB',
  'ORD-VBUC9W5U33',
  'ORD-YBZYJO8G9D',
  'ORD-ZNRQT1TCV4'
);

-- 4. Eliminar de pedidos_general (Tabla Principal)
DELETE FROM public.pedidos_general 
WHERE id IN (
  'ORD-0F1ZGTA3K2',
  'ORD-18D0JF9KN1',
  'ORD-196PGY38SP',
  'ORD-1M7S9974RM',
  'ORD-2YMQ7YC0D9',
  'ORD-7DQLFO490Z',
  'ORD-BY2839U4AP',
  'ORD-CHVF1O3AJN',
  'ORD-DUW1OEO79G',
  'ORD-DZ9VFOWWKY',
  'ORD-EOLIU870JG',
  'ORD-FF28HRN577',
  'ORD-G4HWP3HH7Y',
  'ORD-HC3C4GCFW7',
  'ORD-KNB7SBVXE8',
  'ORD-LAX4435IKV',
  'ORD-PGKP1W1U8U',
  'ORD-RPGN5F4QZ6',
  'ORD-RXDXA0BAAB',
  'ORD-VBUC9W5U33',
  'ORD-YBZYJO8G9D',
  'ORD-ZNRQT1TCV4'
);

-- 5. Reactivar todos los triggers de usuario
ALTER TABLE public.pedidos_items ENABLE TRIGGER USER;
ALTER TABLE public.pedidos_locales ENABLE TRIGGER USER;
ALTER TABLE public.pedidos_general ENABLE TRIGGER USER;

COMMIT;
