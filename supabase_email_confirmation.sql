-- ═══════════════════════════════════════════════════
-- WEEP — Email Confirmation Schema
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- 1. Add columns to 'usuarios'
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS email_confirmado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS token_confirmacion TEXT;

-- 2. Add columns to 'locales'
ALTER TABLE locales 
ADD COLUMN IF NOT EXISTS email_confirmado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS token_confirmacion TEXT;

-- 3. Add columns to 'repartidores'
ALTER TABLE repartidores 
ADD COLUMN IF NOT EXISTS email_confirmado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS token_confirmacion TEXT;

-- Optional: Index for faster token lookup
CREATE INDEX IF NOT EXISTS idx_usuarios_token ON usuarios(token_confirmacion);
CREATE INDEX IF NOT EXISTS idx_locales_token ON locales(token_confirmacion);
CREATE INDEX IF NOT EXISTS idx_repartidores_token ON repartidores(token_confirmacion);

-- 4. RLS Policies for email confirmation (allow anyone with the token to update)
-- Use DO blocks to avoid errors if policies already exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow email confirmation update' AND tablename = 'usuarios') THEN
        CREATE POLICY "Allow email confirmation update" ON usuarios FOR UPDATE USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow email confirmation update' AND tablename = 'locales') THEN
        CREATE POLICY "Allow email confirmation update" ON locales FOR UPDATE USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow email confirmation update' AND tablename = 'repartidores') THEN
        CREATE POLICY "Allow email confirmation update" ON repartidores FOR UPDATE USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 5. RPC Function for email confirmation (Bypasses RLS issues)
-- This function runs with SECURITY DEFINER, meaning it uses the owner's 
-- permissions to update the table, regardless of RLS settings.
CREATE OR REPLACE FUNCTION confirmar_email(token_input TEXT, tipo_input TEXT, email_input TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    affected_rows INT;
BEGIN
    IF tipo_input = 'usuario' THEN
        UPDATE usuarios 
        SET email_confirmado = TRUE, token_confirmacion = NULL 
        WHERE token_confirmacion = token_input AND email = email_input;
    ELSIF tipo_input = 'local' THEN
        UPDATE locales 
        SET email_confirmado = TRUE, token_confirmacion = NULL 
        WHERE token_confirmacion = token_input AND email = email_input;
    ELSIF tipo_input = 'repartidor' THEN
        UPDATE repartidores 
        SET email_confirmado = TRUE, token_confirmacion = NULL 
        WHERE token_confirmacion = token_input AND email = email_input;
    ELSE
        RETURN FALSE;
    END IF;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN affected_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
