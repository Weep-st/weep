-- ==============================================================================
-- WEEP - Sistema de Checkout y Gestión de Pedidos (Versión Robusta)
-- ==============================================================================

-- Asegurar columnas necesarias
ALTER TABLE pedidos_general ADD COLUMN IF NOT EXISTS external_reference TEXT;
ALTER TABLE pedidos_general ADD COLUMN IF NOT EXISTS precio_envio NUMERIC DEFAULT 0;
ALTER TABLE pedidos_general ADD COLUMN IF NOT EXISTS cobro_repartidor_procesado BOOLEAN DEFAULT false;
ALTER TABLE pedidos_general ADD COLUMN IF NOT EXISTS local_id TEXT;
ALTER TABLE pedidos_general ADD COLUMN IF NOT EXISTS num_confirmacion TEXT;
ALTER TABLE pedidos_items ADD COLUMN IF NOT EXISTS local_id TEXT;

-- 1. DROP de versiones antiguas para evitar conflictos de sobrecarga
DROP FUNCTION IF EXISTS public.create_pedido_completo(text, text, text, text, text, numeric, text, text, text, numeric, numeric, jsonb);
DROP FUNCTION IF EXISTS public.create_pedido_completo(text, text, text, text, text, numeric, text, text, text, numeric, numeric, jsonb, numeric);

-- 2. FUNCIÓN PRINCIPAL DE CREACIÓN DE PEDIDOS (RESILIENTE)
CREATE OR REPLACE FUNCTION public.create_pedido_completo(
  p_user_id TEXT,
  p_direccion TEXT,
  p_metodo_pago TEXT,
  p_observaciones TEXT,
  p_tipo_entrega TEXT,
  p_total NUMERIC,
  p_estado TEXT,
  p_email_cliente TEXT,
  p_nombre_cliente TEXT,
  p_lat NUMERIC,
  p_lng NUMERIC,
  p_cart JSONB,
  p_precio_envio NUMERIC DEFAULT 0,
  p_id TEXT DEFAULT NULL,
  p_external_reference TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_pedido_id TEXT;
  v_num_confirmacion TEXT;
  v_local_id TEXT;
  v_repartidor_id TEXT;
  v_ped_local_id TEXT;
BEGIN
    -- Bloque principal para capturar errores de triggers laterales (gamificación, OneSignal, etc.)
    BEGIN
        -- Definir ID (Prioridad al proporcionado por el Webhook/Frontend)
        v_pedido_id := COALESCE(p_id, 'PED-' || (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT::TEXT);

        -- Generar PIN de 4 dígitos para seguridad
        v_num_confirmacion := floor(random() * 9000 + 1000)::TEXT;

        -- Extraer el ID del local desde el primer item
        v_local_id := COALESCE(p_cart->0->>'local_id', 'unknown');

        -- Asignar repartidor si es envío
        v_repartidor_id := NULL;
        IF p_tipo_entrega = 'Con Envío' THEN
            SELECT id INTO v_repartidor_id 
            FROM repartidores 
            WHERE estado = 'Activo' 
            AND sesion_vence_en > (NOW() - INTERVAL '3 hours')
            ORDER BY random() 
            LIMIT 1;

            IF v_repartidor_id IS NOT NULL THEN
                -- Este UPDATE dispara triggers de gamificación. Si fallan, no deben romper el pedido.
                UPDATE repartidores SET estado = 'Ocupado' WHERE id = v_repartidor_id;
            END IF;
        END IF;

        -- Registrar en pedidos_general
        INSERT INTO pedidos_general (
            id, usuario_id, direccion, estado, total, metodo_pago, observaciones, 
            tipo_entrega, email_cliente, nombre_cliente, lat, lng, repartidor_id, 
            local_id, num_confirmacion, fecha, created_at, precio_envio, 
            cobro_repartidor_procesado, external_reference
        ) VALUES (
            v_pedido_id, p_user_id, p_direccion, p_estado, p_total, p_metodo_pago, p_observaciones, 
            p_tipo_entrega, p_email_cliente, p_nombre_cliente, p_lat, p_lng, v_repartidor_id, 
            v_local_id, v_num_confirmacion, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours', 
            p_precio_envio, (LOWER(p_metodo_pago) = 'efectivo'), p_external_reference
        );

        -- Procesar items y locales
        FOR v_local_id IN SELECT DISTINCT COALESCE(elem->>'local_id', 'unknown') FROM jsonb_array_elements(p_cart) AS elem
        LOOP
            v_ped_local_id := 'PL-' || v_pedido_id || '-' || v_local_id;

            -- Registrar cabecera local
            INSERT INTO pedidos_locales (id, pedido_id, local_id, estado, metodo_pago, total, created_at)
            SELECT 
                v_ped_local_id, 
                v_pedido_id, 
                v_local_id, 
                p_estado, 
                p_metodo_pago,
                SUM((el->>'precio')::NUMERIC * COALESCE((el->>'cantidad')::INT, (el->>'qty')::INT, 1)),
                NOW() - INTERVAL '3 hours'
            FROM jsonb_array_elements(p_cart) AS el
            WHERE COALESCE(el->>'local_id', 'unknown') = v_local_id;

            -- Registrar items individuales
            INSERT INTO pedidos_items (pedido_id, item_id, nombre, precio_unitario, cantidad, subtotal, local_id)
            SELECT 
                v_pedido_id, 
                el->>'id', 
                el->>'nombre', 
                (el->>'precio')::NUMERIC, 
                COALESCE((el->>'cantidad')::INT, (el->>'qty')::INT, 1),
                ((el->>'precio')::NUMERIC * COALESCE((el->>'cantidad')::INT, (el->>'qty')::INT, 1)),
                v_local_id
            FROM jsonb_array_elements(p_cart) AS el
            WHERE COALESCE(el->>'local_id', 'unknown') = v_local_id;
        END LOOP;

    EXCEPTION WHEN OTHERS THEN
        -- Si ocurre un error inesperado (ej. RLS, triggers laterales, etc.), lo relanzamos con detalle
        RAISE EXCEPTION 'Error crítico en creación de pedido completo: %', SQLERRM;
    END;

    RETURN jsonb_build_object(
        'pedido_id', v_pedido_id, 
        'repartidor_id', v_repartidor_id, 
        'num_confirmacion', v_num_confirmacion
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
