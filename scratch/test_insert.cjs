const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jskxfescamdjesdrcnkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testInsert() {
  console.log('--- Testing Manual Insert into wallet_transactions ---');
  const { data, error } = await supabase.from('wallet_transactions').insert({
    user_id: 'USR-DUM4L2AF',
    type: 'earn',
    amount: 10,
    description: 'Manual test insert'
  }).select();
  
  if (error) {
    console.error('Insert Failed:', error.message);
    if (error.details) console.log('Details:', error.details);
    if (error.hint) console.log('Hint:', error.hint);
  } else {
    console.log('Insert Success:', data);
  }
}

testInsert();
