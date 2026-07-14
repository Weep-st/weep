-- ==============================================================================
-- WEPI - Agregar Local AXION energy en ciudad Oberá (Próximamente / Destacado)
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase.
-- ==============================================================================

INSERT INTO public.locales (
  id,
  nombre,
  foto_url,
  ciudad,
  disponible_desde,
  admin_status,
  tipo_servicio,
  rubro,
  rubros,
  acepta_envio,
  acepta_retiro,
  dias_apertura,
  config_horarios,
  plan_id
) VALUES (
  'LOC-AXION-OBERA',
  'AXION energy',
  'https://i.postimg.cc/13jfDJ48/Logo-AXION-energy.jpg',
  'Oberá',
  '2030-12-31', -- Fecha lejana para que aparezca como "Próximamente"
  'Aceptado',
  'delivery',
  'Combustibles y Minishopping',
  '{"Combustibles y Minishopping"}',
  false,
  false,
  '{"Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"}',
  '{}',
  '87bdad7f-51cf-4c9c-ae64-ebab8b07b105' -- PLAN_PRO (Local Destacado)
)
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  foto_url = EXCLUDED.foto_url,
  ciudad = EXCLUDED.ciudad,
  disponible_desde = EXCLUDED.disponible_desde,
  admin_status = EXCLUDED.admin_status,
  tipo_servicio = EXCLUDED.tipo_servicio,
  rubro = EXCLUDED.rubro,
  rubros = EXCLUDED.rubros,
  plan_id = EXCLUDED.plan_id;
