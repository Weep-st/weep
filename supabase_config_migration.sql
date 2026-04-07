-- ─── Create configuracion table ───
CREATE TABLE IF NOT EXISTS configuracion (
  id TEXT PRIMARY KEY DEFAULT 'global',
  valor_envio NUMERIC DEFAULT 2000,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  usuario_id TEXT -- Opcional: para auditoría de quién lo cambió
);

-- Insert initial row if not exists
INSERT INTO configuracion (id, valor_envio) 
VALUES ('global', 2000) 
ON CONFLICT (id) DO NOTHING;
