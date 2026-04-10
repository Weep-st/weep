import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    console.log("📥 Payload recibido:", JSON.stringify(body, null, 2));

    const { subscriptionIds, title, message, data, url } = body;
    const onesignalAppId = Deno.env.get("ONESIGNAL_APP_ID");
    const onesignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

    if (!onesignalAppId || !onesignalApiKey) {
      console.error("❌ Error: ONESIGNAL_APP_ID o ONESIGNAL_REST_API_KEY no están configurados.");
      throw new Error("ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY is not configured in Supabase Edge Functions");
    }

    if (!subscriptionIds || !Array.isArray(subscriptionIds) || subscriptionIds.length === 0) {
      console.error("❌ Error: subscriptionIds no es un array válido o está vacío.");
      throw new Error("Missing required parameters: subscriptionIds (Array)");
    }

    const payload = {
      app_id: onesignalAppId,
      include_subscription_ids: subscriptionIds,
      headings: { 
        "es": title || "Weep",
        "en": title || "Weep" 
      },
      contents: { 
        "es": message || "Tienes una nueva actualización",
        "en": message || "You have a new update"
      },
      url: url || "https://weep.com.ar/repartidores",
      data: data || {},
    };

    console.log("🚀 Enviando a OneSignal:", JSON.stringify(payload, null, 2));

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${onesignalApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log("📡 Respuesta de OneSignal:", JSON.stringify(result, null, 2));

    if (!response.ok) {
      console.error("❌ Error de OneSignal API:", result);
      return new Response(JSON.stringify({ success: false, error: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: response.status
      });
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (error) {
    console.error("🔥 Error crítico en Edge Function:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200 // Consistent with sender pattern but useful to see logs
    })
  }
})

