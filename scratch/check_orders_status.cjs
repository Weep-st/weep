
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jskxfescamdjesdrcnkf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrders() {
  const { data, error } = await supabase
    .from('pedidos_general')
    .select('id, estado, cierre_caja, cobro_repartidor_procesado, created_at')
    .gte('created_at', '2026-04-01T00:00:00Z')
    .lte('created_at', '2026-04-05T23:59:59Z')
    .limit(50);

  if (error) {
    console.error(error);
    return;
  }

  console.log('Orders found in range:', data.length);
  const eligible = data.filter(o => o.estado === 'Entregado' && o.cierre_caja && o.cobro_repartidor_procesado);
  console.log('Eligible for deletion (Entregado + Cierre + Procesado):', eligible.length);
  
  data.forEach(o => {
    console.log(`ID: ${o.id.slice(0,8)}, Est: ${o.estado}, C: ${o.cierre_caja}, P: ${o.cobro_repartidor_procesado}, Fecha: ${o.created_at}`);
  });
}

checkOrders();
