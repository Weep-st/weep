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
export async function crearPedido({ userId, direccion, metodoPago, observaciones, tipoEntrega, items, emailCliente, nombreCliente }) {
  const pedidoId = 'PED-' + Date.now();
  const byLocal = {};
  for (const item of items) {
    const lid = item.local_id || 'unknown';
    if (!byLocal[lid]) byLocal[lid] = [];
    byLocal[lid].push(item);
  }
  const total = items.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
  const { error: pedError } = await supabase.from('pedidos_general').insert({
    id: pedidoId, usuario_id: userId, direccion, estado: 'Pendiente',
    total, metodo_pago: metodoPago, observaciones, tipo_entrega: tipoEntrega,
    email_cliente: emailCliente || '', nombre_cliente: nombreCliente || '',
  });
  if (pedError) throw new Error(pedError.message);
  for (const [localId, localItems] of Object.entries(byLocal)) {
    const pedLocalId = `PL-${pedidoId}-${localId}`;
    const subtotal = localItems.reduce((s, i) => s + (i.precio * i.cantidad), 0);
    await supabase.from('pedidos_locales').insert({ id: pedLocalId, pedido_id: pedidoId, local_id: localId, subtotal, estado: 'Pendiente' });
    const itemRows = localItems.map(i => ({
      pedido_local_id: pedLocalId, menu_item_id: i.id,
      nombre_item: i.nombre, precio_unitario: i.precio,
      cantidad: i.cantidad, subtotal: i.precio * i.cantidad,
    }));
    await supabase.from('pedidos_items').insert(itemRows);
  }
  return { success: true, pedidoId };
}

export async function getPedidosLocalesByLocal(localId) {
  const { data } = await supabase
    .from('pedidos_locales')
    .select('id, pedido_id, local_id, subtotal, estado')
    .eq('local_id', localId)
    .order('created_at', { ascending: false });
  return (data || []).map(p => [p.id, p.pedido_id, p.local_id, p.subtotal, p.estado]);
}

export async function getItemsByPedidoLocal(pedidoLocalId) {
  const { data } = await supabase.from('pedidos_items').select('*').eq('pedido_local_id', pedidoLocalId);
  return (data || []).map(i => [i.id, i.pedido_local_id, i.menu_item_id, '', i.nombre_item, i.precio_unitario, i.cantidad, i.subtotal]);
}

export async function getPedidoGeneral(pedidoId) {
  const { data } = await supabase.from('pedidos_general').select('*').eq('id', pedidoId).single();
  if (!data) return {};
  return {
    direccion: data.direccion, observaciones: data.observaciones,
    metodoPago: data.metodo_pago, tipoEntrega: data.tipo_entrega,
    emailCliente: data.email_cliente, nombreCliente: data.nombre_cliente,
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
