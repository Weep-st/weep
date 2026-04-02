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
    const { subscriptionIds, title, message, data } = await req.json()
    const onesignalAppId = Deno.env.get("ONESIGNAL_APP_ID")
    const onesignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY")

    if (!onesignalAppId || !onesignalApiKey) {
      throw new Error("ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY is not configured in Supabase Edge Functions")
    }

    if (!subscriptionIds || !Array.isArray(subscriptionIds) || subscriptionIds.length === 0) {
      throw new Error("Missing required parameters: subscriptionIds (Array)")
    }

    const payload = {
      app_id: onesignalAppId,
      include_subscription_ids: subscriptionIds,
      headings: { "es": title || "Weep" },
      contents: { "es": message || "Tienes una nueva actualización" },
      data: data || {},
    };

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${onesignalApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200 // Consistent with send-email pattern
    })
  }
})
