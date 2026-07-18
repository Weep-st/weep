-- ═══════════════════════════════════════════════════
-- MIGRACIÓN: CREAR TABLA DE USUARIOS SECUNDARIOS DE LOCALES (CAJAS)
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.locales_usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT REFERENCES public.locales(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,                  -- Nombre para mostrar (ej: "Caja 1")
    username TEXT UNIQUE NOT NULL,         -- Nombre de usuario para login (ej: "caja1_sucursal")
    password TEXT NOT NULL,
    rol TEXT DEFAULT 'Cajero',             -- 'Admin', 'Cajero'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para búsquedas rápidas por username y local
CREATE INDEX IF NOT EXISTS idx_locales_usuarios_username ON public.locales_usuarios(username);
CREATE INDEX IF NOT EXISTS idx_locales_usuarios_local_id ON public.locales_usuarios(local_id);

-- Desactivar Row Level Security (RLS) para permitir accesos directos desde el cliente
ALTER TABLE public.locales_usuarios DISABLE ROW LEVEL SECURITY;
