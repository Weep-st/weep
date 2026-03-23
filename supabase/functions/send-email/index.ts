Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, htmlBody } = await req.json()
    const resendApiKey = Deno.env.get("RESEND_API_KEY")

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured in Supabase Edge Functions")
    }

    if (!to || !subject || !htmlBody) {
      throw new Error("Missing required parameters: to, subject, or htmlBody")
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "WEEP <onboarding@resend.dev>", // Cambiar por tu correo verificado
        to: [to],
        subject: subject,
        html: htmlBody
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || "Error sending email via Resend")
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    })
  }
})
