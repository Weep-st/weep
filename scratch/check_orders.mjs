import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jskxfescamdjesdrcnkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkOrders() {
  const { data: gen, error: genError } = await supabase.from('pedidos_general').select('*').limit(1);
  if (genError) console.log('pedidos_general error:', genError.message);
  else console.log('pedidos_general columns:', Object.keys(gen[0] || {}));

  const { data: loc, error: locError } = await supabase.from('pedidos_locales').select('*').limit(1);
  if (locError) console.log('pedidos_locales error:', locError.message);
  else console.log('pedidos_locales columns:', Object.keys(loc[0] || {}));
}

checkOrders();
