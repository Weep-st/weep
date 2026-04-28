const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jskxfescamdjesdrcnkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fix() {
  console.log('--- Updating Config to be more permissive for testing ---');
  await supabase.from('wallet_config_locales').update({
    solo_primera_compra: false,
    compra_minima_generar: 0,
    porcentaje_ganancia: 50 // To make it obvious
  }).eq('local_id', 'LOC-1767402467136');

  console.log('--- Manually Resetting an Order Status to Pending then Entregado ---');
  const orderId = 'ORD-QBLST7YBC4';
  
  // Set to something else first
  await supabase.from('pedidos_general').update({ estado: 'Confirmado' }).eq('id', orderId);
  console.log(`Order ${orderId} set to Confirmado`);
  
  // Wait a bit
  await new Promise(r => setTimeout(r, 1000));

  // Set to Entregado
  const { error } = await supabase.from('pedidos_general').update({ estado: 'Entregado' }).eq('id', orderId);
  if (error) console.error('Error updating to Entregado:', error);
  else console.log(`Order ${orderId} set to Entregado successfully!`);

  // Wait for trigger
  await new Promise(r => setTimeout(r, 2000));

  // Check transactions
  const { data: txs } = await supabase.from('wallet_transactions').select('*').eq('order_id', orderId);
  console.log('Transactions now:', JSON.stringify(txs, null, 2));
}

fix();
