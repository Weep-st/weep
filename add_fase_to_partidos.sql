-- ==============================================================================
-- WEPI - Campaña Mundialista 2026: Agregar Columna Fase a Partidos
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase para habilitar
-- la categorización de encuentros por fase (Grupos, Octavos, Cuartos, etc.).
-- ==============================================================================

ALTER TABLE public.mundial_partidos ADD COLUMN IF NOT EXISTS fase TEXT DEFAULT 'Fase de Grupos';
