-- ═══════════════════════════════════════════════════
-- MIGRACIÓN: PLANES FISCALES Y ROLES DE LOCAL
-- ═══════════════════════════════════════════════════

-- 1. Añadir tipo de plan al local
ALTER TABLE public.locales 
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'Emprendedor';

-- 2. Crear tabla para usuarios adicionales del local (Empresas)
CREATE TABLE IF NOT EXISTS public.locales_usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT REFERENCES public.locales(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol TEXT DEFAULT 'Cajero', -- 'Admin', 'Cajero'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_locales_usuarios_email ON public.locales_usuarios(email);
CREATE INDEX IF NOT EXISTS idx_locales_usuarios_local_id ON public.locales_usuarios(local_id);

-- Comentario para auditoría
COMMENT ON COLUMN public.locales.plan_type IS 'Tipo de plan: Emprendedor (Gratis) o Empresa (Pago/Fiscal)';
COMMENT ON TABLE public.locales_usuarios IS 'Usuarios secundarios para locales con Plan Empresa';
