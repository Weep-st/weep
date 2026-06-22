-- ═══════════════════════════════════════════════════
-- WEEP — Pedidos Temporales (Mercado Pago)
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pedidos_temporales (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL,
  cart_data JSONB NOT NULL,
  order_info JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Security) - Optional but recommended
-- ALTER TABLE pedidos_temporales ENABLE ROW LEVEL SECURITY;

-- Index for cleaning old orders or querying
CREATE INDEX IF NOT EXISTS idx_pedidos_temporales_usuario ON pedidos_temporales(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_temporales_created ON pedidos_temporales(created_at);
