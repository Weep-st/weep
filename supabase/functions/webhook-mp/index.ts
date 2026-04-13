import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceRole)

    // Mercado Pago envía notificaciones por POST
    const payload = await req.json()
    console.log('Webhook MP Payload:', payload)

    // 1. Verificar qué tipo de evento es y extraer ID
    // Puede venir como: { "data": { "id": "123" } }
    // O como: { "resource": ".../payments/123", "topic": "payment" }
    
    let id = payload?.data?.id || payload?.id
    
    if (!id && payload?.resource) {
      const parts = payload.resource.split('/')
      id = parts[parts.length - 1]
    }

    const type = payload?.type || payload?.action || payload?.topic || 'payment'
    const localId = new URL(req.url).searchParams.get('local_id')

    console.log(`[Webhook MP] Recibida notificación: tipo=${type}, id=${id}, local=${localId}`)

    if (!id || isNaN(Number(id))) {
      console.log('[Webhook MP] ID no válido o ausente en el payload')
      return new Response(JSON.stringify({ message: "No valid id found in payload" }), { status: 200 })
    }

    // 2. Obtener Tokens
    const { data: localData } = await supabase.from('locales').select('mp_access_token').eq('id', localId).single()
    const MP_GLOBAL = Deno.env.get('MP_ACCESS_TOKEN_GLOBAL')
    const masterToken = 'APP_USR-595288641172928-010710-d915bce4137b3ee26e0c6e04873f1ac1-695835795';
    
    // Intentaremos con el del local primero, luego el global, luego el master
    const tokenList = [localData?.mp_access_token, MP_GLOBAL, masterToken].filter(Boolean)
    
    let paymentId = id
    let paymentData = null
    let usedTokenIndex = -1

    // 2. Intentar recuperar el pago (probando todos los tokens)
    for (let i = 0; i < tokenList.length; i++) {
        try {
            const token = tokenList[i]
            
            // Si es merchant_order, primero lo traducimos a payment
            let targetId = id
            if (type.includes('merchant_order')) {
                const moReq = await fetch(`https://api.mercadopago.com/merchant_orders/${id}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                })
                if (moReq.ok) {
                    const moData = await moReq.json()
                    targetId = moData.payments?.[0]?.id || id
                    console.log(`[Webhook MP] Traducido MO ${id} a Pago ${targetId}`)
                }
            }

            const response = await fetch(`https://api.mercadopago.com/v1/payments/${targetId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            })

            if (response.ok) {
                paymentData = await response.json()
                usedTokenIndex = i
                console.log(`[Webhook MP] Pago ${targetId} recuperado con éxito (token ${i})`)
                break
            }
        } catch (e) {
            console.error(`[Webhook MP] Error con token ${i}:`, e)
        }
    }

    if (!paymentData) {
      console.error(`[Webhook MP] No se pudo recuperar información del pago ${id}`)
      return new Response(JSON.stringify({ error: "Unauthorized or not found" }), { status: 200 })
    }

    const status = paymentData.status
    const externalReference = paymentData.external_reference

    console.log(`[Webhook MP] Estado del pago: ${status}, Referencia: ${externalReference}`)

    if (status === 'approved' && externalReference) {
      // 3. Buscar Pedido Temporal
      const { data: tempOrder, error: tempError } = await supabase
        .from('pedidos_temporales')
        .select('*')
        .eq('id', externalReference)
        .single();

      if (tempError || !tempOrder) {
        console.error(`[Webhook MP] Pedido temporal ${externalReference} no encontrado.`, tempError);
        return new Response(JSON.stringify({ message: "Temp order not found" }), { status: 200 })
      }

      const { cart_data, order_info, usuario_id } = tempOrder;

      // 4. Crear pedido real
      console.log(`[Webhook MP] Llamando RPC create_pedido_completo para ${externalReference}...`)
      const { data: rpcResult, error: rpcError } = await supabase.rpc('create_pedido_completo', {
        p_user_id: usuario_id,
        p_direccion: order_info.direccion || 'Sin dirección',
        p_metodo_pago: order_info.metodoPago || 'transferencia',
        p_observaciones: order_info.observaciones || '',
        p_tipo_entrega: order_info.tipoEntrega || 'Para Entregar',
        p_total: parseFloat(order_info.totalCalculado || '0'),
        p_estado: 'Pendiente',
        p_email_cliente: order_info.emailCliente || '',
        p_nombre_cliente: order_info.nombreCliente || '',
        p_lat: parseFloat(order_info.lat || '0'),
        p_lng: parseFloat(order_info.lng || '0'),
        p_cart: cart_data,
        p_precio_envio: parseFloat(order_info.precioEnvio || '0'),
        p_id: externalReference,
        p_external_reference: externalReference
      });

      if (rpcError) {
        console.error(`[Webhook MP] ERROR EN RPC para ${externalReference}:`, rpcError);
        return new Response(JSON.stringify({ error: rpcError.message }), { status: 200 })
      }

      console.log(`[Webhook MP] Pedido creado con éxito. ID: ${rpcResult.pedido_id}`)

      // 5. Notificar y Limpiar
      try {
        await notifyLocalsAndCustomer({
          pedidoId: rpcResult.pedido_id,
          numConfirmacion: rpcResult.num_confirmacion,
          repartidorId: rpcResult.repartidor_id,
          cart: cart_data,
          orderInfo: order_info,
          supabase
        });
      } catch (e) {
        console.error(`[Webhook MP] Error en notificaciones:`, e)
      }

      await supabase.from('pedidos_temporales').delete().eq('id', externalReference);
      console.log(`[Webhook MP] Flujo completado para ${externalReference}`)

      return new Response(JSON.stringify({ success: true, pedido_id: rpcResult.pedido_id }), { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    return new Response(JSON.stringify({ status, ref: externalReference }), { 
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (error) {
    console.error('[Webhook MP] Error fatal:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { 'Access-Control-Allow-Origin': '*', "Content-Type": "application/json" },
      status: 200 
    })
  }
})

async function notifyLocalsAndCustomer({ pedidoId, numConfirmacion, repartidorId, cart, orderInfo, supabase }: any) {
  try {
    const { direccion, tipoEntrega, observaciones, metodoPago, emailCliente, nombreCliente } = orderInfo;

    // 1. Notificar a los locales
    const byLocal: any = {};
    for (const item of cart) {
      const lid = item.local_id || 'unknown';
      if (!byLocal[lid]) byLocal[lid] = { items: [], subtotal: 0 };
      byLocal[lid].items.push(item);
      byLocal[lid].subtotal += (Number(item.precio) * (item.cantidad || 1));
    }

    const promesasLocales = Object.entries(byLocal).map(async ([localId, group]: any) => {
      if (localId === 'unknown') return;
      
      const { data: localData } = await supabase.from('locales').select('email, nombre').eq('id', localId).single();
      if (localData && localData.email) {
        let itemsHtml = group.items.map((i: any) => 
          `<tr><td style="padding: 8px; border-bottom: 1px solid #ddd;">${i.cantidad || 1}</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${i.nombre}</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">$${Number(i.precio).toLocaleString('es-AR')}</td><td style="padding: 8px; border-bottom: 1px solid #ddd;">$${(Number(i.precio) * (i.cantidad || 1)).toLocaleString('es-AR')}</td></tr>`
        ).join('');

        const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #9b1913;">¡Nuevo Pedido para ${localData.nombre}!</h2>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 5px 0;"><strong>📦 Nro de Pedido:</strong> ${pedidoId}</p>
              <p style="margin: 5px 0;"><strong>💳 Método de Pago:</strong> ${metodoPago.toUpperCase()}</p>
              <p style="margin: 5px 0;"><strong>🚚 Entrega:</strong> ${tipoEntrega}</p>
              <p style="margin: 5px 0;"><strong>📍 Dirección:</strong> ${direccion || 'Retiro en Local'}</p>
              ${observaciones ? `<p style="margin: 5px 0;"><strong>📝 Observaciones:</strong> ${observaciones}</p>` : ''}
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead><tr style="background-color: #f1f1f1;"><th style="padding: 10px; text-align: left;">Cant.</th><th style="padding: 10px; text-align: left;">Item</th><th style="padding: 10px; text-align: left;">Precio</th><th style="padding: 10px; text-align: left;">Subtotal</th></tr></thead>
              <tbody>${itemsHtml}</tbody>
            </table>
            <h3 style="text-align: right; color: #2e7d32;">Total Local: $${group.subtotal.toLocaleString('es-AR')}</h3>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://weep.com.ar/locales" style="background-color: #9b1913; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                Ir a mis pedidos de locales 🖥️
              </a>
            </div>
          </div>
        `;

        await supabase.functions.invoke('send-email', {
          body: { to: localData.email, subject: `¡Nuevo Pedido #${pedidoId} en Weep! 🛵`, htmlBody }
        });
      }
    });

    // 2. Notificar al Cliente - ELIMINADO (Se envía cuando el local acepta)

    // 3. Notificar al Repartidor - ELIMINADO (Se envía cuando el local acepta)

    await Promise.allSettled(promesasLocales);
  } catch (e) {
    console.error("Error enviando notificaciones:", e);
  }
}
