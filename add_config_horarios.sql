-- Migración para soportar horarios flexibles por día
ALTER TABLE locales ADD COLUMN IF NOT EXISTS config_horarios JSONB DEFAULT '{}'::jsonb;

-- Comentario para documentación
COMMENT ON COLUMN locales.config_horarios IS 'Configuración detallada de horarios por día: { "Lunes": { "tipo": "especifico", "intervalos": [...] }, ... }';
