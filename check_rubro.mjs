import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jskxfescamdjesdrcnkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  try {
    console.log('Checking locales table structure...');
    // We try to select the rubro column
    const { data, error } = await supabase
      .from('locales')
      .select('rubro')
      .limit(1);

    if (error) {
      console.error('❌ Error selecting rubro:', error.message);
      if (error.message.includes('column "rubro" does not exist')) {
        console.log('👉 ACTION REQUIRED: You must run the SQL migration script in your Supabase SQL Editor.');
      }
    } else {
      console.log('✅ Column "rubro" found in locales table.');
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }
  process.exit(0);
}

check();
