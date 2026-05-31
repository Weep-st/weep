-- ==============================================================================
-- WEPI - Campaña Mundialista 2026 (Base de Datos & Triggers)
-- VERSIÓN SEGURA PARA NAVEGADORES (Sin operadores menor o mayor para evitar conflictos HTML)
-- Copia este script completo y pégalo en el SQL Editor de tu Dashboard de Supabase
-- ==============================================================================

-- 1. Tabla de Partidos del Mundial
CREATE TABLE IF NOT EXISTS public.mundial_partidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipo_a TEXT NOT NULL,
    equipo_b TEXT NOT NULL,
    bandera_a TEXT,
    bandera_b TEXT,
    fecha_partido TIMESTAMPTZ NOT NULL,
    goles_a INT,
    goles_b INT,
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_curso', 'finalizado')),
    fase TEXT DEFAULT 'Fase de Grupos',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para búsquedas de fecha
CREATE INDEX IF NOT EXISTS idx_mundial_partidos_fecha ON public.mundial_partidos(fecha_partido);

-- 2. Tabla de Figuritas de la Revista (39 en Total)
CREATE TABLE IF NOT EXISTS public.mundial_figuritas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero INT UNIQUE NOT NULL CHECK (numero BETWEEN 1 AND 39),
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL CHECK (categoria IN ('Argentina', 'Especiales', 'Estrellas Globales', 'Leyendas')),
    rareza TEXT DEFAULT 'comun' CHECK (rareza IN ('comun', 'dificil', 'legendaria')),
    foto_url TEXT, -- Añadido por el admin desde base
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de Configuración de la Campaña Mundialista (Premios, etc.)
CREATE TABLE IF NOT EXISTS public.mundial_config (
    id TEXT PRIMARY KEY DEFAULT 'global',
    streak_3_premio_tipo TEXT DEFAULT 'puntos' CHECK (streak_3_premio_tipo IN ('puntos', 'credito_wallet', 'sobre_figuritas')),
    streak_3_premio_cantidad INT DEFAULT 50,
    streak_3_campaign_id UUID, -- Billetera Wepi Campaign

    streak_7_premio_tipo TEXT DEFAULT 'credito_wallet' CHECK (streak_7_premio_tipo IN ('puntos', 'credito_wallet', 'sobre_figuritas')),
    streak_7_premio_cantidad INT DEFAULT 200,
    streak_7_campaign_id UUID,

    album_completado_campaign_id UUID,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar config por defecto
INSERT INTO public.mundial_config (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;

-- 4. Estadísticas del Usuario en la Campaña
CREATE TABLE IF NOT EXISTS public.mundial_usuario_stats (
    usuario_id TEXT PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
    puntos_totales INT DEFAULT 0,
    racha_actual INT DEFAULT 0,
    racha_maxima INT DEFAULT 0,
    ultima_participacion_at TIMESTAMPTZ,
    sobres_disponibles INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabla de Pronósticos del Usuario
CREATE TABLE IF NOT EXISTS public.mundial_pronosticos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id TEXT NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    partido_id UUID NOT NULL REFERENCES public.mundial_partidos(id) ON DELETE CASCADE,
    pronostico_a INT NOT NULL,
    pronostico_b INT NOT NULL,
    puntos_ganados INT DEFAULT 0,
    procesado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_usuario_partido_mundial UNIQUE (usuario_id, partido_id)
);

CREATE INDEX IF NOT EXISTS idx_mundial_pronosticos_user ON public.mundial_pronosticos(usuario_id);

-- 6. Tabla de Misiones Diarias
CREATE TABLE IF NOT EXISTS public.mundial_misiones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    puntos_premio INT DEFAULT 50,
    tipo TEXT NOT NULL CHECK (tipo IN ('pedido', 'pronostico', 'login_diario')),
    fecha DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Registro de Misiones Completadas
CREATE TABLE IF NOT EXISTS public.mundial_misiones_usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id TEXT NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    mision_id UUID NOT NULL REFERENCES public.mundial_misiones(id) ON DELETE CASCADE,
    completado_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_mision_usuario_dia_mundial UNIQUE (usuario_id, mision_id)
);

-- 8. Calendario de Premios (39 Días)
CREATE TABLE IF NOT EXISTS public.mundial_calendario_premios (
    dia INT PRIMARY KEY CHECK (dia BETWEEN 1 AND 39),
    premio_tipo TEXT CHECK (premio_tipo IN ('puntos', 'credito_wallet', 'sobre_figuritas')),
    premio_cantidad INT NOT NULL,
    campaign_id UUID, -- Vinculable con wallet_campaigns
    descripcion TEXT
);

-- 9. Registro de Reclamos del Calendario Diario
CREATE TABLE IF NOT EXISTS public.mundial_calendario_reclamos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id TEXT NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    dia INT NOT NULL REFERENCES public.mundial_calendario_premios(dia) ON DELETE CASCADE,
    reclamado_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_dia_usuario_mundial UNIQUE (usuario_id, dia)
);

-- 10. Figuritas Adquiridas por el Usuario
CREATE TABLE IF NOT EXISTS public.mundial_usuario_figuritas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id TEXT NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    figurita_id UUID NOT NULL REFERENCES public.mundial_figuritas(id) ON DELETE CASCADE,
    cantidad INT DEFAULT 1 CHECK (cantidad = ABS(cantidad)),
    pegada BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_usuario_figurita_mundial UNIQUE (usuario_id, figurita_id)
);

CREATE INDEX IF NOT EXISTS idx_mundial_usuario_figs ON public.mundial_usuario_figuritas(usuario_id);

-- ==============================================================================
-- TRIGGERS Y FUNCIONES ALMACENADAS (RPC)
-- ==============================================================================

-- Trigger para procesar los puntos al finalizar un partido (Seguro sin mayor/menor)
CREATE OR REPLACE FUNCTION public.fn_procesar_puntos_partido()
RETURNS trigger AS $$
DECLARE
    v_pronostico RECORD;
    v_puntos INT;
BEGIN
    IF NEW.estado = 'finalizado' AND NEW.goles_a IS NOT NULL AND NEW.goles_b IS NOT NULL THEN
        FOR v_pronostico IN 
            SELECT * FROM public.mundial_pronosticos 
            WHERE partido_id = NEW.id AND procesado = FALSE
        LOOP
            v_puntos := 0;

            -- Acierto Exacto (250 Puntos)
            IF v_pronostico.pronostico_a = NEW.goles_a AND v_pronostico.pronostico_b = NEW.goles_b THEN
                v_puntos := 250;
            -- Acierto de Ganador o Empate sin marcador exacto (100 Puntos)
            -- Usamos la función SIGN matemática para evitar operadores de mayor/menor en el navegador
            ELSIF SIGN(v_pronostico.pronostico_a - v_pronostico.pronostico_b) = SIGN(NEW.goles_a - NEW.goles_b) THEN
                v_puntos := 100;
            END IF;

            UPDATE public.mundial_pronosticos 
            SET puntos_ganados = v_puntos, procesado = TRUE 
            WHERE id = v_pronostico.id;

            -- Incrementar puntos totales del usuario
            INSERT INTO public.mundial_usuario_stats (usuario_id, puntos_totales)
            VALUES (v_pronostico.usuario_id, v_puntos)
            ON CONFLICT (usuario_id) 
            DO UPDATE SET puntos_totales = mundial_usuario_stats.puntos_totales + EXCLUDED.puntos_totales;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_procesar_puntos_partido ON public.mundial_partidos;
CREATE TRIGGER tr_procesar_puntos_partido
AFTER UPDATE OF estado ON public.mundial_partidos
FOR EACH ROW
EXECUTE FUNCTION public.fn_procesar_puntos_partido();

-- RPC para reclamar premio del calendario diario (Seguro sin mayor/menor)
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
    -- Calcular el día activo de campaña
    IF (v_today - '2026-06-11'::DATE) BETWEEN -100000 AND -1 THEN
        v_active_day := 1;
    ELSE
        v_active_day := (v_today - '2026-06-11'::DATE) + 1;
        IF v_active_day BETWEEN 40 AND 100000 THEN
            v_active_day := 39;
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

    -- Actualizar racha diaria usando BETWEEN en lugar de mayor o igual para evitar tag stripping
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

-- Implementación detallada de la apertura de sobres
CREATE OR REPLACE FUNCTION public.fn_abrir_sobre_mundialista(p_usuario_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_sobres INT;
    v_fig_1 UUID;
    v_fig_2 UUID;
    v_fig_3 UUID;
    v_resultado JSONB;
BEGIN
    -- Usamos comparación estricta de igualdad para evitar el símbolo menor-que
    SELECT sobres_disponibles INTO v_sobres FROM public.mundial_usuario_stats WHERE usuario_id = p_usuario_id;
    IF v_sobres IS NULL OR v_sobres = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No tienes sobres disponibles.');
    END IF;

    -- Descontar sobre
    UPDATE public.mundial_usuario_stats 
    SET sobres_disponibles = sobres_disponibles - 1 
    WHERE usuario_id = p_usuario_id;

    -- Obtener 3 figuritas aleatorias
    SELECT id INTO v_fig_1 FROM public.mundial_figuritas ORDER BY RANDOM() LIMIT 1;
    SELECT id INTO v_fig_2 FROM public.mundial_figuritas ORDER BY RANDOM() LIMIT 1;
    SELECT id INTO v_fig_3 FROM public.mundial_figuritas ORDER BY RANDOM() LIMIT 1;

    -- Registrar figurita 1
    INSERT INTO public.mundial_usuario_figuritas (usuario_id, figurita_id, cantidad, pegada)
    VALUES (p_usuario_id, v_fig_1, 1, false)
    ON CONFLICT (usuario_id, figurita_id) DO UPDATE SET cantidad = mundial_usuario_figuritas.cantidad + 1;

    -- Registrar figurita 2
    INSERT INTO public.mundial_usuario_figuritas (usuario_id, figurita_id, cantidad, pegada)
    VALUES (p_usuario_id, v_fig_2, 1, false)
    ON CONFLICT (usuario_id, figurita_id) DO UPDATE SET cantidad = mundial_usuario_figuritas.cantidad + 1;

    -- Registrar figurita 3
    INSERT INTO public.mundial_usuario_figuritas (usuario_id, figurita_id, cantidad, pegada)
    VALUES (p_usuario_id, v_fig_3, 1, false)
    ON CONFLICT (usuario_id, figurita_id) DO UPDATE SET cantidad = mundial_usuario_figuritas.cantidad + 1;

    -- Retornar las figuritas obtenidas
    SELECT jsonb_agg(f) INTO v_resultado
    FROM (
        SELECT id, numero, nombre, categoria, rareza, foto_url 
        FROM public.mundial_figuritas 
        WHERE id IN (v_fig_1, v_fig_2, v_fig_3)
    ) f;

    RETURN jsonb_build_object('success', true, 'figuritas', v_resultado);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para pegar figurita en el álbum (Seguro sin mayor/menor)
CREATE OR REPLACE FUNCTION public.fn_pegar_figurita_mundialista(
    p_usuario_id TEXT,
    p_figurita_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_cantidad INT;
    v_pegada BOOLEAN;
BEGIN
    SELECT cantidad, pegada INTO v_cantidad, v_pegada 
    FROM public.mundial_usuario_figuritas 
    WHERE usuario_id = p_usuario_id AND figurita_id = p_figurita_id;

    IF v_cantidad IS NULL OR v_cantidad = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No tienes esta figurita.');
    END IF;

    IF v_pegada = TRUE THEN
        RETURN jsonb_build_object('success', false, 'message', 'Esta figurita ya está pegada.');
    END IF;

    -- Pegar la figurita y descontar una cantidad de las disponibles sin pegar
    UPDATE public.mundial_usuario_figuritas
    SET pegada = true, cantidad = cantidad - 1
    WHERE usuario_id = p_usuario_id AND figurita_id = p_figurita_id;

    RETURN jsonb_build_object('success', true, 'message', '¡Figurita pegada con éxito!');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para reciclar 3 repetidas a cambio de 1 sobre cerrado (Seguro sin mayor/menor)
CREATE OR REPLACE FUNCTION public.fn_reciclar_repetidas_mundialista(
    p_usuario_id TEXT,
    p_fig1 UUID,
    p_fig2 UUID,
    p_fig3 UUID
) RETURNS JSONB AS $$
DECLARE
    v_c1 INT;
    v_c2 INT;
    v_c3 INT;
BEGIN
    -- Validar cantidades repetidas (evitando operadores menor-que)
    SELECT cantidad INTO v_c1 FROM public.mundial_usuario_figuritas WHERE usuario_id = p_usuario_id AND figurita_id = p_fig1;
    SELECT cantidad INTO v_c2 FROM public.mundial_usuario_figuritas WHERE usuario_id = p_usuario_id AND figurita_id = p_fig2;
    SELECT cantidad INTO v_c3 FROM public.mundial_usuario_figuritas WHERE usuario_id = p_usuario_id AND figurita_id = p_fig3;

    IF v_c1 IS NULL OR v_c1 = 0 OR v_c2 IS NULL OR v_c2 = 0 OR v_c3 IS NULL OR v_c3 = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No posees suficientes repetidas seleccionadas.');
    END IF;

    -- Descontar las 3 figuritas
    UPDATE public.mundial_usuario_figuritas SET cantidad = cantidad - 1 WHERE usuario_id = p_usuario_id AND figurita_id = p_fig1;
    UPDATE public.mundial_usuario_figuritas SET cantidad = cantidad - 1 WHERE usuario_id = p_usuario_id AND figurita_id = p_fig2;
    UPDATE public.mundial_usuario_figuritas SET cantidad = cantidad - 1 WHERE usuario_id = p_usuario_id AND figurita_id = p_fig3;

    -- Agregar un sobre gratis
    INSERT INTO public.mundial_usuario_stats (usuario_id, sobres_disponibles)
    VALUES (p_usuario_id, 1)
    ON CONFLICT (usuario_id)
    DO UPDATE SET sobres_disponibles = mundial_usuario_stats.sobres_disponibles + 1;

    RETURN jsonb_build_object('success', true, 'message', '¡Reciclaje exitoso! Ganaste 1 sobre gratis cerrado ✉️');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para completar la misión diaria de login (Seguro sin mayor/menor)
CREATE OR REPLACE FUNCTION public.fn_mision_login_diario(p_usuario_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_mision UUID;
    v_completada BOOLEAN;
BEGIN
    -- Buscar si hay una misión de login activo para el día de hoy
    SELECT id INTO v_mision FROM public.mundial_misiones 
    WHERE tipo = 'login_diario' AND fecha = CURRENT_DATE LIMIT 1;

    -- Si no existe la misión diaria, la creamos al vuelo
    IF v_mision IS NULL THEN
        INSERT INTO public.mundial_misiones (titulo, descripcion, puntos_premio, tipo, fecha)
        VALUES ('Ingreso Diario', 'Entrá a la sección mundialista hoy para sumar puntos', 20, 'login_diario', CURRENT_DATE)
        RETURNING id INTO v_mision;
    END IF;

    -- Verificar si ya está completada
    SELECT EXISTS (
        SELECT 1 FROM public.mundial_misiones_usuarios 
        WHERE usuario_id = p_usuario_id AND mision_id = v_mision
    ) INTO v_completada;

    IF v_completada THEN
        RETURN jsonb_build_object('success', true, 'message', 'Misión ya completada.');
    END IF;

    -- Marcar como completada
    INSERT INTO public.mundial_misiones_usuarios (usuario_id, mision_id)
    VALUES (p_usuario_id, v_mision);

    -- Sumar puntos de misión
    INSERT INTO public.mundial_usuario_stats (usuario_id, puntos_totales)
    VALUES (p_usuario_id, 20)
    ON CONFLICT (usuario_id)
    DO UPDATE SET puntos_totales = mundial_usuario_stats.puntos_totales + 20;

    RETURN jsonb_build_object('success', true, 'message', '¡Misión diaria de ingreso completada! +20 puntos.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- PRE-POBLAR DATOS DE LA TABLA FIGURITAS (39 JUGADORES/SLOTS)
-- ==============================================================================
DO $$
BEGIN
    -- 1 al 26: Argentina
    FOR i IN 1..26 LOOP
        INSERT INTO public.mundial_figuritas (numero, nombre, categoria, rareza)
        VALUES (i, 'Jugador Selección #' || i, 'Argentina', CASE WHEN i IN (10, 11, 23) THEN 'legendaria' ELSE 'comun' END)
        ON CONFLICT (numero) DO NOTHING;
    END LOOP;

    -- 27 al 29: Intro & Mascotas
    FOR i IN 27..29 LOOP
        INSERT INTO public.mundial_figuritas (numero, nombre, categoria, rareza)
        VALUES (i, 'Escudo / Mascota #' || i, 'Especiales', 'dificil')
        ON CONFLICT (numero) DO NOTHING;
    END LOOP;

    -- 30 al 34: Estrellas Globales
    FOR i IN 30..34 LOOP
        INSERT INTO public.mundial_figuritas (numero, nombre, categoria, rareza)
        VALUES (i, 'Estrella Mundial #' || i, 'Estrellas Globales', 'comun')
        ON CONFLICT (numero) DO NOTHING;
    END LOOP;

    -- 35 al 39: Leyendas Históricas
    FOR i IN 35..39 LOOP
        INSERT INTO public.mundial_figuritas (numero, nombre, categoria, rareza)
        VALUES (i, 'Leyenda Histórica #' || i, 'Leyendas', 'legendaria')
        ON CONFLICT (numero) DO NOTHING;
    END LOOP;
END $$;

-- ==============================================================================
-- PRE-POBLAR DATOS DE LA TABLA CALENDARIO (39 DÍAS)
-- ==============================================================================
DO $$
DECLARE
    v_descr TEXT;
    v_cantidad INT;
    v_tipo TEXT;
BEGIN
    FOR i IN 1..39 LOOP
        v_tipo := 'puntos';
        v_cantidad := 30;
        v_descr := 'Sumá ' || v_cantidad || ' puntos de campaña';

        -- Días de sobres
        IF i IN (2, 6, 10, 13, 16, 20, 24, 28, 32, 36) THEN
            v_tipo := 'sobre_figuritas';
            v_cantidad := 1;
            v_descr := '¡Reclamá 1 paquete de figuritas cerrado!';
        -- Días especiales con más sobres
        ELSIF i IN (18, 35) THEN
            v_tipo := 'sobre_figuritas';
            v_cantidad := 2;
            v_descr := '¡Premio doble: 2 paquetes de figuritas!';
        -- Días de crédito Wallet
        ELSIF i = 5 THEN
            v_tipo := 'credito_wallet';
            v_cantidad := 100;
            v_descr := '¡$100 de crédito de regalo para tu Wallet!';
        ELSIF i = 7 THEN
            v_tipo := 'credito_wallet';
            v_cantidad := 200;
            v_descr := '¡$200 de crédito de regalo!';
        ELSIF i = 14 THEN
            v_tipo := 'credito_wallet';
            v_cantidad := 400;
            v_descr := '¡$400 de crédito de regalo!';
        ELSIF i = 21 THEN
            v_tipo := 'credito_wallet';
            v_cantidad := 600;
            v_descr := '¡$600 de crédito de regalo!';
        ELSIF i = 30 THEN
            v_tipo := 'credito_wallet';
            v_cantidad := 800;
            v_descr := '¡$800 de crédito de regalo!';
        ELSIF i = 39 THEN
            v_tipo := 'credito_wallet';
            v_cantidad := 1500;
            v_descr := '¡Gran Premio Final: $1,500 en tu Wallet!';
        END IF;

        INSERT INTO public.mundial_calendario_premios (dia, premio_tipo, premio_cantidad, descripcion)
        VALUES (i, v_tipo, v_cantidad, v_descr)
        ON CONFLICT (dia) DO NOTHING;
    END LOOP;
END $$;
