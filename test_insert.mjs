import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jskxfescamdjesdrcnkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
    const nombre = 'Test';
    const whatsapp = '123456';
    const email = '';
    const ciudad = 'Colon (Entre Ríos)';

    const cleanPhone = whatsapp ? whatsapp.replace(/\D/g, '') : '';
    const userEmail = (email && email.trim()) ? email.trim() : (cleanPhone ? `${cleanPhone}@lead.wepi.app` : `lead_${Date.now()}@wepi.app`);
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

    if (userError) {
        console.log("Error inserting user:", userError);
    } else {
        console.log("Success inserting user. ID:", userId);
    }
}

test();
