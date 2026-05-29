import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jskxfescamdjesdrcnkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testBatch() {
  const localId = 'LOC-1767402467136';
  console.log("🚀 Starting Batched Query for local:", localId);

  // 1. Fetch orders from pedidos_locales (Limit 50 for performance!)
  const { data: localOrders, error: localErr } = await supabase
    .from('pedidos_locales')
    .select('id, pedido_id, local_id, total, estado')
    .eq('local_id', localId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (localErr) {
    console.error("Error fetching pedidos_locales:", localErr);
    return;
  }

  console.log(`Fetched ${localOrders.length} local orders.`);
  if (localOrders.length === 0) return;

  const uniquePedidoIds = [...new Set(localOrders.map(o => o.pedido_id))].filter(Boolean);
  console.log("Unique Pedido IDs:", uniquePedidoIds);

  // 2. Fetch all matching general orders in ONE query
  const { data: generalOrders, error: generalErr } = await supabase
    .from('pedidos_general')
    .select('*, repartidores:repartidor_id(nombre, telefono)')
    .in('id', uniquePedidoIds);

  if (generalErr) {
    console.error("Error fetching pedidos_general:", generalErr);
    return;
  }

  // 3. Fetch all matching items in ONE query
  const { data: allItems, error: itemsErr } = await supabase
    .from('pedidos_items')
    .select('*')
    .in('pedido_id', uniquePedidoIds)
    .eq('local_id', localId);

  if (itemsErr) {
    console.error("Error fetching pedidos_items:", itemsErr);
    return;
  }

  console.log(`Fetched ${generalOrders.length} general orders and ${allItems.length} items.`);

  // Map into the expected array structure
  const generalMap = {};
  generalOrders.forEach(g => {
    generalMap[g.id] = g;
  });

  const itemsMap = {};
  allItems.forEach(i => {
    if (!itemsMap[i.pedido_id]) itemsMap[i.pedido_id] = [];
    itemsMap[i.pedido_id].push([
      i.id,
      i.pedido_id,
      i.item_id,
      '',
      i.nombre,
      i.precio_unitario,
      i.cantidad,
      i.subtotal
    ]);
  });

  const processed = localOrders.map(p => {
    const gen = generalMap[p.pedido_id] || {};
    const items = itemsMap[p.pedido_id] || [];
    const rep = gen.repartidores || {};

    return {
      idPedidoLocal: p.id,
      idPedido: p.pedido_id,
      estadoActual: p.estado || 'Pendiente',
      items: items,
      direccion: gen.direccion || 'Retiro en local',
      observaciones: gen.observaciones || 'Ninguna',
      metodoPago: gen.metodo_pago || 'No especificado',
      tipoEntrega: gen.tipo_entrega || 'Para Retirar',
      emailCliente: gen.email_cliente || '',
      nombreCliente: gen.nombre_cliente || 'Cliente',
      fecha: gen.fecha,
      numConfirmacion: gen.num_confirmacion,
      repartidorId: gen.repartidor_id,
      repartidorNombre: rep.nombre || null,
      repartidorTelefono: rep.telefono || null,
      localId: p.local_id,
      totalLocal: Number(p.total) || items.reduce((acc, item) => acc + (Number(item[7]) || 0), 0),
    };
  });

  console.log("✅ SUCCESS! Mapped processed order sample:", processed[0]);
}

testBatch();
