
import { supabase } from '../src/services/api.js';

async function testJoin() {
  const { data, error } = await supabase
    .from('pedidos_general')
    .select('*, repartidores(nombre)')
    .limit(5);
  
  if (error) {
    console.error('Join Error:', error);
  } else {
    console.log('Join Success:', data);
  }
}

testJoin();
