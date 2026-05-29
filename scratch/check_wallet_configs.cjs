const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkConfigs() {
  const { data, error } = await supabase
    .from('wallet_config_locales')
    .select('local_id, activo, porcentaje_ganancia, compra_minima_generar');
  
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log("Configuraciones encontradas:");
  console.table(data);
}

checkConfigs();
