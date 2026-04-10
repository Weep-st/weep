-- Add deadline and priority to admin_tasks
ALTER TABLE admin_tasks ADD COLUMN IF NOT EXISTS fecha_finalizacion DATE;
ALTER TABLE admin_tasks ADD COLUMN IF NOT EXISTS prioridad TEXT DEFAULT 'Media';
ALTER TABLE admin_tasks ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'GENERAL';
