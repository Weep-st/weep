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

    // 1. Verificar qué tipo de evento es
    // Normalmente viene: { "action": "payment.created", "data": { "id": "123456" } }
    // O { "type": "payment", "data": { "id": "123456" } }
    
    const id = payload?.data?.id || payload?.id
    const type = payload?.type || payload?.action

    if (!id) {
      return new Response(JSON.stringify({ message: "No id found in payload" }), { status: 200 })
    }

    // 2. Consultar el pago en Mercado Pago para verificar el estado real
    const localId = new URL(req.url).searchParams.get('local_id')
    if (!localId) {
      console.error('Falta local_id en el webhook URL')
      return new Response(JSON.stringify({ error: "Missing local_id" }), { status: 400 })
    }

    const { data: localData, error: localError } = await supabase
      .from('locales')
      .select('mp_access_token')
      .eq('id', localId)
      .single()

    if (localError || !localData?.mp_access_token) {
      console.error('Local no tiene MP configurado')
      return new Response(JSON.stringify({ error: "Local MP config not found" }), { status: 400 })
    }

    const accessToken = localData.mp_access_token
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    })

    if (!mpResponse.ok) {
      console.error('Error consultando pago en MP:', await mpResponse.text())
      return new Response(JSON.stringify({ error: "Error fetching payment from MP" }), { status: 200 })
    }

    const paymentData = await mpResponse.json()
    console.log('Payment Data MP:', paymentData)

    const status = paymentData.status // 'approved', 'pending', 'rejected', etc.
    const externalReference = paymentData.external_reference // Tu ID de pedido

    if (status === 'approved' && externalReference) {
      console.log(`Pago aprobado para pedido temporal: ${externalReference}`)

      // 3. Obtener datos del pedido temporal
      const { data: tempOrder, error: tempError } = await supabase
        .from('pedidos_temporales')
        .select('*')
        .eq('id', externalReference)
        .single();

      if (tempError || !tempOrder) {
        console.error('No se encontró el pedido temporal o ya fue procesado:', tempError);
        return new Response(JSON.stringify({ message: "Temporal order not found" }), { status: 200 })
      }

      console.log('Datos del pedido temporal encontrados. Creando pedido real...');
      const { cart_data, order_info, usuario_id } = tempOrder;

      // 4. Llamar al RPC para crear el pedido completo
      const { data: rpcResult, error: rpcError } = await supabase.rpc('create_pedido_completo', {
        p_user_id: usuario_id,
        p_direccion: order_info.direccion,
        p_metodo_pago: order_info.metodoPago,
        p_observaciones: order_info.observaciones || '',
        p_tipo_entrega: order_info.tipoEntrega,
        p_total: order_info.totalCalculado,
        p_estado: 'Pendiente',
        p_email_cliente: order_info.emailCliente || '',
        p_nombre_cliente: order_info.nombreCliente || '',
        p_cart: cart_data
      });

      if (rpcError) {
        console.error('Error al ejecutar create_pedido_completo:', rpcError);
        return new Response(JSON.stringify({ error: rpcError.message }), { status: 200 })
      }

      console.log(`Pedido real creado exitosamente. ID: ${rpcResult.pedido_id}`);

      // 5. Eliminar de pedidos_temporales
      await supabase.from('pedidos_temporales').delete().eq('id', externalReference);

      // 6. Enviar Notificaciones
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
        console.error('Error enviando notificaciones:', e);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (error) {
    console.error('Error en webhook-mp:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    // 3. Notificar al Repartidor si fue asignado automáticamente
    if (repartidorId) {
      const { data: repData } = await supabase.from('repartidores').select('email').eq('id', repartidorId).single();
      if (repData && repData.email) {
        
        let montoCobrar = "NADA (pagado con " + metodoPago + ")";
        if (metodoPago.toLowerCase() === "efectivo") {
          montoCobrar = "$" + Number(orderInfo.totalCalculado).toLocaleString('es-AR');
        }

        let montoPagarLocal = "NADA";
        if (metodoPago.toLowerCase() === "efectivo") {
          montoPagarLocal = "$" + cart.reduce((sum: any, i: any) => sum + (Number(i.precio) * (i.cantidad || 1)), 0).toLocaleString('es-AR');
        }

        const firstLocalId = cart[0]?.local_id || 'Local';
        let direccionRetiro = "Consultar en panel de locales";
        if (firstLocalId !== 'Local') {
          const { data: lData } = await supabase.from('locales').select('direccion').eq('id', firstLocalId).single();
          if (lData?.direccion) direccionRetiro = lData.direccion;
        }

        const htmlBodyRepartidor = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <div style="text-align:center; margin: 20px 0;">
              <img src="https://i.postimg.cc/5tKhqD4z/Chat-GPT-Image-Feb-23-2026-12-10-45-PM-(5).png" alt="Weep" width="120" style="border-radius:12px;">
            </div>
            <hr style="border:0; border-top:2px solid #d32f2f; margin:20px 0;">
            <h2 style="color: #9b1913; text-align: center;">¡Nuevo pedido asignado! 🛵</h2>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 5px 0;"><strong>📦 Nro de Pedido:</strong> ${pedidoId}</p>
            </div>
            
            <h3 style="color: #2e7d32; margin-top: 20px;">📍 RETIRO</h3>
            <p style="margin: 5px 0;"><strong>Dirección de retiro:</strong> ${direccionRetiro}</p>
            <p style="margin: 5px 0;"><strong>Total a pagar al local:</strong> ${montoPagarLocal}</p>
            
            <h3 style="color: #2e7d32; margin-top: 20px;">📍 ENTREGA</h3>
            <p style="margin: 5px 0;"><strong>Dirección de entrega:</strong> ${direccion || 'Retiro en Local'}</p>
            <p style="margin: 5px 0;"><strong>Observaciones:</strong> ${observaciones || 'Ninguna'}</p>
            <p style="margin: 5px 0;"><strong>Total a cobrar al cliente:</strong> ${montoCobrar}</p>
          </div>
        `;

        await supabase.functions.invoke('send-email', {
          body: { to: repData.email, subject: `🚚 PEDIDO ASIGNADO #${pedidoId} - Weep`, htmlBody: htmlBodyRepartidor }
        });
      }
    }

    await Promise.allSettled(promesasLocales);
  } catch (e) {
    console.error("Error enviando notificaciones:", e);
  }
}
