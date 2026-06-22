-- ==============================================================================
-- WEPI - Lanzamiento de Campaña Mundialista 2026
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase.
-- ==============================================================================

-- 1. Eliminar la restricción de límite de 39 figuritas y permitir figuritas adicionales (sponsors, etc.)
ALTER TABLE public.mundial_figuritas DROP CONSTRAINT IF EXISTS mundial_figuritas_numero_check;
ALTER TABLE public.mundial_figuritas ADD CONSTRAINT mundial_figuritas_numero_check CHECK (numero >= 1);

-- 1b. Eliminar la restricción de límite de 39 días en el calendario de premios y permitir extender a 48 días o más
ALTER TABLE public.mundial_calendario_premios DROP CONSTRAINT IF EXISTS mundial_calendario_premios_dia_check;
ALTER TABLE public.mundial_calendario_premios ADD CONSTRAINT mundial_calendario_premios_dia_check CHECK (dia >= 1);

-- 2. Recrear la función de reclamar premio calendario con fecha base 2026-06-02 y límite de 48 días
CREATE OR REPLACE FUNCTION public.fn_reclamar_premio_calendario(
    p_usuario_id TEXT,
    p_dia INT
) RETURNS JSONB AS $$
DECLARE
    v_premio RECORD;
    v_ya_reclamado BOOLEAN;
    v_expiry INTEGER := 15;
    v_description TEXT;
    v_active_day INT;
    v_today DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
BEGIN
    -- Calcular el día activo de campaña basándose en la fecha oficial de inicio 2 de Junio (2026-06-02)
    IF (v_today - '2026-06-02'::DATE) BETWEEN -100000 AND -1 THEN
        v_active_day := 1;
    ELSE
        v_active_day := (v_today - '2026-06-02'::DATE) + 1;
        -- Límite estricto de finalización al día 48 (19 de Julio)
        IF v_active_day BETWEEN 49 AND 100000 THEN
            v_active_day := 48;
        END IF;
    END IF;

    -- Validar que solo se pueda reclamar el día activo
    IF p_dia != v_active_day THEN
        IF (p_dia - v_active_day) BETWEEN -100000 AND -1 THEN
            RETURN jsonb_build_object('success', false, 'message', 'Este premio ha expirado (era del Día ' || p_dia || ').');
        ELSE
            RETURN jsonb_build_object('success', false, 'message', 'Este premio aún está bloqueado. Estará disponible el día de su fecha correspondiente.');
        END IF;
    END IF;

    -- Verificar si ya fue reclamado
    SELECT EXISTS(
        SELECT 1 FROM public.mundial_calendario_reclamos 
        WHERE usuario_id = p_usuario_id AND dia = p_dia
    ) INTO v_ya_reclamado;

    IF v_ya_reclamado THEN
        RETURN jsonb_build_object('success', false, 'message', 'Este día ya fue reclamado.');
    END IF;

    -- Obtener detalles del premio
    SELECT * INTO v_premio FROM public.mundial_calendario_premios WHERE dia = p_dia;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Premio no configurado.');
    END IF;

    -- Insertar reclamo
    INSERT INTO public.mundial_calendario_reclamos (usuario_id, dia)
    VALUES (p_usuario_id, p_dia);

    -- Procesar premio según tipo
    IF v_premio.premio_tipo = 'puntos' THEN
        INSERT INTO public.mundial_usuario_stats (usuario_id, puntos_totales)
        VALUES (p_usuario_id, v_premio.premio_cantidad)
        ON CONFLICT (usuario_id) 
        DO UPDATE SET puntos_totales = mundial_usuario_stats.puntos_totales + EXCLUDED.puntos_totales;

    ELSIF v_premio.premio_tipo = 'credito_wallet' THEN
        v_description := 'Premio Mundial Día ' || p_dia;
        
        -- Obtener tiempo de expiración si la campaña tiene uno específico
        IF v_premio.campaign_id IS NOT NULL THEN
            SELECT expiry_days INTO v_expiry FROM public.wallet_campaigns WHERE id = v_premio.campaign_id;
        END IF;

        -- Inyección directa en transacciones del sistema Wallet
        INSERT INTO public.wallet_transactions (user_id, type, amount, campaign_id, description, expires_at)
        VALUES (p_usuario_id, 'earn', v_premio.premio_cantidad, v_premio.campaign_id, v_description, NOW() + (COALESCE(v_expiry, 15) || ' days')::INTERVAL);

    ELSIF v_premio.premio_tipo = 'sobre_figuritas' THEN
        INSERT INTO public.mundial_usuario_stats (usuario_id, sobres_disponibles)
        VALUES (p_usuario_id, v_premio.premio_cantidad)
        ON CONFLICT (usuario_id) 
        DO UPDATE SET sobres_disponibles = mundial_usuario_stats.sobres_disponibles + EXCLUDED.sobres_disponibles;
    END IF;

    -- Actualizar última participación y racha diaria si es hoy
    INSERT INTO public.mundial_usuario_stats (usuario_id, racha_actual, ultima_participacion_at)
    VALUES (p_usuario_id, 1, NOW())
    ON CONFLICT (usuario_id)
    DO UPDATE SET 
        racha_actual = CASE 
            WHEN mundial_usuario_stats.ultima_participacion_at BETWEEN (NOW() - INTERVAL '36 hours') AND NOW() THEN mundial_usuario_stats.racha_actual + 1
            ELSE 1
        END,
        racha_maxima = GREATEST(mundial_usuario_stats.racha_maxima, CASE 
            WHEN mundial_usuario_stats.ultima_participacion_at BETWEEN (NOW() - INTERVAL '36 hours') AND NOW() THEN mundial_usuario_stats.racha_actual + 1
            ELSE 1
        END),
        ultima_participacion_at = NOW();

    RETURN jsonb_build_object('success', true, 'message', '¡Premio reclamado con éxito!', 'tipo', v_premio.premio_tipo, 'cantidad', v_premio.premio_cantidad);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Cargar los días adicionales del calendario (Días 40 al 48)
INSERT INTO public.mundial_calendario_premios (dia, premio_tipo, premio_cantidad, descripcion)
VALUES 
(40, 'puntos', 50, 'Sumá 50 puntos de campaña'),
(41, 'sobre_figuritas', 2, '¡Premio doble: 2 paquetes de figuritas!'),
(42, 'puntos', 50, 'Sumá 50 puntos de campaña'),
(43, 'sobre_figuritas', 2, '¡Premio doble: 2 paquetes de figuritas!'),
(44, 'credito_wallet', 500, '¡$500 de crédito de regalo para tu Wallet!'),
(45, 'sobre_figuritas', 3, '¡Súper pack: 3 paquetes de figuritas!'),
(46, 'puntos', 50, 'Sumá 50 puntos de campaña'),
(47, 'sobre_figuritas', 4, '¡Mega premio: 4 paquetes de figuritas de regalo!'),
(48, 'credito_wallet', 2000, '¡Gran Premio de la Gran Final: $2,000 en tu Wallet!')
ON CONFLICT (dia) DO UPDATE SET
  premio_tipo = EXCLUDED.premio_tipo,
  premio_cantidad = EXCLUDED.premio_cantidad,
  descripcion = EXCLUDED.descripcion;

-- 4. Recargar caché del backend API de Supabase PostgREST
NOTIFY pgrst, 'reload schema';
