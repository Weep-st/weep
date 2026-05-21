import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.569.0";

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-file-name',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const r2Endpoint = Deno.env.get("R2_ENDPOINT");
    const r2AccessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const r2SecretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const r2BucketName = Deno.env.get("R2_BUCKET_NAME") || "wepi-images";
    const r2PublicUrl = Deno.env.get("R2_PUBLIC_URL");

    if (!r2Endpoint || !r2AccessKeyId || !r2SecretAccessKey || !r2PublicUrl) {
      throw new Error("Missing required Cloudflare R2 environment variables in Supabase.");
    }

    const contentType = req.headers.get("content-type") || "image/jpeg";
    // Generar un nombre único si no se pasa x-file-name
    const originalName = req.headers.get("x-file-name") || "image.jpg";
    const fileExt = originalName.split('.').pop() || 'jpg';
    const fileName = `img_${crypto.randomUUID()}.${fileExt}`;

    // Leer el archivo binario del cuerpo de la petición
    const fileBuffer = await req.arrayBuffer();

    // Inicializar cliente S3 compatible con R2
    const s3 = new S3Client({
      region: "auto",
      endpoint: r2Endpoint,
      credentials: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey,
      },
    });

    // Subir a Cloudflare R2
    const command = new PutObjectCommand({
      Bucket: r2BucketName,
      Key: fileName,
      Body: new Uint8Array(fileBuffer),
      ContentType: contentType,
    });

    await s3.send(command);

    // Generar URL pública final
    const cleanPublicUrl = r2PublicUrl.endsWith('/') ? r2PublicUrl.slice(0, -1) : r2PublicUrl;
    const finalUrl = `${cleanPublicUrl}/${fileName}`;

    return new Response(JSON.stringify({ success: true, url: finalUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200 // Usar status 200 como en los otros servicios para evitar romper clientes
    });
  }
})
