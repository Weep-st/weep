-- ==============================================================================
-- WEPI - Agregar columna rubros_habilitados a la tabla ciudades_config
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase.
-- ==============================================================================

-- 1. Agregar la columna rubros_habilitados
ALTER TABLE public.ciudades_config ADD COLUMN IF NOT EXISTS rubros_habilitados TEXT[] DEFAULT '{}';

-- 2. Preconfigurar Santo Tomé con rubros principales (deliveries)
UPDATE public.ciudades_config
SET rubros_habilitados = ARRAY['Restaurante', 'Heladería', 'Cafetería', 'Market', 'Farmacia', 'Bebidas', 'Carnicería', 'SHOPS']
WHERE ciudad = 'Santo Tomé';

-- 3. Preconfigurar Oberá con solo Restaurante (o el subconjunto inicial deseado)
UPDATE public.ciudades_config
SET rubros_habilitados = ARRAY['Restaurante']
WHERE ciudad = 'Oberá';
