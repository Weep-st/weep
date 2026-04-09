import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jskxfescamdjesdrcnkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('repartidores')
    .select('id, nombre, estado, sesion_vence_en')
    .eq('estado', 'Activo');
  
  if (error) { console.error(error); return; }
  
  console.log("Active drivers found:", data.length);
  if (data.length > 0) {
    console.table(data);
  } else {
    // Check if there are ANY active drivers at all
     const { count } = await supabase.from('repartidores').select('*', { count: 'exact', head: true }).eq('estado', 'Activo');
     console.log("Total Count of 'Activo':", count);
  }
}

check();
