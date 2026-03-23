-- ═══════════════════════════════════════════════════
-- WEEP — Schema Migration: Google Apps Script → Supabase
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════

-- ─── 1. Add missing columns to pedidos_general ───
ALTER TABLE pedidos_general ADD COLUMN IF NOT EXISTS repartidor_id TEXT;
ALTER TABLE pedidos_general ADD COLUMN IF NOT EXISTS preference_id TEXT;
ALTER TABLE pedidos_general ADD COLUMN IF NOT EXISTS external_reference TEXT;
ALTER TABLE pedidos_general ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE pedidos_general ADD COLUMN IF NOT EXISTS fecha_pago TIMESTAMPTZ;

-- ─── 2. Add missing columns to pedidos_locales ───
ALTER TABLE pedidos_locales ADD COLUMN IF NOT EXISTS cobro_procesado BOOLEAN DEFAULT FALSE;
ALTER TABLE pedidos_locales ADD COLUMN IF NOT EXISTS metodo_pago TEXT;
ALTER TABLE pedidos_locales ADD COLUMN IF NOT EXISTS calificacion INTEGER;
ALTER TABLE pedidos_locales ADD COLUMN IF NOT EXISTS comentario_calificacion TEXT;

-- ─── 3. Add telefono to usuarios (if missing) ───
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono TEXT;

-- ─── 4. Create gestion_cobros table ───
CREATE TABLE IF NOT EXISTS gestion_cobros (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'Solicitud',
  local_id TEXT NOT NULL REFERENCES locales(id),
  fecha_solicitud TIMESTAMPTZ DEFAULT NOW(),
  total_ventas NUMERIC(12,2) DEFAULT 0,
  comision_weep NUMERIC(12,2) DEFAULT 0,
  total_transferencia NUMERIC(12,2) DEFAULT 0,
  monto_disponible NUMERIC(12,2) DEFAULT 0,
  monto_neto NUMERIC(12,2) DEFAULT 0,
  estado TEXT DEFAULT 'Pendiente',
  pedidos_incluidos TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 5. Create indices for performance ───
CREATE INDEX IF NOT EXISTS idx_pedidos_general_usuario ON pedidos_general(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_general_estado ON pedidos_general(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_general_repartidor ON pedidos_general(repartidor_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_locales_pedido ON pedidos_locales(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_locales_local ON pedidos_locales(local_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_locales_estado ON pedidos_locales(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_items_local ON pedidos_items(pedido_local_id);
CREATE INDEX IF NOT EXISTS idx_menu_local ON menu(local_id);
CREATE INDEX IF NOT EXISTS idx_menu_categoria ON menu(categoria);
CREATE INDEX IF NOT EXISTS idx_favoritos_usuario ON favoritos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_repartidores_estado ON repartidores(estado);
CREATE INDEX IF NOT EXISTS idx_gestion_cobros_local ON gestion_cobros(local_id);
CREATE INDEX IF NOT EXISTS idx_gestion_cobros_estado ON gestion_cobros(estado);
