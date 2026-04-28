const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jskxfescamdjesdrcnkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debug() {
  console.log('\n--- Checking ALL wallet transactions ---');
  const { data: txs } = await supabase.from('wallet_transactions').select('*').limit(10);
  console.log('Last 10 Txs:', JSON.stringify(txs, null, 2));

  console.log('\n--- Checking total users in user_wallets ---');
  const { count } = await supabase.from('user_wallets').select('*', { count: 'exact', head: true });
  console.log('Total user wallets:', count);
}

debug();
