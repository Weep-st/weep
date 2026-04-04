const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jskxfescamdjesdrcnkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  const driverId = 'REP-47FFF254';
  const now = new Date();
  const validUntil = new Date(now.getTime() + 30 * 60000);
  
  const updates = { 
    estado: 'Activo',
    ultima_actividad: now.toISOString(),
    sesion_vence_en: validUntil.toISOString()
  };

  const { data, error } = await supabase.from('repartidores').update(updates).eq('id', driverId);
  console.log('Result:', { data, error });
}

test();
