/* ═══════════════════════════════════════════════════
   WEEP API — Supabase Backend
   ═══════════════════════════════════════════════════ */
import { supabase } from './supabase';

// Cloudinary config
const CLOUD_NAME = 'drjchiokc';
const UPLOAD_PRESET = 'ml_default';

// ─── Image Upload ───
export async function uploadImage(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: fd });
  const data = await res.json();
  if (!data.secure_url) throw new Error('Error al subir imagen');
  return data.secure_url;
}

// ═══════════════════════════════════════════════════
// AUTH — Usuarios
// ═══════════════════════════════════════════════════
export async function loginUsuario(email, password) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .eq('password', password)
    .single();
  if (error || !data) return { success: false };
  return { success: true, userId: data.id, nombre: data.nombre, direccion: data.direccion, telefono: data.telefono, email: data.email };
}

export async function registerUsuario(nombre, email, password, direccion) {
  const id = 'USR-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const { error } = await supabase.from('usuarios').insert({ id, nombre, email, password, direccion });
  if (error) throw new Error(error.message);
  return { success: true, userId: id };
}

export async function updateDireccion(userId, nuevaDireccion) {
  const { error } = await supabase.from('usuarios').update({ direccion: nuevaDireccion }).eq('id', userId);
  if (error) throw new Error(error.message);
  return { success: true };
}

// ═══════════════════════════════════════════════════
// AUTH — Locales (Restaurants)
// ═══════════════════════════════════════════════════
export async function loginLocal(email, password) {
  const { data, error } = await supabase
    .from('locales')
    .select('*')
    .eq('email', email)
    .eq('password', password)
    .single();
  if (error || !data) return { success: false };
  return { success: true, localId: data.id };
}

export async function registerLocal(nombre, direccion, email, password) {
  const id = 'LOC-' + Date.now();
  const { error } = await supabase.from('locales').insert({ id, nombre, direccion, email, password });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function getLocalEstado(localId) {
  const { data } = await supabase.from('locales').select('estado').eq('id', localId).single();
  return data || { estado: 'Inactivo' };
}

export async function updateLocalEstado(localId, estado) {
  const { error } = await supabase.from('locales').update({ estado }).eq('id', localId);
  if (error) return { success: false };
  return { success: true };
}

export async function getPerfilLocal(localId) {
  const { data, error } = await supabase.from('locales').select('*').eq('id', localId).single();
  if (error) return { success: false };
  return { success: true, ...data };
}

export async function updatePerfilLocal(params) {
  const { localId, ...updates } = params;
  if (updates.foto_url === '') delete updates.foto_url;
  const { error } = await supabase.from('locales').update(updates).eq('id', localId);
  if (error) throw new Error(error.message);
  return { success: true };
}

// ═══════════════════════════════════════════════════
// AUTH — Repartidores (Drivers)
// ═══════════════════════════════════════════════════
export async function repartidorLogin(email, password) {
  const { data, error } = await supabase
    .from('repartidores')
    .select('*')
    .eq('email', email)
    .eq('password', password)
    .single();
  if (error || !data) return { success: false, error: 'Credenciales incorrectas' };
  return {
    success: true,
    data: {
      ID: data.id, Nombre: data.nombre, Email: data.email,
      Telefono: data.telefono, Patente: data.patente,
      MarcaModelo: data.marca_modelo, Estado: data.estado,
      PedidosHoy: data.pedidos_hoy,
    },
  };
}

export async function repartidorRegister(params) {
  const id = 'REP-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const { error } = await supabase.from('repartidores').insert({
    id, nombre: params.nombre, telefono: params.telefono,
    email: params.email, password: params.password,
    patente: params.patente, marca_modelo: params.marcaModelo,
    fecha_registro: new Date().toISOString(),
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function repartidorGetDatos(driverId) {
  const { data, error } = await supabase.from('repartidores').select('*').eq('id', driverId).single();
  if (error) return { success: false };
  return {
    success: true,
    data: {
      ID: data.id, Nombre: data.nombre, Email: data.email,
      Telefono: data.telefono, Patente: data.patente,
      MarcaModelo: data.marca_modelo, Estado: data.estado,
      PedidosHoy: data.pedidos_hoy,
    },
  };
}

export async function repartidorActualizarEstado(driverId, estado) {
  const updates = { estado };
  if (estado === 'Activo') updates.activo_desde = new Date().toISOString();
  else updates.inactivo_desde = new Date().toISOString();
  updates.ultima_conexion = new Date().toISOString();
  const { error } = await supabase.from('repartidores').update(updates).eq('id', driverId);
  if (error) return { success: false };
  return { success: true };
}

// ═══════════════════════════════════════════════════
// LOCALES — Get all
// ═══════════════════════════════════════════════════
export async function getLocales() {
  const { data } = await supabase.from('locales').select('id, nombre, foto_url, estado, direccion, horario_apertura, horario_cierre');
  return (data || []).map(l => ({
    id: l.id, nombre: l.nombre, logo: l.foto_url || '',
    estado: l.estado, direccion: l.direccion,
  }));
}

// ═══════════════════════════════════════════════════
// MENU
// ═══════════════════════════════════════════════════
export async function getMenuCompleto() {
  const { data } = await supabase
    .from('menu')
    .select('*, locales(nombre, foto_url)')
    .eq('disponibilidad', true)
    .order('nombre');
  return (data || []).map(i => ({
    id: i.id, nombre: i.nombre, categoria: i.categoria,
    descripcion: i.descripcion, precio: i.precio,
    disponibilidad: i.disponibilidad, imagen_url: i.imagen_url,
    local_id: i.local_id,
    local_nombre: i.locales?.nombre || '', local_logo: i.locales?.foto_url || '',
  }));
}

export async function getMenuByCategoria(categoria) {
  const { data } = await supabase
    .from('menu')
    .select('*, locales(nombre, foto_url)')
    .eq('categoria', categoria)
    .eq('disponibilidad', true)
    .order('nombre');
  return (data || []).map(i => ({
    id: i.id, nombre: i.nombre, categoria: i.categoria,
    descripcion: i.descripcion, precio: i.precio,
    imagen_url: i.imagen_url, local_id: i.local_id,
    local_nombre: i.locales?.nombre || '', local_logo: i.locales?.foto_url || '',
  }));
}

export async function getMenuByLocalId(localId) {
  const { data } = await supabase.from('menu').select('*').eq('local_id', localId).order('nombre');
  return data || [];
}

export async function addMenuItem(params) {
  const id = `MENU-${params.localId}-${Date.now()}`;
  const { error } = await supabase.from('menu').insert({
    id, local_id: params.localId, nombre: params.nombre,
    categoria: params.categoria, descripcion: params.descripcion,
    precio: parseFloat(params.precio), disponibilidad: params.disponibilidad !== false && params.disponibilidad !== 'No',
    tamano: params.tamano_porcion || params.tamano || '', variantes: params.variantes,
    tiempo_preparacion: String(parseInt(params.tiempo_preparacion) || 30),
    imagen_url: params.imagen_url || '',
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function updateMenuItem(params) {
  const updates = {};
  if (params.nombre) updates.nombre = params.nombre;
  if (params.categoria) updates.categoria = params.categoria;
  if (params.descripcion !== undefined) updates.descripcion = params.descripcion;
  if (params.precio) updates.precio = parseFloat(params.precio);
  if (params.disponibilidad !== undefined) updates.disponibilidad = params.disponibilidad !== false && params.disponibilidad !== 'No';
  if (params.tamano_porcion !== undefined || params.tamano !== undefined) updates.tamano = params.tamano_porcion || params.tamano;
  if (params.variantes !== undefined) updates.variantes = params.variantes;
  if (params.tiempo_preparacion) updates.tiempo_preparacion = String(parseInt(params.tiempo_preparacion));
  if (params.imagen_url) updates.imagen_url = params.imagen_url;
  const { error } = await supabase.from('menu').update(updates).eq('id', params.itemId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function deleteMenuItem(itemId) {
  const { error } = await supabase.from('menu').delete().eq('id', itemId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function updateDisponibilidad(itemId, disponibilidad) {
  const { error } = await supabase.from('menu').update({ disponibilidad }).eq('id', itemId);
  if (error) throw new Error(error.message);
  return { success: true };
}

// ═══════════════════════════════════════════════════
// FAVORITOS
// ═══════════════════════════════════════════════════
export async function getFavoritos(userId) {
  const { data } = await supabase.from('favoritos').select('item_id').eq('usuario_id', userId);
  return (data || []).map(f => f.item_id);
}

export async function toggleFavorito(userId, menuItemId) {
  const { data: existing } = await supabase
    .from('favoritos')
    .select('id')
    .eq('usuario_id', userId)
    .eq('item_id', menuItemId)
    .maybeSingle();
  if (existing) {
    await supabase.from('favoritos').delete().eq('id', existing.id);
    return { added: false };
  } else {
    await supabase.from('favoritos').insert({ usuario_id: userId, item_id: menuItemId });
    return { added: true };
  }
}

// ═══════════════════════════════════════════════════
// PEDIDOS
// ═══════════════════════════════════════════════════
export async function crearPedido({ userId, direccion, metodoPago, observaciones, tipoEntrega, items, emailCliente, nombreCliente, estadoInicial, totalCalculado }) {
  const total = totalCalculado !== undefined ? totalCalculado : items.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
  const estado = estadoInicial || 'Pendiente';

  const { data, error } = await supabase.rpc('create_pedido_completo', {
    p_user_id: userId,
    p_direccion: direccion,
    p_metodo_pago: metodoPago,
    p_observaciones: observaciones || '',
    p_tipo_entrega: tipoEntrega,
    p_total: total,
    p_estado: estado,
    p_email_cliente: emailCliente || '',
    p_nombre_cliente: nombreCliente || '',
    p_cart: items
  });

  if (error) {
    console.error("🚨 RPC ERROR DETALLADO:", error);
    throw new Error(error.message + " | Detalles: " + (error.details || ''));
  }

  // Actualizar el "total" (subtotal del local) en pedidos_locales
  try {
    const localTotals = {};
    for (const i of items) {
      const lid = i.local_id || 'unknown';
      if (!localTotals[lid]) localTotals[lid] = 0;
      localTotals[lid] += Number(i.precio) * Number(i.cantidad || i.qty || 1);
    }
    for (const [lid, totalLocal] of Object.entries(localTotals)) {
      await supabase.from('pedidos_locales')
        .update({ total: totalLocal })
        .eq('pedido_id', data.pedido_id)
        .eq('local_id', lid);
    }
  } catch (err) {
    console.error("Error actualizando totales en pedidos_locales:", err);
  }

  return { success: true, pedidoId: data.pedido_id, repartidorId: data.repartidor_id, numConfirmacion: data.num_confirmacion };
}

export async function getPedidosLocalesByLocal(localId) {
  const { data } = await supabase
    .from('pedidos_locales')
    .select('id, pedido_id, local_id, total, estado')
    .eq('local_id', localId)
    .order('created_at', { ascending: false });
  return (data || []).map(p => [p.id, p.pedido_id, p.local_id, p.total, p.estado]);
}

export async function getItemsByPedidoLocal(pedidoId, localId) {
  const { data } = await supabase.from('pedidos_items')
    .select('*')
    .eq('pedido_id', pedidoId)
    .eq('local_id', localId);
  return (data || []).map(i => [i.id, i.pedido_id, i.item_id, '', i.nombre, i.precio_unitario, i.cantidad, i.subtotal]);
}

export async function getPedidoGeneral(pedidoId) {
  const { data } = await supabase.from('pedidos_general').select('*').eq('id', pedidoId).single();
  if (!data) return {};
  return {
    direccion: data.direccion, observaciones: data.observaciones,
    metodoPago: data.metodo_pago, tipoEntrega: data.tipo_entrega,
    emailCliente: data.email_cliente, nombreCliente: data.nombre_cliente,
    fecha: data.created_at, numConfirmacion: data.num_confirmacion,
    repartidorId: data.repartidor_id,
  };
}

export async function updateEstadoLocalOrder(pedidoLocalId, estado) {
  const { error } = await supabase.from('pedidos_locales').update({ estado }).eq('id', pedidoLocalId);
  if (error) throw new Error(error.message);
  return { success: true };
}

// ═══════════════════════════════════════════════════
// LANZAMIENTO
// ═══════════════════════════════════════════════════
export async function registrarEmailLanzamiento(email) {
  const now = new Date();
  const { error } = await supabase.from('lanzamiento').insert({
    email, dia: now.toLocaleDateString('es-AR'), hora: now.toLocaleTimeString('es-AR'),
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

// ═══════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════
export async function buscarMenu(query) {
  const { data } = await supabase
    .from('menu')
    .select('*, locales(nombre, foto_url)')
    .eq('disponibilidad', true)
    .or(`nombre.ilike.%${query}%,descripcion.ilike.%${query}%,categoria.ilike.%${query}%`)
    .order('nombre')
    .limit(50);
  return (data || []).map(i => ({
    id: i.id, nombre: i.nombre, categoria: i.categoria,
    descripcion: i.descripcion, precio: i.precio,
    imagen_url: i.imagen_url, local_id: i.local_id,
    local_nombre: i.locales?.nombre || '', local_logo: i.locales?.foto_url || '',
  }));
}

// ═══════════════════════════════════════════════════
// MIS PEDIDOS
// ═══════════════════════════════════════════════════
export async function getMisPedidos(userId) {
  const { data: pedidos } = await supabase
    .from('pedidos_general')
    .select('*')
    .eq('usuario_id', userId)
    .order('created_at', { ascending: false });
  if (!pedidos || pedidos.length === 0) return { enCurso: [], historial: [] };

  const enCurso = [];
  const historial = [];

  for (const p of pedidos) {
    const { data: locales } = await supabase
      .from('pedidos_locales')
      .select('*, locales(nombre)')
      .eq('pedido_id', p.id);

    const localIds = (locales || []).map(l => l.id);
    let items = [];
    const { data: allItems } = await supabase
      .from('pedidos_items')
      .select('*')
      .eq('pedido_id', p.id);
    items = allItems || [];

    const p_est = p.estado || 'Pendiente';
    const globalStates = ['Retirado', 'En camino', 'Entregado', 'Cancelado'];
    const estadoLocal = globalStates.includes(p_est) ? p_est : (locales?.[0]?.estado || p_est);
    const nombreLocal = locales?.[0]?.locales?.nombre || 'Local';

    const pedidoObj = {
      idPedido: p.id, nombreLocal, estado: estadoLocal,
      total: p.total, fecha: p.fecha || p.created_at, direccion: p.direccion,
      metodoPago: p.metodo_pago, tipoEntrega: p.tipo_entrega,
      observaciones: p.observaciones, numConfirmacion: p.num_confirmacion,
      itemsResumen: items.map(i => ({ nombre: i.nombre_item, cantidad: i.cantidad, precio: i.precio_unitario })),
    };

    const estadosCurso = ['Pendiente', 'Confirmado', 'Preparando', 'Listo', 'Retirado', 'En camino'];
    if (estadosCurso.includes(estadoLocal)) enCurso.push(pedidoObj);
    else historial.push(pedidoObj);
  }

  return { enCurso, historial };
}

export async function getOrderDetail(userId, pedidoId) {
  const { data: pedido } = await supabase
    .from('pedidos_general')
    .select('*')
    .eq('id', pedidoId)
    .eq('usuario_id', userId)
    .single();
  if (!pedido) return { success: false };

  const { data: locales } = await supabase
    .from('pedidos_locales')
    .select('*, locales(nombre)')
    .eq('pedido_id', pedidoId);

  let repartidor = null;
  if (pedido.repartidor_id) {
    const { data: rep } = await supabase
      .from('repartidores')
      .select('nombre, estado, telefono, patente, marca_modelo')
      .eq('id', pedido.repartidor_id)
      .single();
    if (rep) repartidor = rep;
  }

  const generalEst = pedido.estado || 'Pendiente';
  const globalStates = ['Retirado', 'En camino', 'Entregado', 'Cancelado'];
  const resolvedEstado = globalStates.includes(generalEst) ? generalEst : (locales?.[0]?.estado || generalEst);

  return {
    success: true,
    detalle: {
      ...pedido,
      estadoGeneral: resolvedEstado,
      locales: (locales || []).map(l => ({ nombreLocal: l.locales?.nombre || 'Local', estadoLocal: l.estado })),
      repartidor, direccion: pedido.direccion,
      metodoPago: pedido.metodo_pago, tipoEntrega: pedido.tipo_entrega, numConfirmacion: pedido.num_confirmacion,
    },
  };
}

// ═══════════════════════════════════════════════════
// CALIFICACIONES
// ═══════════════════════════════════════════════════
export async function rateOrder(userId, pedidoId, calificacion, comentario) {
  // Update the order in pedidos_general with the stars rating
  const { error: errorUpdate } = await supabase.from('pedidos_general').update({
    calificacion
  }).eq('id', pedidoId).eq('usuario_id', userId);
  
  if (errorUpdate) throw new Error(errorUpdate.message);
  
  // Guardamos retrocompatibilidad usando la tabla de calificaciones (puedes borrar esto si no usas 'calificaciones')
  await supabase.from('calificaciones').insert({
    usuario_id: userId, pedido_id: pedidoId, calificacion, comentario: comentario || '',
  });

  return { success: true };
}

// ═══════════════════════════════════════════════════
// REORDER
// ═══════════════════════════════════════════════════
export async function reOrderItems(userId, pedidoId) {
  const { data: items } = await supabase
    .from('pedidos_items')
    .select('item_id, nombre, precio_unitario, cantidad')
    .eq('pedido_id', pedidoId);

  if (!items || items.length === 0) return { success: false, items: [] };

  const menuItems = [];
  for (const item of items) {
    const { data: menu } = await supabase
      .from('menu')
      .select('*, locales(nombre, foto_url)')
      .eq('id', item.item_id)
      .single();
    if (menu) {
      menuItems.push({
        id: menu.id, nombre: menu.nombre, categoria: menu.categoria,
        descripcion: menu.descripcion, precio: menu.precio,
        imagen_url: menu.imagen_url, local_id: menu.local_id,
        local_nombre: menu.locales?.nombre || '', local_logo: menu.locales?.foto_url || '',
        qty: item.cantidad,
      });
    }
  }

  return { success: true, items: menuItems };
}

// ═══════════════════════════════════════════════════
// PROFILE UPDATE
// ═══════════════════════════════════════════════════
export async function updateProfile(userId, nombre, email, newPassword) {
  const updates = { nombre, email };
  if (newPassword) updates.password = newPassword;
  const { error } = await supabase.from('usuarios').update(updates).eq('id', userId);
  if (error) throw new Error(error.message);
  return { success: true };
}

// ═══════════════════════════════════════════════════
// BEBIDAS (drinks)
// ═══════════════════════════════════════════════════
export async function getBebidas() {
  const { data } = await supabase
    .from('menu')
    .select('*, locales(nombre, foto_url)')
    .eq('categoria', 'Bebidas')
    .eq('disponibilidad', true)
    .order('nombre');
  return (data || []).map(i => ({
    id: i.id, nombre: i.nombre, categoria: i.categoria,
    descripcion: i.descripcion, precio: i.precio,
    imagen_url: i.imagen_url, local_id: i.local_id,
    local_nombre: i.locales?.nombre || '', local_logo: i.locales?.foto_url || '',
  }));
}

// ═══════════════════════════════════════════════════
// REPARTIDORES — Availability check
// ═══════════════════════════════════════════════════
export async function checkActiveRepartidores() {
  const { data, error } = await supabase.rpc('check_active_repartidores');
  if (error) return { hasActive: false };
  return { hasActive: !!data };
}

// ═══════════════════════════════════════════════════
// LOCALES by Categoria
// ═══════════════════════════════════════════════════
export async function getLocalesByCategoria(categoria) {
  const { data } = await supabase
    .from('menu')
    .select('local_id, precio, locales(id, nombre, foto_url, estado)')
    .eq('categoria', categoria)
    .eq('disponibilidad', true);

  if (!data || data.length === 0) return [];

  const groupedMap = {};
  for (const item of data) {
    const lid = item.local_id;
    if (!groupedMap[lid]) {
      groupedMap[lid] = {
        local_id: lid,
        nombre_local: item.locales?.nombre || 'Local',
        logo_url: item.locales?.foto_url || '',
        estado: item.locales?.estado || 'Inactivo',
        precio_min_categoria: item.precio,
      };
    } else {
      if (item.precio < groupedMap[lid].precio_min_categoria) {
        groupedMap[lid].precio_min_categoria = item.precio;
      }
    }
  }

  return Object.values(groupedMap);
}

// ═══════════════════════════════════════════════════
// COBROS — Financial Dashboard
// ═══════════════════════════════════════════════════
export async function getCobrosByLocal(localId) {
  const { data: pedidosLocales } = await supabase
    .from('pedidos_locales')
    .select('id, pedido_id, total, estado, cobro_procesado, metodo_pago')
    .eq('local_id', localId).eq('estado', 'Entregado').eq('cobro_procesado', false);
  let totalVentas = 0, totalTransf = 0;
  const pedidosIncluidos = [];
  for (const p of (pedidosLocales || [])) {
    const sub = Number(p.total) || 0;
    totalVentas += sub;
    pedidosIncluidos.push(p.pedido_id);
    if ((p.metodo_pago || '').toLowerCase().includes('transfer')) totalTransf += sub;
  }
  const comision = totalVentas * 0.05;
  const { data: historial } = await supabase.from('gestion_cobros')
    .select('*').eq('local_id', localId).eq('tipo', 'Solicitud')
    .order('created_at', { ascending: false });
  return {
    success: true, totalVentas: +totalVentas.toFixed(2),
    comisionWeep: +comision.toFixed(2),
    totalIngresadoTransferencia: +totalTransf.toFixed(2),
    montoDisponibleParaRetirar: +Math.max(0, totalTransf - comision).toFixed(2),
    pedidosIncluidos: pedidosIncluidos.join(', '),
    historial: (historial || []).map(h => ({
      fechaSolicitud: h.fecha_solicitud, montoNeto: +h.monto_neto || 0,
      estado: h.estado || 'Pendiente', idsIncluidos: h.pedidos_incluidos || '',
    })),
  };
}

export async function solicitarCobro(localId, montoNeto) {
  const est = await getCobrosByLocal(localId);
  if (!est.success) return { success: false, error: 'Error recalculando cobros' };
  if (montoNeto > est.montoDisponibleParaRetirar + 0.01)
    return { success: false, error: `Monto supera disponible ($${est.montoDisponibleParaRetirar})` };
  if (montoNeto < 5000) return { success: false, error: 'Mínimo $5.000' };
  const { data: pend } = await supabase.from('gestion_cobros').select('id')
    .eq('local_id', localId).eq('estado', 'Pendiente').limit(1);
  if (pend?.length) return { success: false, error: 'Ya tienes solicitud pendiente' };
  const id = `COBRO-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).substring(2,5).toUpperCase()}`;
  const { error } = await supabase.from('gestion_cobros').insert({
    id, tipo: 'Solicitud', local_id: localId, total_ventas: est.totalVentas,
    comision_weep: est.comisionWeep, total_transferencia: est.totalIngresadoTransferencia,
    monto_disponible: est.montoDisponibleParaRetirar, monto_neto: montoNeto,
    estado: 'Pendiente', pedidos_incluidos: est.pedidosIncluidos,
  });
  if (error) return { success: false, error: error.message };
  if (est.pedidosIncluidos) {
    for (const pid of est.pedidosIncluidos.split(',').map(s => s.trim()).filter(Boolean)) {
      await supabase.from('pedidos_locales').update({ cobro_procesado: true })
        .eq('pedido_id', pid).eq('local_id', localId);
    }
  }
  return { success: true, idSolicitud: id, montoNeto, estado: 'Pendiente' };
}

// ═══════════════════════════════════════════════════
// REPARTIDORES — Advanced
// ═══════════════════════════════════════════════════
export async function assignRepartidor(pedidoId) {
  const { data: activos } = await supabase.from('repartidores')
    .select('id, nombre, email, telefono').eq('estado', 'Activo');
  if (!activos?.length) return { success: false, message: 'No hay repartidores activos' };
  const elegido = activos[0];
  const { error } = await supabase.from('pedidos_general')
    .update({ repartidor_id: elegido.id }).eq('id', pedidoId);
  if (error) return { success: false, error: error.message };
  return { success: true, repartidor: elegido };
}

export async function getPedidosDisponibles(repartidorId) {
  const { data } = await supabase.from('pedidos_general')
    .select('id, usuario_id, direccion, total, metodo_pago, estado, observaciones, tipo_entrega, local_id')
    .eq('repartidor_id', repartidorId)
    .in('estado', ['Pendiente', 'Confirmado', 'Retirado'])
    .order('created_at', { ascending: false });
  return { success: true, data: (data || []).map(p => ({
    id: p.id, cliente: p.usuario_id, direccion: p.direccion || 'Sin dirección',
    monto: +p.total || 0, pago: p.metodo_pago || 'Efectivo',
    estado: p.estado, observaciones: p.observaciones || '', envio: p.tipo_entrega || 'envio',
    local_id: p.local_id
  })) };
}

export async function updateEstadoPedido(pedidoId, nuevoEstado, repartidorId, pinConfirmacion = null) {
  const ok = ['Confirmado', 'Retirado', 'En camino', 'Entregado'];
  if (!ok.includes(nuevoEstado)) return { success: false, error: `Estado no permitido: ${nuevoEstado}` };
  const { data: ped } = await supabase.from('pedidos_general').select('id, num_confirmacion')
    .eq('id', pedidoId).eq('repartidor_id', repartidorId).single();
  if (!ped) return { success: false, error: 'Pedido no encontrado para este repartidor' };

  if (nuevoEstado === 'Entregado' && ped.num_confirmacion && ped.num_confirmacion !== pinConfirmacion) {
    return { success: false, error: 'PIN incorrecto' };
  }

  const { error } = await supabase.from('pedidos_general').update({ estado: nuevoEstado }).eq('id', pedidoId);
  if (error) return { success: false, error: error.message };
  if (nuevoEstado === 'Entregado') {
    const { data: d } = await supabase.from('repartidores').select('pedidos_hoy').eq('id', repartidorId).single();
    if (d) await supabase.from('repartidores').update({ pedidos_hoy: (d.pedidos_hoy || 0) + 1 }).eq('id', repartidorId);
  }
  return { success: true, mensaje: `Estado actualizado a "${nuevoEstado}"` };
}

// ═══════════════════════════════════════════════════
// AUXILIARY
// ═══════════════════════════════════════════════════
export async function getUserName(userId) {
  const { data } = await supabase.from('usuarios').select('nombre').eq('id', userId).single();
  return { success: true, nombre: data?.nombre || 'Cliente' };
}

export async function getLocalInfoForDelivery(localId) {
  const { data } = await supabase.from('locales').select('nombre, direccion, email').eq('id', localId).single();
  if (!data) return { success: false, error: 'Local no encontrado' };
  return { success: true, direccion: data.direccion || '—', nombreLocal: data.nombre || 'Local', email: data.email || '' };
}

export async function getMenuItemById(itemId) {
  const { data } = await supabase.from('menu').select('*').eq('id', itemId).single();
  if (!data) return { success: false };
  return { success: true, ...data };
}

// ═══════════════════════════════════════════════════
// MERCADO PAGO — Client helpers
// ═══════════════════════════════════════════════════
export async function createPendingMercadoPagoOrder({ userId, direccion, total, observaciones, cart, emailCliente, nombreCliente }) {
  const pedidoId = 'ORD-' + Math.random().toString(36).substring(2, 12).toUpperCase();
  const now = new Date();
  now.setHours(now.getHours() - 3);
  const fechaArg = now.toISOString();

  const { error } = await supabase.from('pedidos_general').insert({
    id: pedidoId, usuario_id: userId, direccion, estado: 'Pendiente de Pago',
    total, metodo_pago: 'Mercado Pago', observaciones: observaciones || '',
    tipo_entrega: direccion ? 'envio' : 'retiro',
    email_cliente: emailCliente || '', nombre_cliente: nombreCliente || '',
    fecha: fechaArg, created_at: fechaArg
  });
  if (error) throw new Error(error.message);
  const byLocal = {};
  for (const item of cart) { const lid = item.local_id || 'unknown'; if (!byLocal[lid]) byLocal[lid] = []; byLocal[lid].push(item); }
  for (const [localId, localItems] of Object.entries(byLocal)) {
    const plId = `PL-${pedidoId}-${localId}`;
    const sub = localItems.reduce((s, i) => s + (i.precio * i.cantidad), 0);
    await supabase.from('pedidos_locales').insert({ id: plId, pedido_id: pedidoId, local_id: localId, total: sub, estado: 'Pendiente de Pago', metodo_pago: 'Mercado Pago' });
    await supabase.from('pedidos_items').insert(localItems.map(i => ({ pedido_id: pedidoId, menu_item_id: i.id, nombre_item: i.nombre, precio_unitario: i.precio, cantidad: i.cantidad, subtotal: i.precio * i.cantidad })));
  }
  return { success: true, pedidoId };
}

export async function crearPedidoTemporal({ pedidoId, userId, cart, orderInfo }) {
  const { error } = await supabase.from('pedidos_temporales').insert({
    id: pedidoId,
    usuario_id: userId,
    cart_data: cart,
    order_info: orderInfo
  });
  if (error) throw new Error(error.message);
  return { success: true, pedidoId };
}

export async function markOrderAsPaid(pedidoId, paymentId, preferenceId, externalReference) {
  const { error } = await supabase.rpc('marcar_pedido_pagado', {
    p_pedido_id: pedidoId,
    p_payment_id: paymentId,
    p_preference_id: preferenceId || null,
    p_external_reference: externalReference || null
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ═══════════════════════════════════════════════════
// NOTIFICACIONES
// ═══════════════════════════════════════════════════
export async function notifyLocalsAboutNewOrder(pedidoId, cart, direccion, tipoEntrega, observaciones, metodoPago) {
  try {
    const byLocal = {};
    for (const item of cart) {
      const lid = item.local_id || 'unknown';
      if (!byLocal[lid]) byLocal[lid] = { items: [], nombreLocal: item.local_nombre || 'Local', subtotal: 0 };
      byLocal[lid].items.push(item);
      byLocal[lid].subtotal += (Number(item.precio) * (item.cantidad || item.qty || 1));
    }

    const promesas = Object.entries(byLocal).map(async ([localId, group]) => {
      if (localId === 'unknown') return;
      const { data: localData } = await supabase.from('locales').select('email, nombre').eq('id', localId).single();
      if (localData && localData.email) {
        let itemsHtml = group.items.map(i => 
          `<tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${i.cantidad || i.qty || 1}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${i.nombre}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">$${Number(i.precio).toLocaleString('es-AR')}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">$${(Number(i.precio) * (i.cantidad || i.qty || 1)).toLocaleString('es-AR')}</td>
          </tr>`
        ).join('');

        const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #9b1913;">¡Nuevo Pedido para ${localData.nombre}!</h2>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 5px 0;"><strong>📦 Nro de Pedido:</strong> ${pedidoId}</p>
              <p style="margin: 5px 0;"><strong>💳 Método de Pago:</strong> ${metodoPago.toUpperCase()}</p>
              <p style="margin: 5px 0;"><strong>🚚 Entrega:</strong> ${tipoEntrega}</p>
              <p style="margin: 5px 0;"><strong>📍 Dirección:</strong> ${direccion || 'Retiro en Local'}</p>
              ${observaciones ? `<p style="margin: 5px 0;"><strong>📝 Observaciones:</strong> ${observaciones}</p>` : ''}
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #f1f1f1; border-bottom: 2px solid #ddd;">
                  <th style="padding: 10px; text-align: left;">Cant.</th>
                  <th style="padding: 10px; text-align: left;">Item</th>
                  <th style="padding: 10px; text-align: left;">Precio</th>
                  <th style="padding: 10px; text-align: left;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
            
            <h3 style="text-align: right; color: #2e7d32;">Total Local: $${group.subtotal.toLocaleString('es-AR')}</h3>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://weep.com.ar/locales" style="background-color: #9b1913; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                Ir a mis pedidos de locales 🖥️
              </a>
            </div>

            <p style="margin-top: 30px; font-size: 16px; color: #d32f2f; text-align: center; font-weight: bold;">
              ⚠️ IMPORTANTE: Debes ingresar al panel para ACEPTAR o RECHAZAR este pedido.
            </p>

            <p style="margin-top: 15px; font-size: 14px; color: #666; text-align: center;">
              Por favor, revisa el panel de administración de Weep para preparar el pedido.<br>
              <strong>Weep Delivery</strong>
            </p>
          </div>
        `;

        // DEBUG LOG
        console.log(`[DEBUG] Enviando Correo a Local ${localData.email} para Pedido #${pedidoId}. Contiene el botón?`, htmlBody.includes('Ir a mis pedidos de locales'));

        await supabase.functions.invoke('send-email', {
          body: {
            to: localData.email,
            subject: `¡Nuevo Pedido #${pedidoId} en Weep! 🛵`,
            htmlBody
          }
        });
      }
    });

    await Promise.allSettled(promesas);
    return { success: true };
  } catch (error) {
    console.error("Error global enviando notificaciones:", error);
    return { success: false, error: error.message };
  }
}

export async function notifyCustomerAboutNewOrder(pedidoId, cart, direccion, tipoEntrega, numConfirmacion, emailCliente, nombreCliente) {
  try {
    if (!emailCliente) return;
    
    let itemsHtml = cart.map(i =>
      `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${i.cantidad || i.qty || 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${i.nombre}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">$${Number(i.precio).toLocaleString('es-AR')}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">$${(Number(i.precio) * (i.cantidad || i.qty || 1)).toLocaleString('es-AR')}</td>
      </tr>`
    ).join('');

    const isEnvio = tipoEntrega && (tipoEntrega.toLowerCase().includes('env') || tipoEntrega.toLowerCase() === 'con envío');
    
    const pinMessageHTML = isEnvio 
      ? `<p style="text-align: center; margin-bottom: 0;"><strong>Importante:</strong> Deberás informarle este número al repartidor cuando llegue con tu pedido para confirmar la entrega.</p>`
      : `<p style="text-align: center; margin-bottom: 0;"><strong>Importante:</strong> Deberás brindar este número en el mostrador del local para retirar tu pedido.</p>`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #9b1913;">¡Hola ${nombreCliente || 'Cliente'}! Tu pedido está confirmado. 🍔</h2>
        <div style="background: #eef2f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #2e7d32; text-align: center;">PIN DE CONFIRMACIÓN: <span style="font-size: 24px;">${numConfirmacion}</span></h3>
          ${pinMessageHTML}
        </div>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 5px 0;"><strong>📦 Nro de Pedido:</strong> ${pedidoId}</p>
          <p style="margin: 5px 0;"><strong>🚚 Entrega:</strong> ${tipoEntrega}</p>
          <p style="margin: 5px 0;"><strong>📍 Dirección:</strong> ${direccion || 'Retiro en Local'}</p>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #f1f1f1; border-bottom: 2px solid #ddd;">
              <th style="padding: 10px; text-align: left;">Cant.</th>
              <th style="padding: 10px; text-align: left;">Item</th>
              <th style="padding: 10px; text-align: left;">Precio</th>
              <th style="padding: 10px; text-align: left;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://weep.com.ar/mis-pedidos" style="background-color: #9b1913; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            Ver Seguimiento 🗺️
          </a>
        </div>

        <p style="margin-top: 30px; font-size: 14px; color: #666; text-align: center;">
          Podés seguir el estado de tu pedido desde la sección "Mis Pedidos" en la app.<br>
          <strong>¡Gracias por elegir Weep Delivery!</strong>
        </p>
      </div>
    `;

    await supabase.functions.invoke('send-email', {
      body: {
        to: emailCliente,
        subject: `Confirmación de Pedido #${pedidoId} - Weep 🛵`,
        htmlBody
      }
    });
  } catch (error) {
    console.error("Error enviando email al cliente:", error);
  }
}

export async function notifyDriverAboutNewOrder(pedidoId, cart, direccion, observaciones, total, metodoPago, repartidorEmail) {
  try {
    if (!repartidorEmail) return;

    let montoCobrar = "NADA (pagado con " + metodoPago + ")";
    if (metodoPago.toLowerCase() === "efectivo") {
      montoCobrar = "$" + Number(total).toLocaleString('es-AR');
    }

    // Calcular monto a pagar al local (solo efectivo)
    let montoPagarLocal = "NADA";
    if (metodoPago.toLowerCase() === "efectivo") {
      montoPagarLocal = "$" + cart.reduce((sum, i) => sum + (Number(i.precio) * (i.cantidad || i.qty || 1)), 0).toLocaleString('es-AR');
    }

    const firstLocalId = cart[0]?.local_id || 'Local';
    let direccionRetiro = "Consultar en panel de locales";
    
    if (firstLocalId !== 'Local') {
      const { data: localData } = await supabase.from('locales').select('direccion').eq('id', firstLocalId).single();
      if (localData?.direccion) direccionRetiro = localData.direccion;
    }

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="text-align:center; margin: 20px 0;">
          <img src="https://i.postimg.cc/5tKhqD4z/Chat-GPT-Image-Feb-23-2026-12-10-45-PM-(5).png" alt="Weep" width="120" style="border-radius:12px;">
        </div>
        <hr style="border:0; border-top:2px solid #d32f2f; margin:20px 0;">
        <h2 style="color: #9b1913; text-align: center;">¡Nuevo pedido asignado! 🛵</h2>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 5px 0;"><strong>📦 Nro de Pedido:</strong> ${pedidoId}</p>
        </div>
        
        <h3 style="color: #2e7d32; margin-top: 20px;">📍 RETIRO</h3>
        <p style="margin: 5px 0;"><strong>Dirección de retiro:</strong> ${direccionRetiro}</p>
        <p style="margin: 5px 0;"><strong>Total a pagar al local:</strong> ${montoPagarLocal}</p>
        
        <h3 style="color: #2e7d32; margin-top: 20px;">📍 ENTREGA</h3>
        <p style="margin: 5px 0;"><strong>Dirección de entrega:</strong> ${direccion || 'Retiro en Local'}</p>
        <p style="margin: 5px 0;"><strong>Observaciones:</strong> ${observaciones || 'Ninguna'}</p>
        <p style="margin: 5px 0;"><strong>Total a cobrar al cliente:</strong> ${montoCobrar}</p>
        
        <p style="margin-top: 30px; font-size: 14px; color: #666; text-align: center;">
          Por favor, dirígete a la dirección lo antes posible.<br>
          <strong>¡Gracias por ser parte de Weep!</strong>
        </p>
      </div>
    `;

    await supabase.functions.invoke('send-email', {
      body: {
        to: repartidorEmail,
        subject: `🚚 PEDIDO ASIGNADO #${pedidoId} - Weep`,
        htmlBody
      }
    });
  } catch (error) {
    console.error("Error enviando email al repartidor:", error);
  }
}

// ═══════════════════════════════════════════════════
// NOTIFICACIONES DE ESTADO (Panel Locales)
// ═══════════════════════════════════════════════════

const LOGO_HTML = `
  <div style="text-align: center; margin: 20px 0 30px 0;">
      <img src="https://i.postimg.cc/5tKhqD4z/Chat-GPT-Image-Feb-23-2026-12-10-45-PM-(5).png"
            alt="Weep" width="120" style="border-radius:12px;">
  </div>
  <hr style="border:0; border-top:2px solid #d32f2f; margin:30px 0;">
`;

export async function notifyOrderListo(pedido, direccionLocal) {
  try {
    const isEnvio = String(pedido.tipoEntrega).toLowerCase().includes('env') || String(pedido.tipoEntrega).toLowerCase() === 'con envío';
    
    let to = '';
    let subject = '';
    let htmlBody = '';

    if (isEnvio) {
      to = 'bajoneando.st@gmail.com'; // Email del motomandado
      subject = `¡Pedido listo para envío! #${pedido.idPedido}`;
      htmlBody = `
        ${LOGO_HTML}
        <h2 style="color:#d32f2f; text-align:center;">Pedido listo para retiro</h2>
        <p><strong>Cliente:</strong> ${pedido.nombreCliente}</p>
        <p><strong>Dirección Entrega:</strong> ${pedido.direccion}</p>
        <p><strong>Observaciones:</strong> ${pedido.observaciones || 'Ninguna'}</p>
        <p><strong>Local:</strong> ${direccionLocal}</p>
        <p style="font-weight:bold; color:#d32f2f;">
            Coordinar retiro lo antes posible.
        </p>
      `;
    } else {
      to = pedido.emailCliente;
      if (!to) return { success: false, error: 'No hay email del cliente' };
      subject = `¡Tu pedido está listo para retirar! #${pedido.idPedido}`;
      htmlBody = `
        ${LOGO_HTML}
        <h2 style="color:#d32f2f; text-align:center;">¡Tu pedido está listo!</h2>
        <p>Hola <strong>${pedido.nombreCliente}</strong>,</p>
        <p>Tu pedido ya está preparado para que pases a retirarlo.</p>
        <p><strong>Dirección del local:</strong> ${direccionLocal}</p>
        <p>¡Te esperamos!</p>
      `;
    }

    await supabase.functions.invoke('send-email', { body: { to, subject, htmlBody } });
    return { success: true };
  } catch (err) {
    console.error('Error in notifyOrderListo:', err);
    return { success: false, error: err.message };
  }
}

export async function notifyOrderEntregado(pedido) {
  try {
    const to = pedido.emailCliente;
    if (!to) return { success: false, error: 'No hay email del cliente' };

    const subject = `¡Tu pedido #${pedido.idPedido} fue entregado!`;
    const htmlBody = `
      ${LOGO_HTML}
      <h2 style="color:#2e7d32; text-align:center;">¡Pedido Entregado!</h2>
      <p>Hola <strong>${pedido.nombreCliente}</strong>,</p>
      <p>Tu pedido ha sido marcado como entregado. Esperamos que lo disfrutes.</p>
      <p>¡Gracias por elegir Weep!</p>
    `;

    await supabase.functions.invoke('send-email', { body: { to, subject, htmlBody } });
    return { success: true };
  } catch (err) {
    console.error('Error in notifyOrderEntregado:', err);
    return { success: false, error: err.message };
  }
}

export async function notifyOrderRechazado(pedido) {
  try {
    const to = pedido.emailCliente;
    if (!to) return { success: false, error: 'No hay email del cliente' };

    const subject = `Estado actualizado de tu pedido #${pedido.idPedido}`;
    const htmlBody = `
      ${LOGO_HTML}
      <h2 style="color:#d32f2f; text-align:center;">Pedido Cancelado</h2>
      <p>Hola <strong>${pedido.nombreCliente}</strong>,</p>
      <p>Lamentablemente el local no pudo aceptar tu pedido en esta ocasión.</p>
      <p>Cualquier pago realizado será reembolsado a la brevedad.</p>
      <p>Te pedimos disculpas por los inconvenientes.</p>
    `;

    await supabase.functions.invoke('send-email', { body: { to, subject, htmlBody } });
    return { success: true };
  } catch (err) {
    console.error('Error in notifyOrderRechazado:', err);
    return { success: false, error: err.message };
  }
}

export function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < 3; i++) {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + i * 0.5);
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime + i * 0.5);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.5 + 0.3);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start(audioCtx.currentTime + i * 0.5);
      oscillator.stop(audioCtx.currentTime + i * 0.5 + 0.3);
    }
  } catch (err) { console.error("Error playing sound:", err); }
}

export async function getLocalDatos(localId) {
  const { data } = await supabase.from('locales').select('nombre, direccion').eq('id', localId).single();
  return data;
}

export async function getMontoLocalPedido(pedidoId, localId) {
  const { data } = await supabase.from('pedidos_locales')
    .select('total')
    .eq('pedido_id', pedidoId)
    .eq('local_id', localId)
    .single();
  return data ? Number(data.total) : 0;
}

