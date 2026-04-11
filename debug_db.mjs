
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jskxfescamdjesdrcnkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const { data: pg, error: pgErr } = await supabase.from('pedidos_general').select('id').order('created_at', { ascending: false }).limit(1);
  if (pgErr) { console.error('PG Error:', pgErr); return; }
  if (!pg?.length) { console.log('No orders'); return; }
  
  const id = pg[0].id;
  const { data: items, error: itemErr } = await supabase.from('pedidos_items').select('*').eq('pedido_id', id);
  const { data: locales, error: locErr } = await supabase.from('pedidos_locales').select('*, locales(nombre)').eq('pedido_id', id);
  
  console.log(JSON.stringify({ 
    id, 
    itemErr,
    locErr,
    itemsCount: items?.length, 
    localesCount: locales?.length, 
    itemsSample: items?.[0], 
    localesSample: locales?.[0] 
  }, null, 2));
}
check();
