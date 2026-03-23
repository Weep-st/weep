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

async function notifyLocalsAndCustomer({ pedidoId, numConfirmacion, cart, orderInfo, supabase }: any) {
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
          `<tr><td>${i.cantidad || 1}</td><td>${i.nombre}</td><td>$${Number(i.precio).toLocaleString('es-AR')}</td><td>$${(Number(i.precio) * (i.cantidad || 1)).toLocaleString('es-AR')}</td></tr>`
        ).join('');

        const htmlBody = `
          <div style="font-family: Arial, sans-serif;">
            <h2>¡Nuevo Pedido para ${localData.nombre}!</h2>
            <p><strong>📦 Nro de Pedido:</strong> ${pedidoId}</p>
            <p><strong>💳 Método de Pago:</strong> ${metodoPago.toUpperCase()}</p>
            <p><strong>🚚 Entrega:</strong> ${tipoEntrega}</p>
            <p><strong>📍 Dirección:</strong> ${direccion || 'Retiro en Local'}</p>
            ${observaciones ? `<p><strong>📝 Observaciones:</strong> ${observaciones}</p>` : ''}
            <table border="1" style="width: 100%; border-collapse: collapse;">
              <thead><tr><th>Cant.</th><th>Item</th><th>Precio</th><th>Subtotal</th></tr></thead>
              <tbody>${itemsHtml}</tbody>
            </table>
            <h3>Total Local: $${group.subtotal.toLocaleString('es-AR')}</h3>
          </div>
        `;

        await supabase.functions.invoke('send-email', {
          body: { to: localData.email, subject: `¡Nuevo Pedido #${pedidoId} en Weep! 🛵`, htmlBody }
        });
      }
    });

    // 2. Notificar al Cliente
    if (emailCliente) {
      let itemsHtml = cart.map((i: any) =>
        `<tr><td>${i.cantidad || 1}</td><td>${i.nombre}</td><td>$${Number(i.precio).toLocaleString('es-AR')}</td><td>$${(Number(i.precio) * (i.cantidad || 1)).toLocaleString('es-AR')}</td></tr>`
      ).join('');

      const isEnvio = tipoEntrega && (tipoEntrega.toLowerCase().includes('env') || tipoEntrega.toLowerCase() === 'con envío');
      const pinMessageHTML = isEnvio 
        ? `<p><strong>Importante:</strong> Informarle este número al repartidor para confirmar la entrega.</p>`
        : `<p><strong>Importante:</strong> Brindar este número en el mostrador para retirar tu pedido.</p>`;

      const htmlBodyCliente = `
        <div style="font-family: Arial, sans-serif;">
          <h2>¡Hola ${nombreCliente || 'Cliente'}! Tu pedido está confirmado. 🍔</h2>
          <div style="background: #eef2f5; padding: 10px;">
            <h3>PIN DE CONFIRMACIÓN: ${numConfirmacion}</h3>
            ${pinMessageHTML}
          </div>
          <p><strong>📦 Nro de Pedido:</strong> ${pedidoId}</p>
          <p><strong>🚚 Entrega:</strong> ${tipoEntrega}</p>
          <table border="1"><thead><tr><th>Cant.</th><th>Item</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>${itemsHtml}</tbody></table>
        </div>
      `;

      await supabase.functions.invoke('send-email', {
        body: { to: emailCliente, subject: `Confirmación de Pedido #${pedidoId} - Weep 🛵`, htmlBody: htmlBodyCliente }
      });
    }

    await Promise.allSettled(promesasLocales);
  } catch (e) {
    console.error("Error enviando notificaciones:", e);
  }
}
