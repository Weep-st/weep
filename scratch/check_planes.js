import { createClient } from '@supabase/supabase-client';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkPlanes() {
  const { data: config } = await supabase.from('planes_config').select('*');
  const { data: niveles } = await supabase.from('planes_niveles').select('*');
  console.log('--- planes_config ---');
  console.log(JSON.stringify(config, null, 2));
  console.log('--- planes_niveles ---');
  console.log(JSON.stringify(niveles, null, 2));
}

checkPlanes();
