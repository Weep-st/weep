
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jskxfescamdjesdrcnkf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSync() {
  // Tomamos los pedidos del 1 al 5 de abril
  const { data: general } = await supabase
    .from('pedidos_general')
    .select('id, cierre_caja')
    .gte('created_at', '2026-04-01T00:00:00Z')
    .lte('created_at', '2026-04-05T23:59:59Z');

  const ids = general.map(g => g.id);
  
  const { data: locales } = await supabase
    .from('pedidos_locales')
    .select('pedido_id, cierre_caja')
    .in('pedido_id', ids);

  console.log('Comparativa Cierre de Caja (General vs Locales):');
  general.forEach(g => {
    const l = locales.filter(loc => loc.pedido_id === g.id);
    const allLocalesClosed = l.length > 0 && l.every(loc => loc.cierre_caja === true);
    console.log(`Pedido ${g.id.slice(0,8)}: General=${g.cierre_caja} | Locales Cerrados=${allLocalesClosed} (${l.length} locales)`);
  });
}

checkSync();
