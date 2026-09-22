import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jskxfescamdjesdrcnkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
    const nombre = 'Test Real';
    const whatsapp = '3755 123456';
    const email = 'real@example.com';
    const ciudad = 'Alem (Misiones)';

    const baseEmail = (email && email.trim()) ? email.trim() : (whatsapp ? \`\${whatsapp.replace(/\\D/g, '')}@lead.wepi.app\` : \`lead_\${Date.now()}@wepi.app\`);
    const userEmail = baseEmail.includes('@') ? baseEmail.replace('@', \`+lead_\${Date.now()}@\`) : \`\${baseEmail}_lead_\${Date.now()}\`;
    const userId = 'USR-' + Math.random().toString(36).substring(2, 10).toUpperCase();

    const { error: userError } = await supabase.from('usuarios').insert({
      id: userId,
      nombre: nombre ? nombre.trim() : 'Usuario Interesado',
      telefono: whatsapp ? whatsapp.trim() : null,
      email: userEmail,
      ciudad: ciudad,
      email_confirmado: true,
      terms_accepted: true,
      privacy_accepted: true,
      terms_accepted_at: new Date().toISOString(),
      terms_version: 'v1'
    });

    console.log("User Error:", userError);
}

test();
