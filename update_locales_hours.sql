-- Script para añadir horario dividido a los locales
ALTER TABLE locales 
ADD COLUMN horario_apertura2 TEXT,
ADD COLUMN horario_cierre2 TEXT;

COMMENT ON COLUMN locales.horario_apertura2 IS 'Segundo turno: Hora de apertura (ej: 19:00)';
COMMENT ON COLUMN locales.horario_cierre2 IS 'Segundo turno: Hora de cierre (ej: 23:00)';
