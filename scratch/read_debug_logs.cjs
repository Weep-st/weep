const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jskxfescamdjesdrcnkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkTrigger() {
  console.log('--- Checking for triggers on pedidos_general ---');
  // Hack: use a RPC that might return something or just try to see if I can query pg_trigger (public might have access)
  const { data, error } = await supabase.from('pg_trigger').select('tgname').limit(1);
  if (error) {
    console.log('Cannot query pg_trigger directly (standard for Supabase).');
  }

  console.log('\n--- Checking Debug Logs ---');
  const { data: logs } = await supabase.from('wallet_debug_logs').select('*').order('created_at', { ascending: false }).limit(20);
  console.log('Logs:', JSON.stringify(logs, null, 2));
}

checkTrigger();
