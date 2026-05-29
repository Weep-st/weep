ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nivel_seguimiento TEXT DEFAULT 'Sin Seguimiento';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS estado_seguimiento TEXT DEFAULT 'Pendiente';
