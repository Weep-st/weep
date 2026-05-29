import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jskxfescamdjesdrcnkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkGamification() {
  console.log('--- GAMIFICATION STATS ---');
  const { data: stats, error } = await supabase.from('driver_gamification_stats').select('*').limit(5);
  if (error) {
    console.error('Error fetching stats:', error.message);
  } else {
    console.log('Stats data:', stats);
  }

  console.log('--- PEDIDOS ENTREGADOS ---');
  const { data: orders, error: oError } = await supabase
    .from('pedidos_general')
    .select('id, repartidor_id, estado')
    .eq('estado', 'Entregado')
    .limit(5);
    
  if (oError) {
      console.error('Error fetching orders:', oError.message);
  } else {
      console.log('Delivered orders count sample:', orders.length);
      console.log('Orders sample:', orders);
  }
  
  console.log('--- POINTS LOG ---');
  const { data: log, error: lError } = await supabase.from('driver_points_log').select('*').limit(5);
  if (lError) {
      console.error('Error fetching log:', lError.message);
  } else {
      console.log('Log sample:', log);
  }
}

checkGamification();
