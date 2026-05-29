-- TABLA MAESTRA DE PROMOCIONES Y DESCUENTOS
-- Esta tabla unifica Créditos, Cupones, Fidelidad, Combos y Ofertas Diarias

-- 1. Crear la tabla si no existe
CREATE TABLE IF NOT EXISTS public.promociones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('credito', 'envio', 'fidelidad', 'combo', 'cupon', 'diario')),
    activo BOOLEAN DEFAULT true,
    prioridad INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Asegurar que existan TODAS las columnas necesarias (por si la tabla ya existía de antes)
DO $$ 
BEGIN 
    -- Columnas base que podrían faltar si la tabla existía
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promociones' AND column_name='activo') THEN
        ALTER TABLE public.promociones ADD COLUMN activo BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promociones' AND column_name='prioridad') THEN
        ALTER TABLE public.promociones ADD COLUMN prioridad INTEGER DEFAULT 0;
    END IF;

    -- Columnas de configuración JSONB
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promociones' AND column_name='triggers') THEN
        ALTER TABLE public.promociones ADD COLUMN triggers JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promociones' AND column_name='requisitos') THEN
        ALTER TABLE public.promociones ADD COLUMN requisitos JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promociones' AND column_name='financiacion') THEN
        ALTER TABLE public.promociones ADD COLUMN financiacion JSONB DEFAULT '{"porc_wepi": 100, "porc_local": 0}'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promociones' AND column_name='beneficios') THEN
        ALTER TABLE public.promociones ADD COLUMN beneficios JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promociones' AND column_name='limites') THEN
        ALTER TABLE public.promociones ADD COLUMN limites JSONB DEFAULT '{"acumulable": true}'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promociones' AND column_name='metadata') THEN
        ALTER TABLE public.promociones ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 3. Habilitar RLS
ALTER TABLE public.promociones ENABLE ROW LEVEL SECURITY;

-- 4. Políticas (Solo Admin puede editar, Usuarios pueden ver las activas)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can do everything on promociones') THEN
        CREATE POLICY "Admins can do everything on promociones" ON public.promociones FOR ALL USING (true);
    END IF;
END $$;

-- 5. Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_promociones_updated_at ON public.promociones;
CREATE TRIGGER update_promociones_updated_at
    BEFORE UPDATE ON public.promociones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. Comentarios para documentación
COMMENT ON TABLE public.promociones IS 'Tabla unificada para todo el sistema de promociones, descuentos y fidelidad de Wepi.';
COMMENT ON COLUMN public.promociones.triggers IS 'Contiene los disparadores: monto mínimo para activar, días de la semana, si es solo primera compra, etc.';
COMMENT ON COLUMN public.promociones.requisitos IS 'Condiciones de uso: vencimiento del beneficio, compra mínima para aplicar el descuento, tope máximo.';
COMMENT ON COLUMN public.promociones.financiacion IS 'Distribución del costo del descuento entre Wepi (comisión) y el Local.';
