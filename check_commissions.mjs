import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jskxfescamdjesdrcnkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  console.log('--- Checking comisiones_niveles table ---');
  const { data: levels, error: e1 } = await supabase.from('comisiones_niveles').select('*').order('nivel');
  if (e1) console.error('Error levels:', e1.message);
  else console.table(levels);

  console.log('\n--- Testing RPC get_current_commission_info for a random local ---');
  // Need a local ID. I'll try to find one.
  const { data: locales } = await supabase.from('locales').select('id, nombre').limit(1);
  if (locales && locales.length > 0) {
    const localId = locales[0].id;
    console.log(`Testing for local: ${locales[0].nombre} (${localId})`);
    const { data: info, error: e2 } = await supabase.rpc('get_current_commission_info', { p_local_id: localId });
    if (e2) console.error('Error RPC:', e2.message);
    else console.log(JSON.stringify(info, null, 2));
  }
}

check();
