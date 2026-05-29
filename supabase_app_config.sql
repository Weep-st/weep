-- Crear tabla de configuración para la App Desktop
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar configuración inicial del diseño del ticket
-- Estos valores corrigen el problema de desplazamiento a la derecha y adaptabilidad
INSERT INTO app_config (key, value) VALUES (
    'ticket_design', 
    '{
        "paper_width": "80mm",
        "margin_left": "0mm",
        "margin_right": "4mm",
        "padding_left": "2mm",
        "padding_right": "2mm",
        "base_font_size": "13px",
        "header_image_max_width": "35mm",
        "weep_logo_max_width": "40mm"
    }'
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
