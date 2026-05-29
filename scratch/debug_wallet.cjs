const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jskxfescamdjesdrcnkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debug() {
  console.log('--- Checking Wallet Config ---');
  const { data: configs } = await supabase.from('wallet_config_locales').select('*');
  console.log('Configs:', JSON.stringify(configs, null, 2));

  console.log('\n--- Checking Recent Delivered Orders ---');
  const { data: orders } = await supabase
    .from('pedidos_general')
    .select('id, usuario_id, local_id, estado, total, credito_wallet, created_at')
    .eq('estado', 'Entregado')
    .order('created_at', { ascending: false })
    .limit(3);
  console.log('Recent Orders:', JSON.stringify(orders, null, 2));

  if (orders && orders.length > 0) {
    const orderId = orders[0].id;
    console.log(`\n--- Checking items for order ${orderId} ---`);
    const { data: items } = await supabase.from('pedidos_items').select('*').eq('pedido_id', orderId);
    console.log('Items:', JSON.stringify(items, null, 2));

    console.log(`\n--- Checking transactions for order ${orderId} ---`);
    const { data: txs_order } = await supabase.from('wallet_transactions').select('*').eq('order_id', orderId);
    console.log('Transactions for this order:', JSON.stringify(txs_order, null, 2));

    console.log(`\n--- Checking total balance for user ${orders[0].usuario_id} ---`);
    const { data: wallet } = await supabase.from('user_wallets').select('*').eq('user_id', orders[0].usuario_id).single();
    console.log('Wallet Balance:', JSON.stringify(wallet, null, 2));
  }
}

debug();
