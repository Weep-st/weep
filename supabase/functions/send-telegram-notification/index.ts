import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { pedidoId } = await req.json();
    console.log(`[Telegram] Procesando pedido: ${pedidoId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const chatId = Deno.env.get('TELEGRAM_CHAT_ID');

    if (!botToken || !chatId) {
      throw new Error("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRole);

    // 1. Obtener datos del pedido, local y repartidor
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos_general')
      .select(`
        *,
        locales (nombre, direccion),
        repartidores (nombre, telefono),
        usuarios (nombre, telefono)
      `)
      .eq('id', pedidoId)
      .single();

    if (pedidoError || !pedido) {
      throw new Error(`Error al obtener pedido: ${pedidoError?.message}`);
    }

    // 2. Obtener items del pedido
    const { data: items, error: itemsError } = await supabase
      .from('pedidos_items')
      .select('*')
      .eq('pedido_id', pedidoId);

    if (itemsError) {
      console.error("Error al obtener items:", itemsError);
    }

    // 3. Formatear Fecha Argentina (UTC-3)
    const fecha = new Date(pedido.created_at);
    const options: Intl.DateTimeFormatOptions = { 
      timeZone: 'America/Argentina/Buenos_Aires',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };
    const fechaAR = new Intl.DateTimeFormat('es-AR', options).format(fecha);

    // 4. Construir Mensaje
    let message = `📦 *NUEVO PEDIDO RECIBIDO*\n`;
    message += `------------------------------------\n`;
    message += `🆔 *ID:* \`${pedido.id}\`\n`;
    message += `🏪 *Local:* ${pedido.locales?.nombre || 'N/A'}\n`;
    message += `🕒 *Horario (AR):* ${fechaAR}\n`;
    message += `💰 *Valor:* $${Number(pedido.total).toLocaleString('es-AR')}\n`;
    message += `💳 *Método:* ${pedido.metodo_pago}\n`;
    message += `🚚 *Tipo:* ${pedido.tipo_entrega}\n`;
    message += `📍 *Dirección:* ${pedido.direccion || 'Retiro'}\n`;
    message += `------------------------------------\n`;
    message += `👤 *Cliente:* ${pedido.nombre_cliente || pedido.usuarios?.nombre || 'N/A'}\n`;
    message += `📞 *Tel. Cliente:* ${pedido.usuarios?.telefono || 'N/A'}\n`;
    message += `🛵 *Repartidor:* ${pedido.repartidores?.nombre || (pedido.tipo_entrega === 'Retiro' ? 'N/A' : 'Pendiente')}\n`;
    
    if (items && items.length > 0) {
      message += `------------------------------------\n`;
      message += `🛒 *PRODUCTOS:*\n`;
      items.forEach(item => {
        message += `• ${item.cantidad}x ${item.nombre} ($${Number(item.precio_unitario).toLocaleString('es-AR')})\n`;
      });
    }

    if (pedido.observaciones) {
      message += `------------------------------------\n`;
      message += `📝 *Notas:* ${pedido.observaciones}\n`;
    }

    // 5. Enviar a Telegram
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    const result = await response.json();
    console.log(`[Telegram] Respuesta API:`, result);

    if (!response.ok) {
      return new Response(JSON.stringify({ success: false, error: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[Telegram] Error:`, (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});
