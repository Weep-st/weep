import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jskxfescamdjesdrcnkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testQuery() {
  console.log("Testing complete local orders query...");
  const { data, error } = await supabase
    .from('pedidos_locales')
    .select(`
      id,
      pedido_id,
      local_id,
      total,
      estado,
      created_at,
      pedidos_general:pedidos_general(
        direccion,
        observaciones,
        metodo_pago,
        tipo_entrega,
        email_cliente,
        nombre_cliente,
        fecha,
        num_confirmacion,
        repartidor_id,
        repartidores:repartidores(
          nombre,
          telefono
        ),
        pedidos_items:pedidos_items(
          id,
          pedido_id,
          item_id,
          nombre,
          precio_unitario,
          cantidad,
          subtotal,
          local_id
        )
      )
    `)
    .eq('local_id', 'LOC-1767402467136')
    .limit(5);

  if (error) {
    console.error("❌ QUERY ERROR:", error);
  } else {
    console.log("✅ QUERY SUCCESS:", data);
  }
}

testQuery();
