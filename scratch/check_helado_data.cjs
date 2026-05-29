const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jskxfescamdjesdrcnkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkData() {
  console.log('--- Buscando SALSAS y sus LOCAL_ID ---');
  const { data, error } = await supabase
    .from('helado_sabores')
    .select('nombre, tipo, local_id')
    .ilike('tipo', 'salsa');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.table(data);
  
  const { data: locales } = await supabase.from('locales').select('id, nombre');
  const localeMap = Object.fromEntries(locales.map(l => [l.id, l.nombre]));
  
  console.log('--- Mapeo de Locales ---');
  data.forEach(d => {
    console.log(`Salsa: ${d.nombre} -> Local: ${localeMap[d.local_id] || d.local_id}`);
  });
}

checkData();
