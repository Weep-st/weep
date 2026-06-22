-- ─── 1. Add admin_status to locales ───
ALTER TABLE locales ADD COLUMN IF NOT EXISTS admin_status TEXT DEFAULT 'Pendiente';

-- ─── 2. Add role to usuarios ───
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- ─── 3. Create admin_tasks table ───
CREATE TABLE IF NOT EXISTS admin_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea TEXT NOT NULL,
  estado TEXT DEFAULT 'Pendiente',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  usuario_id TEXT -- Opcional: para saber quién creó la tarea
);

-- ─── 4. Note: I'll update the user roles manually in a later step if needed,
-- but the columns must exist first.
