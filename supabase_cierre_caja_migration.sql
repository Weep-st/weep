-- Crear tabla de Cierre de Caja para Locales
CREATE TABLE IF NOT EXISTS cierre_caja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id TEXT REFERENCES locales(id),
    fecha DATE NOT NULL,
    total_subtotal DECIMAL(12,2) DEFAULT 0,
    total_comisiones DECIMAL(12,2) DEFAULT 0,
    total_neto_local DECIMAL(12,2) DEFAULT 0,
    total_transferencia DECIMAL(12,2) DEFAULT 0,
    total_efectivo DECIMAL(12,2) DEFAULT 0,
    num_pedidos INTEGER DEFAULT 0,
    datos_detallados JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(local_id, fecha)
);


-- Crear tabla de Cierre de Repartidores (Liquidaciones y Facturación Admin)
CREATE TABLE IF NOT EXISTS cierre_repartidores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha_cierre DATE NOT NULL,
    total_saldado DECIMAL(12,2) DEFAULT 0,
    total_adeudado DECIMAL(12,2) DEFAULT 0,
    num_pedidos INTEGER DEFAULT 0,
    detalles_por_repartidor JSONB DEFAULT '[]',
    datos_pedidos JSONB DEFAULT '[]', -- Para persistir datos antes de borrar
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Añadir columnas de control a las tablas de pedidos
ALTER TABLE pedidos_general ADD COLUMN IF NOT EXISTS cierre_caja BOOLEAN DEFAULT FALSE;
ALTER TABLE pedidos_locales ADD COLUMN IF NOT EXISTS cierre_caja BOOLEAN DEFAULT FALSE;

-- Columna para control de primer pedido (Seguridad Efectivo)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ya_realizo_pedidos BOOLEAN DEFAULT FALSE;

-- Índices para mejorar rendimiento de filtros de cierre
CREATE INDEX IF NOT EXISTS idx_pedidos_general_cierre ON pedidos_general(cierre_caja);
CREATE INDEX IF NOT EXISTS idx_pedidos_locales_cierre ON pedidos_locales(cierre_caja);


-- Habilitar RLS (opcional, dependiendo de tu configuración actual)
ALTER TABLE cierre_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE cierre_repartidores ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (asumiendo que los locales pueden ver sus propios cierres y admins todo)
DROP POLICY IF EXISTS "Locales pueden ver sus propios cierres" ON cierre_caja;
CREATE POLICY "Locales pueden ver sus propios cierres" ON cierre_caja
    FOR SELECT USING (auth.uid()::text = local_id);

DROP POLICY IF EXISTS "Admins tienen acceso total a cierre_caja" ON cierre_caja;
CREATE POLICY "Admins tienen acceso total a cierre_caja" ON cierre_caja
    FOR ALL USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid()::text AND role = 'admin'));

DROP POLICY IF EXISTS "Admins tienen acceso total a cierre_repartidores" ON cierre_repartidores;
CREATE POLICY "Admins tienen acceso total a cierre_repartidores" ON cierre_repartidores
    FOR ALL USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid()::text AND role = 'admin'));

