-- Create table for driver payment calendar
CREATE TABLE IF NOT EXISTS public.repartidores_pagos_calendario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repartidor_id TEXT REFERENCES public.repartidores(id) ON DELETE CASCADE,
    monto NUMERIC NOT NULL,
    nota TEXT,
    fecha DATE NOT NULL,
    pedido_ids TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_repartidores_pagos_fecha ON public.repartidores_pagos_calendario(fecha);
CREATE INDEX IF NOT EXISTS idx_repartidores_pagos_repartidor ON public.repartidores_pagos_calendario(repartidor_id);

-- Enable RLS (assuming it's needed, matching project pattern)
ALTER TABLE public.repartidores_pagos_calendario ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies
DROP POLICY IF EXISTS "Admins tienen acceso total a repartidores_pagos_calendario" ON public.repartidores_pagos_calendario;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados" ON public.repartidores_pagos_calendario;
DROP POLICY IF EXISTS "Permitir todo a anon" ON public.repartidores_pagos_calendario;

CREATE POLICY "Permitir todo a usuarios autenticados" ON public.repartidores_pagos_calendario
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Temporarily allow anon to confirm if auth header is missing
CREATE POLICY "Permitir todo a anon" ON public.repartidores_pagos_calendario
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- Explicitly grant permissions
GRANT ALL ON TABLE public.repartidores_pagos_calendario TO anon;
GRANT ALL ON TABLE public.repartidores_pagos_calendario TO authenticated;
GRANT ALL ON TABLE public.repartidores_pagos_calendario TO service_role;
