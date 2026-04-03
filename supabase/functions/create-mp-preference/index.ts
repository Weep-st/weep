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
    const { items, external_reference, back_urls, local_id, marketplace_fee } = await req.json()

    if (!items || !external_reference || !local_id) {
      throw new Error("Missing required parameters: items, external_reference, or local_id")
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceRole)

    const { data: localData, error: localError } = await supabase
      .from('locales')
      .select('mp_access_token')
      .eq('id', local_id)
      .single()

    // Si el local tiene configurado su propio token, se cobra a su cuenta.
    // De lo contrario, usamos el token global (central) como se hacía en idea.html
    const masterToken = 'APP_USR-595288641172928-010710-d915bce4137b3ee26e0c6e04873f1ac1-695835795';
    const accessToken = localData?.mp_access_token || Deno.env.get('MP_ACCESS_TOKEN_GLOBAL') || masterToken;

    // Sanitizamos las back_urls por si el frontend envía 'http://localhost' o 'file://' que MP rechaza para auto_return
    const isValidUrl = (url: any) => typeof url === 'string' && (url.startsWith('https') || url.startsWith('http://localhost'));
    const safeBackUrls = (back_urls && isValidUrl(back_urls.success)) ? back_urls : {
      success: "https://weep.com.ar/pedir",
      failure: "https://weep.com.ar/pedir",
      pending: "https://weep.com.ar/pedir"
    };

    // Configuración de la preferencia base
    const body: any = {
      items,
      external_reference,
      back_urls: safeBackUrls,
      // Mercado Pago exige HTTPS para auto_return. Si es localhost (HTTP), lo omitimos para que no falle.
      auto_return: safeBackUrls.success.startsWith('https') ? "approved" : undefined,
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-mp?local_id=${local_id}`
    }

    // Calcula el total del pedido
    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.unit_price * item.quantity), 0);
    // Usamos el marketplace_fee indicado por el frontend (Comisión + Envío + Comisiones MP)
    // O fallback al 5% por compatibilidad con versiones anteriores si no se envía.
    const weepFee = marketplace_fee !== undefined ? Number(marketplace_fee) : Number((totalAmount * 0.05).toFixed(2));

    // Si se usó el token del local y está configurado, le aplicamos la comisión del Marketplace
    if (localData?.mp_access_token && accessToken === localData.mp_access_token) {
      body.marketplace_fee = weepFee;
    }

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || "Error creating Mercado Pago preference")
    }

    return new Response(JSON.stringify({ init_point: data.init_point, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    })
  }
})
