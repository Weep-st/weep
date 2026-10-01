ALTER TABLE repartidores ADD COLUMN IF NOT EXISTS auth_id UUID REFERENCES auth.users(id);
