-- ==============================================================================
-- WEPI - Quitar "Próximamente" para el local AXION energy en la ciudad de Oberá
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase.
-- ==============================================================================

UPDATE public.locales
SET
  disponible_desde = NULL,
  admin_status = 'Aceptado',
  acepta_retiro = true,
  acepta_envio = true,
  estado = 'Activo',
  modo_automatico = false
WHERE id = 'LOC-AXION-OBERA';
