import { createClient } from '@supabase/supabase-client-helpers' // Hypothethical
import { supabase } from './src/services/supabase.js';

async function checkConfig() {
  const { data: configs, error } = await supabase.from('wallet_config_locales').select('*');
  console.log('Configs:', configs);
  if (error) console.error('Error:', error);
}

checkConfig();
