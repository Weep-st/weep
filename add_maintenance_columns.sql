-- Ejecutar esto en el editor SQL de Supabase para añadir las columnas de mantenimiento
ALTER TABLE configuracion 
ADD COLUMN mantenimiento_pedir BOOLEAN DEFAULT FALSE,
ADD COLUMN mantenimiento_locales BOOLEAN DEFAULT FALSE,
ADD COLUMN mantenimiento_repartidores BOOLEAN DEFAULT FALSE;

-- Opcional: Asegurarse de que el registro 'global' exista si es la primera vez
-- INSERT INTO configuracion (id, valor_envio, mantenimiento_pedir, mantenimiento_locales, mantenimiento_repartidores)
-- VALUES ('global', 2000, false, false, false)
-- ON CONFLICT (id) DO NOTHING;
