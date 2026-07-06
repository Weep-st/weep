-- ═══════════════════════════════════════════════════
-- MIGRACIÓN: CREACIÓN DE TABLA DE LEADS PARA EXPANSIÓN (OBERÁ)
-- Ejecutar en Supabase (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.leads_expansion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    nombre TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    email TEXT,
    ciudad TEXT NOT NULL
);

-- 1. Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.leads_expansion ENABLE ROW LEVEL SECURITY;

-- 2. Crear Política para permitir inserciones públicas (anónimas)
CREATE POLICY "Permitir inserciones públicas de leads" 
ON public.leads_expansion 
FOR INSERT 
TO anon 
WITH CHECK (true);

-- 3. Crear Política para que los administradores puedan leer y gestionar los leads
CREATE POLICY "Permitir lectura de leads a administradores" 
ON public.leads_expansion 
FOR SELECT 
TO authenticated 
USING (true);
