-- Update helado_sabores to include tipo (Sabor, Salsa)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='helado_sabores' AND column_name='tipo') THEN
    ALTER TABLE helado_sabores ADD COLUMN tipo TEXT DEFAULT 'Sabor';
  END IF;
END $$;

-- Create helado_adicionales for paid extras (e.g. Cucuruchos)
CREATE TABLE IF NOT EXISTS helado_adicionales (
  id SERIAL PRIMARY KEY,
  local_id TEXT NOT NULL REFERENCES locales(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  precio DECIMAL(12,2) DEFAULT 0,
  disponible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_helado_adicionales_local_id ON helado_adicionales(local_id);
