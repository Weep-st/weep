-- ==============================================================================
-- WEPI - Campaña Mundialista 2026: Ampliación de Herramientas de Administración
-- Ejecutá este script en el SQL Editor de tu Dashboard de Supabase.
-- Habilita el control de misiones avanzadas, códigos de canje (cupones) y funciones
-- de seguridad de canje sin operadores de etiqueta HTML para evitar problemas.
-- ==============================================================================

-- 1. Alterar restricción de tipo de misión para admitir verificación y minijuegos
ALTER TABLE public.mundial_misiones DROP CONSTRAINT IF EXISTS mundial_misiones_tipo_check;
ALTER TABLE public.mundial_misiones ADD CONSTRAINT mundial_misiones_tipo_check 
CHECK (tipo IN ('pedido', 'pronostico', 'login_diario', 'imagen_verificacion', 'minijuego_penales', 'minijuego_trivia'));

-- 2. Crear tabla de códigos de cupones / canjes mundialistas
CREATE TABLE IF NOT EXISTS public.mundial_cupones (
    codigo TEXT PRIMARY KEY,
    premio_tipo TEXT NOT NULL CHECK (premio_tipo IN ('puntos', 'sobre_figuritas', 'figurita_especifica')),
    premio_cantidad INT DEFAULT 1,
    figurita_numero INT,
    activo BOOLEAN DEFAULT TRUE,
    limite_usos INT DEFAULT 100,
    usos_actuales INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS bypass
ALTER TABLE public.mundial_cupones DISABLE ROW LEVEL SECURITY;

-- 3. Tabla de registro de canjes por usuario
CREATE TABLE IF NOT EXISTS public.mundial_cupones_usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id TEXT NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    cupon_codigo TEXT NOT NULL REFERENCES public.mundial_cupones(codigo) ON DELETE CASCADE,
    canjeado_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_usuario_cupon_mundial UNIQUE (usuario_id, cupon_codigo)
);

-- RLS bypass
ALTER TABLE public.mundial_cupones_usuarios DISABLE ROW LEVEL SECURITY;

-- 4. RPC segura para procesar el canje de cupones (Seguro contra stripping HTML)
CREATE OR REPLACE FUNCTION public.fn_canjear_cupon_mundialista(
    p_usuario_id TEXT,
    p_codigo TEXT
) RETURNS JSONB AS $$
DECLARE
    v_cupon RECORD;
    v_ya_canjeado BOOLEAN;
    v_fig_id UUID;
    v_fig_nombre TEXT;
BEGIN
    -- Buscar cupón activo (fuerza mayúsculas en búsqueda)
    SELECT * INTO v_cupon FROM public.mundial_cupones 
    WHERE UPPER(codigo) = UPPER(p_codigo) AND activo = TRUE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Código de cupón inválido o inactivo.');
    END IF;

    -- Verificar límite de usos de forma matemática segura (limite_usos - usos_actuales <= 0)
    IF (v_cupon.limite_usos - v_cupon.usos_actuales) BETWEEN -100000 AND 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Este cupón ha agotado su límite de usos.');
    END IF;

    -- Verificar si el usuario ya lo canjeó
    SELECT EXISTS (
        SELECT 1 FROM public.mundial_cupones_usuarios 
        WHERE usuario_id = p_usuario_id AND UPPER(cupon_codigo) = UPPER(v_cupon.codigo)
    ) INTO v_ya_canjeado;

    IF v_ya_canjeado THEN
        RETURN jsonb_build_object('success', false, 'message', 'Ya has canjeado este código de cupón.');
    END IF;

    -- Registrar el canje
    INSERT INTO public.mundial_cupones_usuarios (usuario_id, cupon_codigo)
    VALUES (p_usuario_id, v_cupon.codigo);

    -- Incrementar usos del cupón
    UPDATE public.mundial_cupones 
    SET usos_actuales = usos_actuales + 1 
    WHERE codigo = v_cupon.codigo;

    -- Entregar premio según tipo
    IF v_cupon.premio_tipo = 'puntos' THEN
        INSERT INTO public.mundial_usuario_stats (usuario_id, puntos_totales)
        VALUES (p_usuario_id, v_cupon.premio_cantidad)
        ON CONFLICT (usuario_id) 
        DO UPDATE SET puntos_totales = mundial_usuario_stats.puntos_totales + EXCLUDED.puntos_totales;

    ELSIF v_cupon.premio_tipo = 'sobre_figuritas' THEN
        INSERT INTO public.mundial_usuario_stats (usuario_id, sobres_disponibles)
        VALUES (p_usuario_id, v_cupon.premio_cantidad)
        ON CONFLICT (usuario_id) 
        DO UPDATE SET sobres_disponibles = mundial_usuario_stats.sobres_disponibles + EXCLUDED.sobres_disponibles;

    ELSIF v_cupon.premio_tipo = 'figurita_especifica' THEN
        SELECT id, nombre INTO v_fig_id, v_fig_nombre FROM public.mundial_figuritas WHERE numero = v_cupon.figurita_numero;
        IF v_fig_id IS NOT NULL THEN
            INSERT INTO public.mundial_usuario_figuritas (usuario_id, figurita_id, cantidad, pegada)
            VALUES (p_usuario_id, v_fig_id, 1, false)
            ON CONFLICT (usuario_id, figurita_id) 
            DO UPDATE SET cantidad = mundial_usuario_figuritas.cantidad + 1;
        ELSE
            RETURN jsonb_build_object('success', false, 'message', 'La figurita asociada a este cupón no está configurada.');
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'message', '¡Código canjeado con éxito! Recibiste tu premio.', 
        'tipo', v_cupon.premio_tipo, 
        'cantidad', v_cupon.premio_cantidad,
        'figurita', v_fig_nombre
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
