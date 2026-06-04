/* ═══════════════════════════════════════════════════
   WEEP API — Supabase Backend
   ═══════════════════════════════════════════════════ */
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY };

// Cloudflare R2 Storage (vía Supabase Edge Function)
const R2_PUBLIC_URL = 'https://pub-9ccf233ac6f348aebf32f1c18a6e9622.r2.dev';

// ─── Image Upload ───
export async function uploadImage(file) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/cloudflare-r2-upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'x-file-name': file.name,
      'Content-Type': file.type
    },
    body: file
  });
  
  const data = await res.json();
  if (!data.url) throw new Error(data.error || 'Error al subir imagen');
  return data.url;
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
  
  if (data.bloqueado) {
    return { success: false, error: 'Usuario bloqueado' };
  }

  return { 
    success: true, 
    userId: data.id, 
    nombre: data.nombre, 
    direccion: data.direccion, 
    telefono: data.telefono, 
    email: data.email,
    emailConfirmado: data.email_confirmado,
    role: data.role || 'user',
    ya_realizo_pedidos: data.ya_realizo_pedidos || false,
    ciudad: data.ciudad || 'Santo Tomé'
  };
}

export async function registerUsuario(nombre, email, password, direccion, telefono, termsAccepted = true, privacyAccepted = true, ciudad = 'Santo Tomé') {
  const id = 'USR-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const { error } = await supabase.from('usuarios').insert({ 
    id, nombre, email, password, direccion, telefono,
    terms_accepted: termsAccepted,
    privacy_accepted: privacyAccepted,
    terms_accepted_at: new Date().toISOString(),
    terms_version: 'v1',
    email_confirmado: false,
    token_confirmacion: code,
    ciudad
  });
  if (error) {
    if (error.code === '23505') {
      const msg = error.message.toLowerCase();
      if (msg.includes('email')) throw new Error('Este email ya está registrado. Por favor, inicia sesión.');
      if (msg.includes('telefono')) throw new Error('Este número de teléfono ya está en uso.');
      throw new Error('El email o teléfono ya está registrado.');
    }
    throw new Error(error.message);
  }
  
  // Enviar email de confirmación
  sendConfirmationEmail(email, code, 'usuario', nombre).catch(console.error);
  
  return { success: true, userId: id };
}

export async function getUsuarioByEmail(email) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function syncFirebaseUser(firebaseUser) {
  const existing = await getUsuarioByEmail(firebaseUser.email);
  if (existing) {
    return { 
      success: true, 
      userId: existing.id, 
      nombre: existing.nombre, 
      email: existing.email,
      direccion: existing.direccion,
      telefono: existing.telefono,
      emailConfirmado: existing.email_confirmado || firebaseUser.emailVerified,
      role: existing.role || 'user',
      ya_realizo_pedidos: existing.ya_realizo_pedidos || false,
      ciudad: existing.ciudad || 'Santo Tomé'
    };
  }
  
  // Si no existe, lo creamos (sin password, ya que usa Firebase)
  const id = 'USR-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const { error } = await supabase.from('usuarios').insert({ 
    id, 
    nombre: firebaseUser.displayName || 'Usuario Google', 
    email: firebaseUser.email,
    email_confirmado: firebaseUser.emailVerified || false,
    terms_accepted: true,
    terms_accepted_at: new Date().toISOString(),
    terms_version: 'v1'
  });
  
  if (error) throw new Error(error.message);
  
  return { 
    success: true, 
    userId: id, 
    nombre: firebaseUser.displayName, 
    email: firebaseUser.email,
    emailConfirmado: firebaseUser.emailVerified || false,
    role: 'user',
    isNew: true // Para que el frontend sepa que debe pedir datos extra
  };
}

export async function updateDireccion(userId, nuevaDireccion, lat, lng) {
  const updateData = { direccion: nuevaDireccion };
  if (lat !== undefined) updateData.lat = lat;
  if (lng !== undefined) updateData.lng = lng;
  
  const { error } = await supabase.from('usuarios').update(updateData).eq('id', userId);
  if (error) throw new Error(error.message);
  return { success: true };
}

// ═══════════════════════════════════════════════════
// AUTH — Locales (Restaurants)
// ═══════════════════════════════════════════════════
export async function loginLocal(email, password) {
  // 1. Buscar en la tabla principal de locales (Admins)
  const { data: localData, error: localError } = await supabase
    .from('locales')
    .select('*')
    .eq('email', email)
    .eq('password', password)
    .single();
    
  if (localData) {
    return { success: true, localId: localData.id, emailConfirmado: localData.email_confirmado, role: 'Admin' };
  }

  // 2. Buscar en la tabla de usuarios secundarios (Cajeros)
  const { data: userData, error: userError } = await supabase
    .from('locales_usuarios')
    .select('*')
    .eq('email', email)
    .eq('password', password)
    .single();

  if (userData) {
    return { success: true, localId: userData.local_id, emailConfirmado: true, role: userData.rol };
  }

  return { success: false };
}

export async function registerLocal(nombre, direccion, email, password, termsAccepted = true, privacyAccepted = true, planType = 'Emprendedor', lat = null, lng = null, contacto = null, ciudad = 'Santo Tomé') {
  const id = 'LOC-' + Date.now();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const { error } = await supabase.from('locales').insert({ 
    id, nombre, direccion, email, password,
    terms_accepted: termsAccepted,
    privacy_accepted: privacyAccepted,
    terms_accepted_at: new Date().toISOString(),
    terms_version: 'v1',
    email_confirmado: false,
    token_confirmacion: code,
    plan_id: planType === 'Empresa' ? 'ab9be1bd-f535-476e-90f4-f03ba074ba7d' : 'b404e2f7-6716-499b-8ebf-200ce417e4cb',
    lat,
    lng,
    contacto,
    ciudad
  });
  if (error) throw new Error(error.message);
  
  // Enviar email de confirmación
  sendConfirmationEmail(email, code, 'local', nombre).catch(console.error);
  
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
  return { 
    success: true, 
    ...data,
    dias_descuento: data.dias_descuento || [],
    descuento_general: data.descuento_general || 0,
    categoria_descuento: data.categoria_descuento || ''
  };
}

export async function updatePerfilLocal(params) {
  const { localId, ...updates } = params;
  if (updates.foto_url === '') delete updates.foto_url;
  const { error } = await supabase.from('locales').update(updates).eq('id', localId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function verifyLocalPassword(localId, password) {
  // Check if it's an Admin (locales table)
  const { data: localData } = await supabase
    .from('locales')
    .select('id')
    .eq('id', localId)
    .eq('password', password)
    .maybeSingle();
    
  if (localData) return true;

  // Check if it's a Cajero (locales_usuarios table)
  const { data: userData } = await supabase
    .from('locales_usuarios')
    .select('id')
    .eq('local_id', localId)
    .eq('password', password)
    .maybeSingle();

  return !!userData;
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
      EmailConfirmado: data.email_confirmado,
      FotoUrl: data.foto_url,
      HorarioApertura: data.horario_apertura,
      HorarioCierre: data.horario_cierre,
      DiasApertura: data.dias_apertura
    },
  };
}

export async function repartidorRegister(params) {
  const id = 'REP-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const { error } = await supabase.from('repartidores').insert({
    id, nombre: params.nombre, telefono: params.telefono,
    email: params.email, password: params.password,
    patente: params.patente, marca_modelo: params.marcaModelo,
    fecha_registro: new Date().toISOString(),
    terms_accepted: params.termsAccepted ?? true,
    privacy_accepted: params.privacyAccepted ?? true,
    terms_accepted_at: new Date().toISOString(),
    terms_version: 'v1',
    email_confirmado: false,
    token_confirmacion: code,
    ciudad: params.ciudad || 'Santo Tomé'
  });
  if (error) return { success: false, error: error.message };
  
  // Enviar email de confirmación
  sendConfirmationEmail(params.email, code, 'repartidor', params.nombre).catch(console.error);
  
  return { success: true };
}

// ─── Email Confirmation Logic ───
async function sendConfirmationEmail(email, code, tipo, nombre) {
  const isProd = window.location.hostname !== 'localhost';
  const baseUrl = isProd ? 'https://wepi.com.ar' : window.location.origin;
  const link = `${baseUrl}/confirmar-email?email=${encodeURIComponent(email)}&tipo=${tipo}`;
  
  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; borderRadius: 10px; background-color: #ffffff;">
      <h2 style="color: #e63946; text-align: center;">¡Hola ${nombre}!</h2>
      <p style="font-size: 16px; color: #333; text-align: center;">Gracias por registrarte en <strong>WEPI</strong>. Para completar tu registro, ingresá el siguiente código de confirmación:</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 42px; font-weight: bold; color: #e63946; letter-spacing: 10px; border: 2px dashed #e63946; padding: 10px 20px; border-radius: 10px;">${code}</span>
      </div>
      <p style="font-size: 14px; color: #666; text-align: center;">También podés confirmar haciendo clic en el siguiente botón:</p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="${link}" style="background-color: #e63946; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Confirmar mi email</a>
      </div>
      <p style="font-size: 12px; color: #999; text-align: center;">El código expirará pronto. Si no creaste esta cuenta, ignorá este correo.</p>
    </div>
  `;

  return supabase.functions.invoke('send-email', {
    body: {
      to: email,
      subject: `Código de confirmación WEEP: ${code}`,
      htmlBody: htmlBody
    }
  });
}

export async function confirmarEmail(code, tipo, email) {
  const { data, error } = await supabase.rpc('confirmar_email', {
    token_input: code,
    tipo_input: tipo,
    email_input: email
  });
    
  if (error) {
    console.error('Error in confirmation RPC:', error);
    return { success: false, error: 'Ocurrió un error en el servidor' };
  }
  
  if (!data) return { success: false, error: 'Código inválido o expirado' };
  return { success: true };
}

export async function reenviarEmailConfirmacion(email, tipo) {
  const table = tipo === 'usuario' ? 'usuarios' : tipo === 'local' ? 'locales' : 'repartidores';
  
  // Buscar usuario y generar nuevo código
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const { data, error } = await supabase
    .from(table)
    .update({ token_confirmacion: code })
    .eq('email', email)
    .select('nombre')
    .single();
    
  if (error || !data) return { success: false, error: 'No se encontró el usuario' };
  
  await sendConfirmationEmail(email, code, tipo, data.nombre);
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
      EmailConfirmado: data.email_confirmado,
      FotoUrl: data.foto_url,
      HorarioApertura: data.horario_apertura,
      HorarioCierre: data.horario_cierre,
      DiasApertura: data.dias_apertura,
      SesionVenceEn: data.sesion_vence_en,
      PedidosAceptados: data.pedidos_aceptados_count || 0,
      PedidosRechazados: data.pedidos_rechazados_count || 0,
      PedidosIgnorados: data.pedidos_ignorados_count || 0,
      OneSignalId: data.onesignal_id,
      TipoVehiculo: data.tipo_vehiculo || 'Moto',
      NivelRepartidor: data.nivel_repartidor || 1
    },
  };
}

export async function repartidorGetDashboardStats(repartidorId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Consideramos fecha >= hoy 00:00 (en hora local, la DB usa UTC-3 usualmente en el campo fecha)
  const [todayRes, noCerradosRes, archivedRes] = await Promise.all([
    supabase
      .from('pedidos_general')
      .select('precio_envio')
      .eq('repartidor_id', repartidorId)
      .eq('estado', 'Entregado')
      .gte('created_at', today.toISOString()),
    supabase
      .from('pedidos_general')
      .select('precio_envio')
      .eq('repartidor_id', repartidorId)
      .eq('estado', 'Entregado')
      .eq('cierre_caja', false),
    supabase
      .from('cierre_repartidores')
      .select('detalles_por_repartidor')
      .contains('detalles_por_repartidor', [{ id: repartidorId }])
  ]);

  if (todayRes.error) return { success: false, error: todayRes.error.message };
  if (noCerradosRes.error) return { success: false, error: noCerradosRes.error.message };

  const viajesHoy = todayRes.data.length;
  const gananciasTotalesHoy = todayRes.data.reduce((sum, p) => sum + (Number(p.precio_envio) || 0), 0);
  
  const viajesNoCerrados = noCerradosRes.data.length;
  const gananciasNoCerradas = noCerradosRes.data.reduce((sum, p) => sum + (Number(p.precio_envio) || 0), 0);

  let viajesArchivados = 0;
  let gananciasArchivadas = 0;

  if (archivedRes.data) {
    archivedRes.data.forEach(c => {
      const stats = (c.detalles_por_repartidor || []).find(r => r.id === repartidorId);
      if (stats) {
        viajesArchivados += (Number(stats.entregados) || 0);
        gananciasArchivadas += (Number(stats.monto_envio) || 0);
      }
    });
  }

  return {
    success: true,
    viajesHoy,
    gananciasTotalesHoy,
    viajesTotales: viajesNoCerrados + viajesArchivados,
    gananciasGlobales: gananciasNoCerradas + gananciasArchivadas
  };
}

export async function repartidorUpdatePerfil(params) {
  const { driverId, ...updates } = params;
  
  // Transform camelCase to snake_case if necessary, or just use the keys directly if they match
  const dbUpdates = {};
  if (params.nombre) dbUpdates.nombre = params.nombre;
  if (params.telefono) dbUpdates.telefono = params.telefono;
  if (params.email) dbUpdates.email = params.email;
  if (params.password) dbUpdates.password = params.password;
  if (params.patente) dbUpdates.patente = params.patente;
  if (params.marca_modelo) dbUpdates.marca_modelo = params.marca_modelo;
  if (params.foto_url) dbUpdates.foto_url = params.foto_url;
  if (params.horario_apertura !== undefined) dbUpdates.horario_apertura = params.horario_apertura;
  if (params.horario_cierre !== undefined) dbUpdates.horario_cierre = params.horario_cierre;
  if (params.dias_apertura !== undefined) dbUpdates.dias_apertura = params.dias_apertura;

  const { error } = await supabase.from('repartidores').update(dbUpdates).eq('id', driverId);
  if (error) throw new Error(error.message);
  return { success: true };
}

// Removido getArgTimeISO por conflicto cronologico

export async function repartidorActualizarEstado(driverId, estado, extendMinutes = 30) {
  const updates = { 
    estado,
    ultima_actividad: new Date().toISOString(),
  };

  if (estado === 'Activo') {
    const validUntil = new Date(Date.now() + (extendMinutes || 30) * 60000);
    updates.sesion_vence_en = validUntil.toISOString();
  } else {
    updates.sesion_vence_en = null;
  }

  const { error } = await supabase.from('repartidores').update(updates).eq('id', driverId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function repartidorUpdateHeartbeat(driverId, hadInteraction = false) {
  const now = new Date().toISOString();
  const updates = { 
    ultima_actividad: now
  };
  
  // if (hadInteraction) {
  //   updates.ultima_interaccion_ui = now;
  // }

  const { error } = await supabase
    .from('repartidores')
    .update(updates)
    .eq('id', driverId);
  if (error) return { success: false };
  return { success: true };
}

export async function repartidorRenovarSesion(driverId, mins = 30) {
  const validUntil = new Date(Date.now() + mins * 60000).toISOString();
  const { error } = await supabase
    .from('repartidores')
    .update({ sesion_vence_en: validUntil })
    .eq('id', driverId);
  return { success: !error };
}

export async function repartidorUpdateOneSignalId(driverId, onesignalId) {
  if (!onesignalId || typeof onesignalId !== 'string') return { success: false };
  console.log(`🚀 DB: Actualizando OneSignal para Driver ${driverId}:`, onesignalId);
  
  // Update in database
  const { error } = await supabase.from('repartidores')
    .update({ onesignal_id: onesignalId })
    .eq('id', driverId);
    
  if (error) {
    console.error("❌ Error actualizando OneSignal ID en DB:", error);
    throw new Error(error.message);
  }
  console.log("✅ DB: OneSignal ID actualizado exitosamente.");
  return { success: true };
}

export async function updateDriverCoords(driverId, lat, lng) {
  const { error } = await supabase
    .from('repartidores')
    .update({ lat, lng, ultima_actividad: new Date().toISOString() })
    .eq('id', driverId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export function subscribeToDriverLocation(driverId, onUpdate) {
  return supabase
    .channel(`driver_location_${driverId}`)
    .on('postgres_changes', { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'repartidores',
      filter: `id=eq.${driverId}`
    }, (payload) => {
      if (payload.new.lat && payload.new.lng) {
        onUpdate({ lat: payload.new.lat, lng: payload.new.lng });
      }
    })
    .subscribe();
}


export async function localUpdateOneSignalId(localId, onesignalId) {
  if (!onesignalId || typeof onesignalId !== 'string') return { success: false };
  
  const { error } = await supabase.from('locales')
    .update({ onesignal_id: onesignalId })
    .eq('id', localId);
    
  if (error) {
    console.error("Error updating Local OneSignal ID:", error);
    throw new Error(error.message);
  }
  return { success: true };
}

export async function usuarioUpdateOneSignalId(userId, onesignalId) {
  if (!onesignalId || typeof onesignalId !== 'string') return { success: false };
  
  const { error } = await supabase.from('usuarios')
    .update({ onesignal_id: onesignalId })
    .eq('id', userId);
    
  if (error) {
    console.error("Error updating User OneSignal ID:", error);
    throw new Error(error.message);
  }
  return { success: true };
}


// ═══════════════════════════════════════════════════
// LOCALES — Get all
// ═══════════════════════════════════════════════════
export async function getLocales() {
  let query = supabase.from('locales')
    .select('id, nombre, foto_url, estado, direccion, horario_apertura, horario_cierre, horario_apertura2, horario_cierre2, modo_automatico, dias_apertura, disponible_desde, acepta_retiro, acepta_envio, dias_descuento, descuento_general, categoria_descuento, plan_id, rubro, rubros, admin_status, slug, config_horarios, ciudad')
    .eq('admin_status', 'Aceptado');

  let { data, error } = await query;
  
  // Fallback si la columna ciudad no existe en la base de datos de locales
  if (error && error.message && error.message.includes('ciudad')) {
    console.warn("⚠️ La columna 'ciudad' no existe en 'locales'. Reintentando sin esa columna.");
    const fallbackQuery = supabase.from('locales')
      .select('id, nombre, foto_url, estado, direccion, horario_apertura, horario_cierre, horario_apertura2, horario_cierre2, modo_automatico, dias_apertura, disponible_desde, acepta_retiro, acepta_envio, dias_descuento, descuento_general, categoria_descuento, plan_id, rubro, rubros, admin_status, slug, config_horarios')
      .eq('admin_status', 'Aceptado');
    const res = await fallbackQuery;
    data = res.data;
  } else if (error) {
    console.error("Error fetching locales:", error);
  }
    
  const baseLocales = (data || []).map(l => ({
    id: l.id, nombre: l.nombre, logo: l.foto_url || '',
    estado: l.estado, direccion: l.direccion,
    horario_apertura: l.horario_apertura, horario_cierre: l.horario_cierre,
    horario_apertura2: l.horario_apertura2, horario_cierre2: l.horario_cierre2,
    modo_automatico: l.modo_automatico, dias_apertura: l.dias_apertura,
    disponible_desde: l.disponible_desde,
    acepta_retiro: l.acepta_retiro, acepta_envio: l.acepta_envio,
    dias_descuento: l.dias_descuento || [],
    descuento_general: l.descuento_general || 0,
    categoria_descuento: l.categoria_descuento || '',
    plan_id: l.plan_id,
    rubro: l.rubro,
    rubros: l.rubros || [],
    admin_status: l.admin_status,
    slug: l.slug,
    config_horarios: l.config_horarios || {},
    ciudad: l.ciudad || 'Santo Tomé'
  }));

  return enrichLocalesWithMinPrices(baseLocales, 'id');
}

/**
 * Helper to add the absolute minimum price of the menu to each local
 */
async function enrichLocalesWithMinPrices(locales, idKey = 'id') {
  if (!locales || locales.length === 0) return [];
  
  const ids = locales.map(l => l[idKey]);
  
  // Fetch min prices for all products (excluding 'Base' category)
  const { data: menuData } = await supabase
    .from('menu')
    .select('local_id, precio')
    .in('local_id', ids)
    .eq('disponibilidad', true)
    .neq('categoria', 'Base');

  const minPrices = {};
  (menuData || []).forEach(item => {
    const lid = item.local_id;
    if (!minPrices[lid] || Number(item.precio) < minPrices[lid]) {
      minPrices[lid] = Number(item.precio);
    }
  });

  return locales.map(l => {
    const lid = l[idKey];
    const min = minPrices[lid] || 0;
    return {
      ...l,
      precio_min: min,
      precio_min_categoria: min // Keep compatibility with existing UI fields
    };
  });
}

export async function getLocalBySlug(slug) {
  const { data, error } = await supabase
    .from('locales')
    .select('id, nombre, foto_url, estado, direccion, horario_apertura, horario_cierre, horario_apertura2, horario_cierre2, modo_automatico, dias_apertura, disponible_desde, acepta_retiro, acepta_envio, dias_descuento, descuento_general, categoria_descuento, plan_id, rubro, rubros, admin_status, slug, config_horarios')
    .eq('slug', slug)
    .maybeSingle();
  
  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id, nombre: data.nombre, logo: data.foto_url || '',
    estado: data.estado, direccion: data.direccion,
    horario_apertura: data.horario_apertura, horario_cierre: data.horario_cierre,
    horario_apertura2: data.horario_apertura2, horario_cierre2: data.horario_cierre2,
    modo_automatico: data.modo_automatico, dias_apertura: data.dias_apertura,
    disponible_desde: data.disponible_desde,
    acepta_retiro: data.acepta_retiro, acepta_envio: data.acepta_envio,
    dias_descuento: data.dias_descuento || [],
    descuento_general: data.descuento_general || 0,
    categoria_descuento: data.categoria_descuento || '',
    plan_id: data.plan_id,
    rubro: data.rubro,
    rubros: data.rubros || [],
    admin_status: data.admin_status,
    slug: data.slug,
    config_horarios: data.config_horarios || {}
  };
}

// ═══════════════════════════════════════════════════
// MENU
// ═══════════════════════════════════════════════════
export async function getMenuCompleto() {
  const { data } = await supabase
    .from('menu')
    .select('*, locales(nombre, foto_url, disponible_desde, acepta_retiro, acepta_envio, dias_descuento, descuento_general, categoria_descuento, estado, horario_apertura, horario_cierre, horario_apertura2, horario_cierre2, modo_automatico, dias_apertura, plan_id, rubros, config_horarios)')
    .eq('disponibilidad', true)
    .order('nombre');
  return (data || []).map(i => ({
    id: i.id, nombre: i.nombre, categoria: i.categoria,
    descripcion: i.descripcion, precio: i.precio,
    descuento: i.descuento || 0,
    disponibilidad: i.disponibilidad, imagen_url: i.imagen_url,
    local_id: i.local_id,
    local_nombre: i.locales?.nombre || '', local_logo: i.locales?.foto_url || '',
    local_disponible_desde: i.locales?.disponible_desde || null,
    local_acepta_retiro: i.locales?.acepta_retiro,
    local_acepta_envio: i.locales?.acepta_envio,
    local_dias_descuento: i.locales?.dias_descuento || [],
    local_descuento_general: i.locales?.descuento_general || 0,
    local_categoria_descuento: i.locales?.categoria_descuento || '',
    estado: i.locales?.estado,
    horario_apertura: i.locales?.horario_apertura,
    horario_cierre: i.locales?.horario_cierre,
    horario_apertura2: i.locales?.horario_apertura2,
    horario_cierre2: i.locales?.horario_cierre2,
    modo_automatico: i.locales?.modo_automatico,
    dias_apertura: i.locales?.dias_apertura,
    config_horarios: i.locales?.config_horarios || {}
  }));
}

export async function getPromos(extraCategories = [], extraLocalIds = []) {
  let orConditions = 'descuento.gt.0,categoria.eq.Combos,categoria.eq.Promos';
  
  if (Array.isArray(extraCategories) && extraCategories.length > 0) {
    const uniqueCats = [...new Set(extraCategories)].filter(Boolean);
    uniqueCats.forEach(cat => {
      orConditions += `,categoria.eq."${cat}"`;
    });
  }

  if (Array.isArray(extraLocalIds) && extraLocalIds.length > 0) {
    const uniqueIds = [...new Set(extraLocalIds)].filter(Boolean);
    orConditions += `,local_id.in.(${uniqueIds.join(',')})`;
  }

  const { data } = await supabase
    .from('menu')
    .select('*, locales!inner(*)')
    .eq('disponibilidad', true)
    .eq('locales.admin_status', 'Aceptado')
    .or(orConditions)
    .order('descuento', { ascending: false })
    .limit(100);

  return (data || []).map(i => ({
    id: i.id, nombre: i.nombre, categoria: i.categoria,
    descripcion: i.descripcion, precio: i.precio,
    descuento: i.descuento || 0,
    disponibilidad: i.disponibilidad, imagen_url: i.imagen_url,
    local_id: i.local_id,
    local_nombre: i.locales?.nombre || '', local_logo: i.locales?.foto_url || '',
    local_disponible_desde: i.locales?.disponible_desde || null,
    local_acepta_retiro: i.locales?.acepta_retiro,
    local_acepta_envio: i.locales?.acepta_envio,
    local_dias_descuento: i.locales?.dias_descuento || [],
    local_descuento_general: i.locales?.descuento_general || 0,
    local_categoria_descuento: i.locales?.categoria_descuento || '',
    estado: i.locales?.estado,
    horario_apertura: i.locales?.horario_apertura,
    horario_cierre: i.locales?.horario_cierre,
    horario_apertura2: i.locales?.horario_apertura2,
    horario_cierre2: i.locales?.horario_cierre2,
    modo_automatico: i.locales?.modo_automatico,
    dias_apertura: i.locales?.dias_apertura || [],
    config_horarios: i.locales?.config_horarios || {},
    variantes: i.variantes,
    stock_actual: i.stock_actual,
    maneja_stock: i.maneja_stock,
    stock_base_id: i.stock_base_id,
    unidades_por_venta: i.unidades_por_venta,
    local_rubro: i.locales?.rubro || '',
    local_rubros: i.locales?.rubros || [],
    local_plan_id: i.locales?.plan_id
  }));
}

export async function getMenuByCategoria(categoria) {
  const { data } = await supabase
    .from('menu')
    .select('*, locales(nombre, foto_url, disponible_desde, acepta_retiro, acepta_envio, dias_descuento, descuento_general, estado, horario_apertura, horario_cierre, horario_apertura2, horario_cierre2, modo_automatico, dias_apertura, config_horarios)')
    .eq('categoria', categoria)
    .eq('disponibilidad', true)
    .order('nombre');
  return (data || []).map(i => ({
    id: i.id, nombre: i.nombre, categoria: i.categoria,
    descripcion: i.descripcion, precio: i.precio,
    descuento: i.descuento || 0,
    imagen_url: i.imagen_url, local_id: i.local_id,
    variantes: i.variantes,
    local_nombre: i.locales?.nombre || '', local_logo: i.locales?.foto_url || '',
    local_disponible_desde: i.locales?.disponible_desde || null,
    local_dias_descuento: i.locales?.dias_descuento || [],
    local_descuento_general: i.locales?.descuento_general || 0,
    local_categoria_descuento: i.locales?.categoria_descuento || '',
    estado: i.locales?.estado,
    horario_apertura: i.locales?.horario_apertura,
    horario_cierre: i.locales?.horario_cierre,
    horario_apertura2: i.locales?.horario_apertura2,
    horario_cierre2: i.locales?.horario_cierre2,
    modo_automatico: i.locales?.modo_automatico,
    dias_apertura: i.locales?.dias_apertura,
    config_horarios: i.locales?.config_horarios || {}
  }));
}

export async function getMenuByLocalId(localId) {
  const { data } = await supabase
    .from('menu')
    .select('*, locales(nombre, foto_url, disponible_desde, acepta_retiro, acepta_envio, dias_descuento, descuento_general, categoria_descuento, estado, horario_apertura, horario_cierre, horario_apertura2, horario_cierre2, modo_automatico, dias_apertura, rubro, rubros, config_horarios)')
    .eq('local_id', localId)
    .order('nombre');
  return (data || []).map(i => ({
    id: i.id, nombre: i.nombre, categoria: i.categoria,
    descripcion: i.descripcion, precio: i.precio,
    descuento: i.descuento || 0,
    imagen_url: i.imagen_url, local_id: i.local_id,
    disponibilidad: i.disponibilidad, variantes: i.variantes,
    local_nombre: i.locales?.nombre || '', local_logo: i.locales?.foto_url || '',
    local_disponible_desde: i.locales?.disponible_desde || null,
    local_dias_descuento: i.locales?.dias_descuento || [],
    local_descuento_general: i.locales?.descuento_general || 0,
    local_categoria_descuento: i.locales?.categoria_descuento || '',
    local_rubro: i.locales?.rubro || '',
    local_rubros: i.locales?.rubros || [],
    stock_actual: i.stock_actual,
    maneja_stock: i.maneja_stock,
    stock_base_id: i.stock_base_id,
    unidades_por_venta: i.unidades_por_venta,
    estado: i.locales?.estado,
    horario_apertura: i.locales?.horario_apertura,
    horario_cierre: i.locales?.horario_cierre,
    horario_apertura2: i.locales?.horario_apertura2,
    horario_cierre2: i.locales?.horario_cierre2,
    modo_automatico: i.locales?.modo_automatico,
    dias_apertura: i.locales?.dias_apertura,
    config_horarios: i.locales?.config_horarios || {}
  }));
}

export async function getExploreItems(limit = 24) {
  const { data } = await supabase
    .from('menu')
    .select('*, locales!inner(nombre, foto_url, disponible_desde, acepta_retiro, acepta_envio, dias_descuento, descuento_general, categoria_descuento, estado, horario_apertura, horario_cierre, horario_apertura2, horario_cierre2, modo_automatico, dias_apertura, rubro, rubros, admin_status, config_horarios)')
    .eq('disponibilidad', true)
    .eq('locales.admin_status', 'Aceptado')
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []).map(i => ({
    id: i.id, nombre: i.nombre, categoria: i.categoria,
    descripcion: i.descripcion, precio: i.precio,
    descuento: i.descuento || 0,
    imagen_url: i.imagen_url, local_id: i.local_id,
    variantes: i.variantes,
    local_nombre: i.locales?.nombre || '', local_logo: i.locales?.foto_url || '',
    local_disponible_desde: i.locales?.disponible_desde || null,
    local_dias_descuento: i.locales?.dias_descuento || [],
    local_descuento_general: i.locales?.descuento_general || 0,
    local_categoria_descuento: i.locales?.categoria_descuento || '',
    estado: i.locales?.estado,
    horario_apertura: i.locales?.horario_apertura,
    horario_cierre: i.locales?.horario_cierre,
    horario_apertura2: i.locales?.horario_apertura2,
    horario_cierre2: i.locales?.horario_cierre2,
    modo_automatico: i.locales?.modo_automatico,
    dias_apertura: i.locales?.dias_apertura,
    local_rubro: i.locales?.rubro || '',
    local_rubros: i.locales?.rubros || [],
    config_horarios: i.locales?.config_horarios || {}
  }));
}

export async function getMostOrderedItems(limit = 12) {
  const { data: items } = await supabase
    .from('pedidos_items')
    .select('item_id')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (!items || items.length === 0) return [];

  const counts = {};
  items.forEach(i => {
    counts[i.item_id] = (counts[i.item_id] || 0) + 1;
  });

  const sortedIds = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, limit);

  const { data: menuData } = await supabase
    .from('menu')
    .select('*, locales!inner(nombre, foto_url, disponible_desde, acepta_retiro, acepta_envio, estado, horario_apertura, horario_cierre, horario_apertura2, horario_cierre2, modo_automatico, dias_apertura, rubro, rubros, admin_status, config_horarios)')
    .eq('locales.admin_status', 'Aceptado')
    .in('id', sortedIds);

  return (menuData || []).map(i => ({
    id: i.id, nombre: i.nombre, categoria: i.categoria,
    descripcion: i.descripcion, precio: i.precio,
    descuento: i.descuento || 0,
    imagen_url: i.imagen_url, local_id: i.local_id,
    variantes: i.variantes,
    local_nombre: i.locales?.nombre || '', local_logo: i.locales?.foto_url || '',
    local_disponible_desde: i.locales?.disponible_desde || null,
    estado: i.locales?.estado,
    horario_apertura: i.locales?.horario_apertura,
    horario_cierre: i.locales?.horario_cierre,
    horario_apertura2: i.locales?.horario_apertura2,
    horario_cierre2: i.locales?.horario_cierre2,
    modo_automatico: i.locales?.modo_automatico,
    dias_apertura: i.locales?.dias_apertura,
    local_rubro: i.locales?.rubro || '',
    local_rubros: i.locales?.rubros || [],
    config_horarios: i.locales?.config_horarios || {}
  })).sort((a, b) => sortedIds.indexOf(a.id) - sortedIds.indexOf(b.id));
}

export async function getBaseProductsStock(localIds) {
  const { data } = await supabase
    .from('menu')
    .select('id, stock_actual')
    .eq('categoria', 'Base')
    .in('local_id', localIds);
  return data || [];
}

export async function addMenuItem(params) {
  const id = `MENU-${params.localId}-${Date.now()}`;
  const { error } = await supabase.from('menu').insert({
    id, local_id: params.localId, nombre: params.nombre,
    categoria: params.categoria, descripcion: params.descripcion,
    precio: parseFloat(params.precio), 
    descuento: parseFloat(params.descuento) || 0,
    disponibilidad: params.disponibilidad !== false && params.disponibilidad !== 'No',
    tamano: params.tamano_porcion || params.tamano || '', variantes: params.variantes,
    tiempo_preparacion: String(parseInt(params.tiempo_preparacion) || 30),
    imagen_url: params.imagen_url || '',
    maneja_stock: params.maneja_stock || false,
    stock_actual: params.stock_actual || 0,
    stock_minimo: params.stock_minimo || 10,
    unidades_por_venta: params.unidades_por_venta || 1,
    stock_base_id: params.stock_base_id || null,
    es_combo_mundial: params.es_combo_mundial || false,
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
  if (params.descuento !== undefined) updates.descuento = parseFloat(params.descuento) || 0;
  if (params.disponibilidad !== undefined) updates.disponibilidad = params.disponibilidad !== false && params.disponibilidad !== 'No';
  if (params.tamano_porcion !== undefined || params.tamano !== undefined) updates.tamano = params.tamano_porcion || params.tamano;
  if (params.variantes !== undefined) updates.variantes = params.variantes;
  if (params.tiempo_preparacion) updates.tiempo_preparacion = String(parseInt(params.tiempo_preparacion));
  if (params.imagen_url) updates.imagen_url = params.imagen_url;
  
  if (params.maneja_stock !== undefined) updates.maneja_stock = params.maneja_stock;
  if (params.stock_actual !== undefined) updates.stock_actual = params.stock_actual;
  if (params.stock_minimo !== undefined) updates.stock_minimo = params.stock_minimo;
  if (params.unidades_por_venta !== undefined) updates.unidades_por_venta = params.unidades_por_venta;
  if (params.stock_base_id !== undefined) updates.stock_base_id = params.stock_base_id;
  if (params.ultima_confirmacion_stock !== undefined) updates.ultima_confirmacion_stock = params.ultima_confirmacion_stock;
  if (params.es_combo_mundial !== undefined) updates.es_combo_mundial = params.es_combo_mundial;

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
// HELADOS - SABORES
// ═══════════════════════════════════════════════════

export async function getSaboresByLocal(localId) {
  const { data, error } = await supabase
    .from('helado_sabores')
    .select('*')
    .eq('local_id', localId)
    .order('tipo', { ascending: false }) // Sabor then Salsa
    .order('nombre');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function addSabor(localId, nombre, tipo = 'Sabor') {
  const { error } = await supabase
    .from('helado_sabores')
    .insert({ local_id: localId, nombre, tipo, disponible: true });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function updateSaborDisponibilidad(id, disponible) {
  const { error } = await supabase
    .from('helado_sabores')
    .update({ disponible })
    .eq('id', id);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function deleteSabor(id) {
  const { error } = await supabase
    .from('helado_sabores')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
  return { success: true };
}

// ═══════════════════════════════════════════════════
// HELADOS - ADICIONALES (Cucuruchos, etc)
// ═══════════════════════════════════════════════════

export async function getAdicionalesByLocal(localId) {
  const { data, error } = await supabase
    .from('helado_adicionales')
    .select('*')
    .eq('local_id', localId)
    .order('nombre');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function addAdicional(localId, nombre, precio) {
  const { error } = await supabase
    .from('helado_adicionales')
    .insert({ local_id: localId, nombre, precio: parseFloat(precio), disponible: true });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function updateAdicionalDisponibilidad(id, disponible) {
  const { error } = await supabase
    .from('helado_adicionales')
    .update({ disponible })
    .eq('id', id);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function deleteAdicional(id) {
  const { error } = await supabase
    .from('helado_adicionales')
    .delete()
    .eq('id', id);
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
// ═══════════════════════════════════════════════════
// VALIDACIÓN DE DISPONIBILIDAD (NUEVO)
// ═══════════════════════════════════════════════════
export async function validateOrderAvailability(localIds, itemIds) {
  // Consulta locales y platos en paralelo
  const [localsRes, itemsRes] = await Promise.all([
    supabase.from('locales')
      .select('id, nombre, estado, horario_apertura, horario_cierre, modo_automatico, dias_apertura, disponible_desde, acepta_retiro, acepta_envio')
      .in('id', localIds),
    supabase.from('menu')
      .select('id, nombre, disponibilidad')
      .in('id', itemIds)
  ]);

  if (localsRes.error) throw new Error(localsRes.error.message);
  if (itemsRes.error) throw new Error(itemsRes.error.message);

  return {
    locales: localsRes.data || [],
    items: itemsRes.data || []
  };
}

// ═══════════════════════════════════════════════════
// PEDIDOS
// ═══════════════════════════════════════════════════
export async function crearPedido({ userId, pedidoId, direccion, metodoPago, observaciones, tipoEntrega, items, emailCliente, nombreCliente, estadoInicial, totalCalculado, lat, lng, precioEnvio, cuponId = null, descuentoCupon = 0, creditoWallet = 0, promociones_aplicadas = [], ganancia_credito = 0 }) {
  const total = totalCalculado !== undefined ? totalCalculado : items.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
  const estado = estadoInicial || 'Pendiente';

  const { data, error } = await supabase.rpc('create_pedido_completo', {
    p_user_id: userId,
    p_id: pedidoId,
    p_direccion: direccion,
    p_metodo_pago: metodoPago,
    p_observaciones: observaciones || '',
    p_tipo_entrega: tipoEntrega,
    p_total: total,
    p_estado: estado,
    p_email_cliente: emailCliente || '',
    p_nombre_cliente: nombreCliente || '',
    p_lat: lat || 0,
    p_lng: lng || 0,
    p_cart: items,
    p_precio_envio: precioEnvio || 0,
    p_cupon_id: cuponId,
    p_descuento_cupon: descuentoCupon,
    p_promociones_aplicadas: promociones_aplicadas,
    p_ganancia_credito: ganancia_credito
  });

  if (error) {
    console.error("🚨 RPC ERROR DETALLADO:", error);
    throw new Error(error.message + " | Detalles: " + (error.details || ''));
  }

  // Deduct wallet credit if applicable
  if (creditoWallet > 0) {
    try {
      const { data: spendRes, error: spendErr } = await supabase.rpc('spend_wallet_credit', {
        p_user_id: userId,
        p_amount: creditoWallet,
        p_order_id: data.pedido_id
      });
      if (spendErr) console.error("🚨 Error deducing wallet credit:", spendErr);
      
      // Also update the tracking column in pedidos_general
      await supabase.from('pedidos_general')
        .update({ credito_wallet: creditoWallet })
        .eq('id', data.pedido_id);
    } catch (err) {
      console.error("Error in wallet deduction flow:", err);
    }
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

  // Otorgar puntos de campaña mundialista (try-catch para no romper el flujo de pedidos)
  if (userId) {
    try {
      const itemIds = items.map(i => i.menuId || i.id || i.item_id).filter(Boolean);
      const localId = items[0]?.local_id;

      // Calcular inicio de semana (Lunes de la semana actual)
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      const startOfWeekIso = monday.toISOString();
      const weekId = `${monday.getFullYear()}-${(monday.getMonth() + 1).toString().padStart(2, '0')}-${monday.getDate().toString().padStart(2, '0')}`;

      // Ejecutar consultas en paralelo
      const [stats, localRes, menuRes, configRes, countRes] = await Promise.all([
        getMundialUsuarioStats(userId),
        localId ? supabase.from('locales').select('es_sponsor_mundial').eq('id', localId).maybeSingle() : Promise.resolve({ data: null }),
        itemIds.length > 0 ? supabase.from('menu').select('id').in('id', itemIds).eq('es_combo_mundial', true) : Promise.resolve({ data: [] }),
        getMundialConfig(),
        supabase.from('pedidos_general')
          .select('id', { count: 'exact', head: true })
          .eq('usuario_id', userId)
          .gte('created_at', startOfWeekIso)
          .neq('estado', 'Rechazado')
          .neq('estado', 'Cancelado')
      ]);

      if (stats) {
        const esSponsor = localRes?.data?.es_sponsor_mundial || false;
        const tieneCombo = (menuRes?.data || []).length > 0;
        const conf = configRes || {};

        // 1. Determinar puntos y sobres base según Sponsor y Combo
        let ptsBase = 250;
        let sobresBase = 0;

        if (esSponsor && tieneCombo) {
          ptsBase = conf.pts_combo_sponsor !== undefined ? conf.pts_combo_sponsor : 700;
          sobresBase = conf.sobres_combo_sponsor !== undefined ? conf.sobres_combo_sponsor : 2;
        } else if (tieneCombo) {
          ptsBase = conf.pts_combo_mundialista !== undefined ? conf.pts_combo_mundialista : 500;
          sobresBase = conf.sobres_combo_mundialista !== undefined ? conf.sobres_combo_mundialista : 1;
        } else if (esSponsor) {
          ptsBase = conf.pts_pedido_sponsor !== undefined ? conf.pts_pedido_sponsor : 400;
          sobresBase = conf.sobres_pedido_sponsor !== undefined ? conf.sobres_pedido_sponsor : 1;
        } else {
          ptsBase = conf.pts_pedido_normal !== undefined ? conf.pts_pedido_normal : 250;
          sobresBase = conf.sobres_pedido_normal !== undefined ? conf.sobres_pedido_normal : 0;
        }

        let nuevosPuntos = (stats.puntos_totales || 0) + ptsBase;
        let nuevosSobres = (stats.sobres_disponibles || 0) + sobresBase;

        // 2. Determinar bonos semanales (Doblete / Triplete)
        const totalPedidosEstaSemana = countRes?.count || 0;
        const updates = {};

        // Bono Doblete
        if (totalPedidosEstaSemana === 2 && stats.ultimo_doblete_semana !== weekId) {
          const ptsDoblete = conf.pts_doblete_semanal !== undefined ? conf.pts_doblete_semanal : 300;
          nuevosPuntos += ptsDoblete;
          updates.ultimo_doblete_semana = weekId;
        }

        // Bono Triplete
        if (totalPedidosEstaSemana === 3 && stats.ultimo_triplete_semana !== weekId) {
          const ptsTriplete = conf.pts_triplete_semanal !== undefined ? conf.pts_triplete_semanal : 600;
          nuevosPuntos += ptsTriplete;
          updates.ultimo_triplete_semana = weekId;
        }

        // 3. Guardar estadísticas actualizadas
        updates.puntos_totales = nuevosPuntos;
        updates.sobres_disponibles = nuevosSobres;

        await supabase
          .from('mundial_usuario_stats')
          .update(updates)
          .eq('usuario_id', userId);
      }
    } catch (ptsErr) {
      console.error("Error otorgando puntos mundialistas por pedido:", ptsErr);
    }
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
  const { data } = await supabase.from('pedidos_general').select('*, repartidores(nombre, telefono)').eq('id', pedidoId).single();
  if (!data) return {};
  return {
    direccion: data.direccion, observaciones: data.observaciones,
    metodoPago: data.metodo_pago, tipoEntrega: data.tipo_entrega,
    emailCliente: data.email_cliente, nombreCliente: data.nombre_cliente,
    fecha: data.created_at, numConfirmacion: data.num_confirmacion,
    repartidorId: data.repartidor_id,
    repartidorNombre: data.repartidores?.nombre || null,
    repartidorTelefono: data.repartidores?.telefono || null
  };
}

export async function updateEstadoLocalOrder(pedidoLocalId, estado) {
  // 1. Actualizar tabla local
  const { error } = await supabase.from('pedidos_locales').update({ estado }).eq('id', pedidoLocalId);
  if (error) throw new Error(error.message);

  // 2. Sincronizar con tabla general
  try {
    const { data: pl } = await supabase.from('pedidos_locales').select('pedido_id').eq('id', pedidoLocalId).maybeSingle();
    if (pl?.pedido_id) {
      // 2a. Obtener datos del pedido general para decidir el estado de sincronización
      const { data: pg } = await supabase.from('pedidos_general')
        .select('tipo_entrega, usuario_id, repartidor_id')
        .eq('id', pl.pedido_id)
        .maybeSingle();

      let targetGeneralEstado = estado;
      // Si el local marca como 'Entregado' pero el pedido es con envío, lo pasamos a 'Retirado'
      // para que el repartidor lo siga viendo en su dashboard y pueda marcar la entrega final.
      if (estado === 'Entregado' && pg?.tipo_entrega?.toLowerCase().includes('env')) {
        targetGeneralEstado = 'Retirado';
      }

      await supabase.from('pedidos_general').update({ estado: targetGeneralEstado }).eq('id', pl.pedido_id);

      // 2b. Efectos secundarios según el estado
      if (estado === 'Rechazado' || estado === 'Cancelado') {
        if (pg?.repartidor_id && pg.repartidor_id.length > 20) {
          await supabase.from('repartidores').update({ estado: 'Activo' }).eq('id', pg.repartidor_id);
        }
      }
      
      if (estado === 'Entregado') {
        if (pg?.usuario_id && pg.usuario_id.length > 20) {
          await supabase.from('usuarios').update({ ya_realizo_pedidos: true }).eq('id', pg.usuario_id);
          // Acreditar crédito en Wallet si la orden generó ganancia por promo
          try {
            await supabase.rpc('earn_wallet_credit_from_order', { p_order_id: pl.pedido_id });
          } catch (e) {
            console.error("Error acreditando crédito Wallet (Local):", e);
          }
        }
      }
    }
  } catch (e) {
    console.warn("Error en sincronización general desde local:", e.message);
  }
  
  return { success: true };
}


// ═══════════════════════════════════════════════════
// LANZAMIENTO
// ═══════════════════════════════════════════════════
export async function registrarEmailLanzamiento(email) {
  const now = new Date();
  const options = { timeZone: 'America/Argentina/Buenos_Aires' };
  const { error } = await supabase.from('lanzamiento').insert({
    email, 
    dia: now.toLocaleDateString('es-AR', options), 
    hora: now.toLocaleTimeString('es-AR', options),
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
    .select('*, locales(nombre, foto_url, disponible_desde, acepta_retiro, acepta_envio, dias_descuento, descuento_general, estado, horario_apertura, horario_cierre, modo_automatico, dias_apertura)')
    .eq('disponibilidad', true)
    .or(`nombre.ilike.%${query}%,descripcion.ilike.%${query}%,categoria.ilike.%${query}%`)
    .order('nombre')
    .limit(50);
  return (data || []).map(i => ({
    id: i.id, nombre: i.nombre, categoria: i.categoria,
    descripcion: i.descripcion, precio: i.precio,
    descuento: i.descuento || 0,
    imagen_url: i.imagen_url, local_id: i.local_id, variantes: i.variantes,
    local_nombre: i.locales?.nombre || '', local_logo: i.locales?.foto_url || '',
    local_disponible_desde: i.locales?.disponible_desde || null,
    local_acepta_retiro: i.locales?.acepta_retiro,
    local_acepta_envio: i.locales?.acepta_envio,
    local_dias_descuento: i.locales?.dias_descuento || [],
    local_descuento_general: i.locales?.descuento_general || 0,
    estado: i.locales?.estado,
    horario_apertura: i.locales?.horario_apertura,
    horario_cierre: i.locales?.horario_cierre,
    modo_automatico: i.locales?.modo_automatico,
    dias_apertura: i.locales?.dias_apertura
  }));
}

export async function getUserOrderCount(userId) {
  if (!userId || userId === 'undefined' || userId === 'null') {
    return { success: true, count: 0 };
  }
  
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('ya_realizo_pedidos')
      .eq('id', userId)
      .maybeSingle(); // Usamos maybeSingle para evitar error si no existe

    if (error) throw error;

    return { success: true, count: data?.ya_realizo_pedidos ? 1 : 0 };
  } catch (error) {
    console.warn("Error fetching user order status:", error);
    return { success: true, count: 0 };
  }
}

export async function getUserPromoUsage(userId) {
  if (!userId) return {};
  try {
    const { data, error } = await supabase.rpc('get_user_promo_usage', { p_user_id: userId });
    if (error) throw error;
    return data || {};
  } catch (err) {
    console.warn("Error fetching promo usage:", err);
    return {};
  }
}

// ═══════════════════════════════════════════════════
// MIS PEDIDOS
// ═══════════════════════════════════════════════════
export async function getMisPedidos(userId) {
  const { data: pedidos, error } = await supabase
    .from('pedidos_general')
    .select(`
      *,
      repartidor:repartidores(nombre, telefono),
      pedidos_items:pedidos_items(
        *
      )
    `)
    .eq('usuario_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error in getMisPedidos:", error);
    throw new Error(error.message);
  }

  if (!pedidos || pedidos.length === 0) return { enCurso: [], historial: [] };

  // Fetch pedidos_locales separately due to missing database foreign key constraint in the schema cache
  try {
    const pedidoIds = pedidos.map(p => p.id);
    const { data: localesRelation, error: localesError } = await supabase
      .from('pedidos_locales')
      .select(`
        *,
        locales(nombre)
      `)
      .in('pedido_id', pedidoIds);

    if (localesError) {
      console.error("Error fetching corresponding pedidos_locales:", localesError);
    } else if (localesRelation) {
      // Group pedidos_locales by pedido_id
      const localesMap = {};
      for (const pl of localesRelation) {
        if (!localesMap[pl.pedido_id]) {
          localesMap[pl.pedido_id] = [];
        }
        localesMap[pl.pedido_id].push(pl);
      }

      // Merge into pedidos
      for (const p of pedidos) {
        p.pedidos_locales = localesMap[p.id] || [];
      }
    }
  } catch (e) {
    console.error("Error processing pedidos_locales separate query:", e);
  }

  const enCurso = [];
  const historial = [];

  for (const p of pedidos) {
    const locales = p.pedidos_locales || [];
    const items = p.pedidos_items || [];

    const p_est = p.estado || 'Pendiente';
    const globalStates = ['Retirado', 'En camino', 'Entregado', 'Cancelado'];
    const estadoLocal = globalStates.includes(p_est) ? p_est : (locales?.[0]?.estado || p_est);
    const nombreLocal = locales?.[0]?.locales?.nombre || 'Local';

    const pedidoObj = {
      idPedido: p.id, nombreLocal, estado: estadoLocal,
      total: p.total, fecha: p.fecha || p.created_at, direccion: p.direccion,
      metodoPago: p.metodo_pago, tipoEntrega: p.tipo_entrega,
      observaciones: p.observaciones, numConfirmacion: p.num_confirmacion,
      repartidorId: p.repartidor_id,
      repartidorNombre: p.repartidor?.nombre,
      repartidorTelefono: p.repartidor?.telefono,
      pago_pendiente_at: p.pago_pendiente_at,
      created_at: p.created_at,
      localId: p.local_id,
      platform_gross: p.total - items.reduce((sum, i) => sum + (Number(i.precio_unitario) * Number(i.cantidad)), 0),
      itemsResumen: items.map(i => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio_unitario })),
    };

    const estadosCurso = ['Pendiente', 'Confirmado', 'Aceptado', 'Preparando', 'Listo', 'Retirado', 'En camino', 'Pendiente de Pago', 'Buscando Repartidor', 'Rechazado', 'Cancelado'];
    if (estadosCurso.includes(estadoLocal)) enCurso.push(pedidoObj);
    else historial.push(pedidoObj);
  }

  return { enCurso, historial };
}

export async function getPedidosLocalesCompletosByLocal(localId) {
  // 1. Fetch orders from pedidos_locales (Limit 50 to guarantee massive performance)
  const { data: localOrders, error: localErr } = await supabase
    .from('pedidos_locales')
    .select('id, pedido_id, local_id, total, estado')
    .eq('local_id', localId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (localErr) {
    console.error("Error in getPedidosLocalesCompletosByLocal:", localErr);
    throw localErr;
  }

  if (!localOrders || localOrders.length === 0) return [];

  const uniquePedidoIds = [...new Set(localOrders.map(o => o.pedido_id))].filter(Boolean);

  // 2. Fetch all matching general orders in ONE query
  const { data: generalOrders, error: generalErr } = await supabase
    .from('pedidos_general')
    .select('*, repartidores:repartidor_id(nombre, telefono)')
    .in('id', uniquePedidoIds);

  if (generalErr) {
    console.error("Error fetching general orders:", generalErr);
    throw generalErr;
  }

  // 3. Fetch all matching items in ONE query
  const { data: allItems, error: itemsErr } = await supabase
    .from('pedidos_items')
    .select('*')
    .in('pedido_id', uniquePedidoIds)
    .eq('local_id', localId);

  if (itemsErr) {
    console.error("Error fetching items:", itemsErr);
    throw itemsErr;
  }

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

  return localOrders.map(p => {
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
    .select('id, item_id, nombre, precio_unitario, cantidad')
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
      // Determinar el precio actual de este producto
      let currentPrice = menu.precio;

      // Parsear la configuración de variantes si existe
      let cfg = null;
      if (menu.variantes) {
        try {
          if (typeof menu.variantes === 'string') cfg = JSON.parse(menu.variantes);
          else if (typeof menu.variantes === 'object') cfg = menu.variantes;
        } catch (e) {
          console.error("Error al parsear variantes para el item", menu.id, e);
        }
      }

      if (cfg) {
        if (cfg.es_helado || menu.categoria === 'Helados') {
          // Lógica de Helados
          if (cfg.precios && typeof cfg.precios === 'object') {
            const sizes = Object.keys(cfg.precios);
            const matchedSize = sizes.find(size => item.nombre.toLowerCase().includes(size.toLowerCase()));
            if (matchedSize) {
              currentPrice = parseFloat(cfg.precios[matchedSize].precio || 0);

              // Consultar los adicionales de helado de la base de datos para ver si coinciden con los extras listados en el nombre
              try {
                const { data: adicionales } = await supabase
                  .from('helado_adicionales')
                  .select('nombre, precio')
                  .eq('local_id', menu.local_id);
                if (adicionales && adicionales.length > 0) {
                  const lowerName = item.nombre.toLowerCase();
                  for (const ad of adicionales) {
                    if (lowerName.includes(ad.nombre.toLowerCase())) {
                      currentPrice += parseFloat(ad.precio || 0);
                    }
                  }
                }
              } catch (err) {
                console.error("Error al obtener helado_adicionales para el reorder:", err);
              }
            } else {
              // Si no coincide ningún tamaño, usamos el precio histórico de la orden como fallback seguro
              currentPrice = item.precio_unitario;
            }
          } else {
            currentPrice = item.precio_unitario;
          }
        } else if (cfg.es_hamburguesa || cfg.es_combo || cfg.es_pancho || cfg.con_papas || (cfg.variants?.length > 0) || (cfg.extras?.length > 0)) {
          // Lógica de Hamburguesas/Combos y productos con variantes generales
          let baseVariantPrice = 0;
          let variantMatched = false;

          if (cfg.variants && Array.isArray(cfg.variants)) {
            const matchedVariant = cfg.variants.find(v => item.nombre.toLowerCase().includes(v.nombre.toLowerCase()));
            if (matchedVariant) {
              baseVariantPrice = parseFloat(matchedVariant.precio || 0);
              variantMatched = true;
            }
          }

          if (!variantMatched) {
            baseVariantPrice = parseFloat(menu.precio || 0);
          }

          let extrasPrice = 0;
          if (cfg.extras && Array.isArray(cfg.extras)) {
            const lowerName = item.nombre.toLowerCase();
            for (const ex of cfg.extras) {
              if (lowerName.includes(ex.nombre.toLowerCase())) {
                extrasPrice += parseFloat(ex.precio || 0);
              }
            }
          }

          let friesPrice = 0;
          if (cfg.con_papas && (item.nombre.toLowerCase().includes('papas') || item.nombre.toLowerCase().includes('combo'))) {
            friesPrice = parseFloat(cfg.precio_papas || 0);
          }

          currentPrice = baseVariantPrice + extrasPrice + friesPrice;
        }
      }

      // Caída segura (Fallback): Si el precio calculado es 0 o inválido, usar el precio cobrado históricamente
      if (!currentPrice || isNaN(currentPrice) || currentPrice <= 0) {
        currentPrice = item.precio_unitario || menu.precio || 0;
      }

      menuItems.push({
        ...menu,
        menuId: menu.id,
        id: `reorder-${item.id}`,
        nombre: item.nombre,
        categoria: menu.categoria,
        descripcion: menu.descripcion,
        precio: currentPrice, // Usar el precio recalculado correctamente
        imagen_url: menu.imagen_url,
        local_id: menu.local_id,
        variantes: menu.variantes,
        local_nombre: menu.locales?.nombre || '',
        local_logo: menu.locales?.foto_url || '',
        qty: item.cantidad,
      });
    }
  }

  return { success: true, items: menuItems };
}

// ═══════════════════════════════════════════════════
// CANCEL ORDER BY USER
// ═══════════════════════════════════════════════════
export async function cancelarPedidoUsuario(userId, pedidoId) {
  // Update general
  const { error: e1 } = await supabase.from('pedidos_general')
    .update({ estado: 'Cancelado' })
    .eq('id', pedidoId)
    .eq('usuario_id', userId);
  if (e1) throw new Error(e1.message);

  // Update locales
  const { error: e2 } = await supabase.from('pedidos_locales')
    .update({ estado: 'Cancelado' })
    .eq('pedido_id', pedidoId);
  if (e2) throw new Error(e2.message);

  return { success: true };
}

// ═══════════════════════════════════════════════════
// PROFILE UPDATE
// ═══════════════════════════════════════════════════
export async function updateProfile(userId, nombre, email, telefono, newPassword) {
  const updates = { nombre, email, telefono };
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
    variantes: i.variantes,
    local_nombre: i.locales?.nombre || '', local_logo: i.locales?.foto_url || '',
  }));
}

// ═══════════════════════════════════════════════════
// REPARTIDORES — Availability check
// ═══════════════════════════════════════════════════
export async function checkActiveRepartidores() {
  const { count, error } = await supabase
    .from('repartidores')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'Activo')
    .eq('admin_status', 'Aceptado');
    
  if (error) {
    console.error("Error checking active repartidores:", error);
    return { hasActive: false };
  }
  return { hasActive: (count || 0) > 0 };
}

export async function getRepartidoresActivosCount(excludeDriverId) {
  const { data, count, error } = await supabase
    .from('repartidores')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'Activo')
    .eq('admin_status', 'Aceptado')
    .neq('id', excludeDriverId);
  
  if (error) return 0;
  return count || 0;
}

export async function getLocalesByRubro(rubro) {
  const { data } = await supabase
    .from('locales')
    .select('*')
    .or(`rubro.eq.${rubro},rubros.cs.{${rubro}}`)
    .eq('admin_status', 'Aceptado');

  const baseLocales = (data || []).map(l => ({
    local_id: l.id,
    nombre_local: l.nombre,
    logo_url: l.foto_url || '',
    estado: l.estado || 'Inactivo',
    precio_min_categoria: 0,
    horario_apertura: l.horario_apertura,
    horario_cierre: l.horario_cierre,
    horario_apertura2: l.horario_apertura2,
    horario_cierre2: l.horario_cierre2,
    modo_automatico: l.modo_automatico,
    dias_apertura: l.dias_apertura,
    disponible_desde: l.disponible_desde,
    acepta_retiro: l.acepta_retiro,
    acepta_envio: l.acepta_envio,
    dias_descuento: l.dias_descuento || [],
    descuento_general: l.descuento_general || 0,
    plan_id: l.plan_id,
    rubro: l.rubro,
    rubros: l.rubros || [],
    config_horarios: l.config_horarios || {}
  }));

  return enrichLocalesWithMinPrices(baseLocales, 'local_id');
}

export async function getLocalesByCategoria(categoria) {
  const { data } = await supabase
    .from('menu')
    .select('local_id, precio, locales(id, nombre, foto_url, estado, horario_apertura, horario_cierre, horario_apertura2, horario_cierre2, modo_automatico, dias_apertura, admin_status, disponible_desde, acepta_retiro, acepta_envio, dias_descuento, descuento_general, plan_id, rubro, rubros, config_horarios)')
    .eq('categoria', categoria)
    .eq('disponibilidad', true);

  if (!data || data.length === 0) return [];

  const groupedMap = {};
  for (const item of data) {
    if (item.locales?.admin_status !== 'Aceptado') continue;
    const lid = item.local_id;
    if (!groupedMap[lid]) {
      groupedMap[lid] = {
        local_id: lid,
        nombre_local: item.locales?.nombre || 'Local',
        logo_url: item.locales?.foto_url || '',
        estado: item.locales?.estado || 'Inactivo',
        precio_min_categoria: item.precio,
        horario_apertura: item.locales?.horario_apertura,
        horario_cierre: item.locales?.horario_cierre,
        horario_apertura2: item.locales?.horario_apertura2,
        horario_cierre2: item.locales?.horario_cierre2,
        modo_automatico: item.locales?.modo_automatico,
        dias_apertura: item.locales?.dias_apertura,
        disponible_desde: item.locales?.disponible_desde,
        acepta_retiro: item.locales?.acepta_retiro,
        plan_id: item.locales?.plan_id,
        acepta_envio: item.locales?.acepta_envio,
        dias_descuento: item.locales?.dias_descuento || [],
        descuento_general: item.locales?.descuento_general || 0,
        rubro: item.locales?.rubro,
        rubros: item.locales?.rubros || [],
        config_horarios: item.locales?.config_horarios || {}
      };
    } else {
      if (item.precio < groupedMap[lid].precio_min_categoria) {
        groupedMap[lid].precio_min_categoria = item.precio;
      }
    }
  }
  return enrichLocalesWithMinPrices(Object.values(groupedMap), 'local_id');
}

// ═══════════════════════════════════════════════════
// ADMIN — Locales
// ═══════════════════════════════════════════════════
export async function adminGetLocales() {
  const { data } = await supabase.from('locales')
    .select('id, nombre, email, password, direccion, estado, admin_status, created_at, foto_url, disponible_desde, onesignal_id, plan_id, slug, comision_personalizada_habilitada, comision_personalizada_valor, horario_apertura, horario_cierre, horario_apertura2, horario_cierre2, modo_automatico, dias_apertura')
    .order('created_at', { ascending: false });
  return data || [];
}

export async function adminGetSalesByLocale() {
  const { data, error } = await supabase
    .from('pedidos_locales')
    .select('local_id, total, estado, created_at')
    .eq('estado', 'Entregado');
  
  if (error) throw new Error(error.message);
  
  const salesMap = {};
  data.forEach(sale => {
    if (!salesMap[sale.local_id]) {
      salesMap[sale.local_id] = { total: 0, count: 0 };
    }
    salesMap[sale.local_id].total += Number(sale.total);
    salesMap[sale.local_id].count += 1;
  });
  
  return salesMap;
}

export async function adminUpdateLocalStatus(localId, admin_status) {
  const { error } = await supabase.from('locales').update({ admin_status }).eq('id', localId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function adminUpdateLocalSlug(localId, slug) {
  const { error } = await supabase.from('locales').update({ slug }).eq('id', localId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function adminUpdateLocalAvailability(localId, disponibleDesde) {
  const { error } = await supabase.from('locales').update({ disponible_desde: disponibleDesde }).eq('id', localId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function adminUpdateLocalEstado(localId, estado) {
  const { error } = await supabase.from('locales').update({ estado: estado }).eq('id', localId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function adminUpdateLocalCommission(localId, habilitada, valor) {
  const { error } = await supabase.from('locales')
    .update({ 
      comision_personalizada_habilitada: habilitada, 
      comision_personalizada_valor: valor 
    })
    .eq('id', localId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function adminGetDriverSettlements() {
  const { data, error } = await supabase
    .from('pedidos_general')
    .select('id, created_at, total, precio_envio, metodo_pago, repartidor_id, cobro_repartidor_procesado, repartidores(nombre)')
    .eq('estado', 'Entregado')
    .order('created_at', { ascending: false });
  
  if (error) throw new Error(error.message);
  return data || [];
}

export async function adminUpdateDriverPaymentStatus(pedidoId, status) {
  const { error } = await supabase
    .from('pedidos_general')
    .update({ cobro_repartidor_procesado: status })
    .eq('id', pedidoId);
  
  if (error) throw new Error(error.message);
  return { success: true };
}

// ═══════════════════════════════════════════════════
// ADMIN — Repartidores
// ═══════════════════════════════════════════════════
export async function adminGetRepartidores() {
  const { data } = await supabase.from('repartidores')
    .select('id, nombre, email, telefono, patente, marca_modelo, admin_status, created_at, foto_url, horario_apertura, horario_cierre, dias_apertura, estado, ultima_actividad, onesignal_id, locales_prioridad')
    .order('created_at', { ascending: false });
  return data || [];
}

export async function adminUpdateRepartidorPrioridad(repId, localesIds) {
  const { error } = await supabase.from('repartidores')
    .update({ locales_prioridad: localesIds })
    .eq('id', repId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function adminUpdateRepartidorStatus(repId, admin_status) {
  const { error } = await supabase.from('repartidores').update({ admin_status }).eq('id', repId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function adminUpdateRepartidorEstado(repId, estado) {
  const updateData = { estado: estado };
  if (estado === 'Activo') {
    updateData.ultima_actividad = new Date().toISOString();
    // Also set a default session expiration (e.g. 30 mins) if manually activated by admin
    const validUntil = new Date(Date.now() + 30 * 60000);
    updateData.sesion_vence_en = validUntil.toISOString();
  }
  const { error } = await supabase.from('repartidores').update(updateData).eq('id', repId);
  if (error) throw new Error(error.message);
  return { success: true };
}

// ═══════════════════════════════════════════════════
// ADMIN — Pedidos General
// ═══════════════════════════════════════════════════
export async function adminGetPedidosGeneral() {
  const { data, error } = await supabase.from('pedidos_general')
    .select('*, repartidores:repartidor_id(nombre, telefono)')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function adminGetPedidoDetalle(pedidoId) {
  const { data: pedido, error: errPedido } = await supabase
    .from('pedidos_general')
    .select('*, repartidores:repartidor_id(nombre, telefono)')
    .eq('id', pedidoId)
    .single();
  
  if (errPedido) throw new Error(errPedido.message);

  const { data: items, error: errItems } = await supabase
    .from('pedidos_items')
    .select('*')
    .eq('pedido_id', pedidoId);

  const { data: locales_info, error: errLocales } = await supabase
    .from('pedidos_locales')
    .select('*')
    .eq('pedido_id', pedidoId);

  // Fetch local names manually
  let locales_names = [];
  if (locales_info && locales_info.length > 0) {
    const localIds = [...new Set(locales_info.map(l => l.local_id))];
    const { data: lData } = await supabase.from('locales').select('id, nombre').in('id', localIds);
    locales_names = lData || [];
  }

  return {
    ...pedido,
    items: items || [],
    locales_info: (locales_info || []).map(li => ({
      ...li,
      locales: locales_names.find(ln => ln.id === li.local_id)
    }))
  };
}

// ═══════════════════════════════════════════════════
// ADMIN — Update Pedido Status (Global + Local)
// ═══════════════════════════════════════════════════
export async function adminUpdatePedidoStatus(pedidoId, status) {
  // 0. Seguridad: Si intentamos volver a 'Confirmado' pero el pedido ya es final, abortar.
  if (status === 'Confirmado') {
    const { data: current } = await supabase.from('pedidos_general').select('estado').eq('id', pedidoId).single();
    if (current && ['Entregado', 'Cancelado', 'Rechazado', 'En camino', 'Retirado', 'Listo'].includes(current.estado)) {
      console.log(`[Seguro] Abortando cambio a Confirmado para ${pedidoId} porque ya está en ${current.estado}`);
      return { success: true, skipped: true };
    }
  }

  // 1. Actualizar locales PRIMERO (prioridad para impresión Electron)
  await supabase.from('pedidos_locales').update({ estado: status }).eq('pedido_id', pedidoId);

  // 2. Actualizar estado general
  const { error: errGen } = await supabase.from('pedidos_general').update({ estado: status }).eq('id', pedidoId);
  if (errGen) throw errGen;


  try {
    if (status === 'Rechazado' || status === 'Cancelado') {
      const { data: pg } = await supabase.from('pedidos_general').select('repartidor_id').eq('id', pedidoId).maybeSingle();
      if (pg?.repartidor_id && pg.repartidor_id.length > 20) {
        await supabase.from('repartidores').update({ estado: 'Activo' }).eq('id', pg.repartidor_id);
      }
    }
  } catch (e) { console.warn("Driver release skipped:", e.message); }

  try {
    if (status === 'Entregado') {
      const { data: pg } = await supabase.from('pedidos_general').select('usuario_id').eq('id', pedidoId).maybeSingle();
      if (pg?.usuario_id) {
        await supabase.from('usuarios').update({ ya_realizo_pedidos: true }).eq('id', pg.usuario_id);
        // Acreditar crédito en Wallet si la orden generó ganancia por promo
        try {
          await supabase.rpc('earn_wallet_credit_from_order', { p_order_id: pedidoId });
        } catch (e) {
          console.error("Error acreditando crédito Wallet:", e);
        }
      } else {
        console.warn(`[Wallet] El pedido ${pedidoId} no tiene usuario_id asignado. No se puede acreditar crédito.`);
      }
    }
  } catch (e) { console.warn("Post-delivery tasks skipped:", e.message); }
  
  return { success: true };
}

// ═══════════════════════════════════════════════════
// ADMIN — Gestión de Usuarios
// ═══════════════════════════════════════════════════
export async function adminGetUsuarios() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function adminUpdateUsuarioSeguimiento(userId, field, value) {
  const { error } = await supabase
    .from('usuarios')
    .update({ [field]: value })
    .eq('id', userId);
  if (error) throw error;
}

export async function adminToggleBloqueoUsuario(userId, blockedStatus) {
  const { error } = await supabase
    .from('usuarios')
    .update({ bloqueado: blockedStatus })
    .eq('id', userId);
  if (error) throw error;
  return { success: true };
}

export async function deleteUsuarioAccount(userId) {
  const { error } = await supabase
    .from('usuarios')
    .delete()
    .eq('id', userId);
  if (error) throw error;
  return { success: true };
}


// ══════════════════════════════════════════════════

// ══════════════════════════════════════════════════

export async function adminGetMenuCompleto() {
  const { data } = await supabase
    .from('menu')
    .select('*, locales(nombre, foto_url, disponible_desde)')
    .order('nombre');
  return (data || []).map(i => ({
    id: i.id, nombre: i.nombre, categoria: i.categoria,
    descripcion: i.descripcion, precio: i.precio,
    descuento: i.descuento || 0,
    disponibilidad: i.disponibilidad, imagen_url: i.imagen_url,
    local_id: i.local_id,
    local_nombre: i.locales?.nombre || '', local_logo: i.locales?.foto_url || '',
    local_disponible_desde: i.locales?.disponible_desde || null,
    local_acepta_retiro: i.locales?.acepta_retiro,
    local_acepta_envio: i.locales?.acepta_envio,
  }));
}

// ═══════════════════════════════════════════════════
// ADMIN — Gestión de Cobros (Locales y Repartidores)
// ═══════════════════════════════════════════════════
export async function adminGetGestionCobros(tipo = 'Local') {
  let query = supabase.from('gestion_cobros')
    .select('*, locales(nombre), repartidores(nombre)')
    .order('created_at', { ascending: false });
  
  if (tipo === 'Repartidor') {
    query = query.not('repartidor_id', 'is', null);
  } else {
    query = query.is('repartidor_id', null);
  }

  const { data } = await query;
  return data || [];
}

export async function adminUpdateCobroStatus(id, estado, comprobanteUrl = null) {
  const updateData = { estado };
  if (comprobanteUrl) updateData.comprobante_url = comprobanteUrl;
  
  const { error } = await supabase.from('gestion_cobros').update(updateData).eq('id', id);
  if (error) throw new Error(error.message);

  // If payment is approved ('Pagado'), automatically confirm the associated orders
  if (estado === 'Pagado') {
    const { data: sol } = await supabase.from('gestion_cobros').select('pedidos_incluidos').eq('id', id).single();
    if (sol && sol.pedidos_incluidos) {
      const pids = sol.pedidos_incluidos.split(',').map(s => s.trim()).filter(Boolean);
      for (const pid of pids) {
        // We only transition orders from 'Pendiente de Pago' to 'Confirmado'
        // This avoids touching orders that might already be 'Entregado' (commission settlement flow)
        const { data: order } = await supabase.from('pedidos_general').select('estado').eq('id', pid).single();
        if (order && order.estado === 'Pendiente de Pago') {
          await adminUpdatePedidoStatus(pid, 'Confirmado');
        }
      }
    }
  }

  return { success: true };
}

// ═══════════════════════════════════════════════════
// ADMIN — Tareas
// ═══════════════════════════════════════════════════
export async function getAdminTasks() {
  const { data } = await supabase.from('admin_tasks').select('*').order('created_at', { ascending: false });
  return data || [];
}

export async function getLocalCierreReport(localId, options = {}) {
  const { fecha, inicio, fin, pendientes } = options;
  
  // 1. Configurar query base
  let query = supabase
    .from('pedidos_locales')
    .select('*')
    .eq('local_id', localId)
    .eq('estado', 'Entregado')
    .eq('cierre_caja', false);

  // 2. Aplicar filtros según el modo
  if (pendientes) {
    // Sin filtro de fecha, trae todo lo que no esté cerrado
  } else if (fecha) {
    const startOfDay = `${fecha}T00:00:00Z`;
    const endOfDay = `${fecha}T23:59:59Z`;
    query = query.gte('created_at', startOfDay).lte('created_at', endOfDay);
  } else if (inicio && fin) {
    const start = `${inicio}T00:00:00Z`;
    const end = `${fin}T23:59:59Z`;
    query = query.gte('created_at', start).lte('created_at', end);
  }

  query = query.order('created_at', { ascending: true });

  const { data: pedidosLocales, error: errPL } = await query;



  if (errPL) throw new Error(errPL.message);
  
  if (!pedidosLocales || pedidosLocales.length === 0) {
    return { success: true, subtotal: 0, transferencia: 0, efectivo: 0, comisionEfectivo: 0, pedidos: [], comisiones: 0, neto: 0, comisionPct: 0 };
  }

  // 2. Obtener datos complementarios de pedidos_general (nombre_cliente, nro_operacion, etc.)
  const pedidoIds = pedidosLocales.map(p => p.pedido_id);
  const { data: pedidosGeneral, error: errPG } = await supabase
    .from('pedidos_general')
    .select('id, nombre_cliente, metodo_pago, payment_id, created_at, credito_wallet, descuento_cupon, cupon_id')
    .in('id', pedidoIds);

  if (errPG) throw new Error(errPG.message);

  // Crear mapa para cruce de datos
  const pgMap = new Map(pedidosGeneral?.map(pg => [pg.id, pg]) || []);

  // 2.5 Obtener metadatos de cupones para saber la financiación
  const uniqueCuponIds = [...new Set(pedidosGeneral?.map(pg => pg.cupon_id).filter(Boolean))];
  let promocionesMap = new Map();
  if (uniqueCuponIds.length > 0) {
    const { data: promos } = await supabase
      .from('promociones')
      .select('id, financiacion')
      .in('id', uniqueCuponIds);
    if (promos) {
      promos.forEach(p => promocionesMap.set(p.id, p));
    }
  }

  const planInfo = await getPlanInfo(localId);
  const comisionPct = planInfo.success ? planInfo.comision_actual : 8;

  let subtotal = 0, totalComisiones = 0, transferencia = 0, efectivo = 0, comisionEfectivo = 0, totalCreditoWepi = 0;
  const detalles = pedidosLocales.map(p => {
    const pg = pgMap.get(p.pedido_id) || {};
    let totalPedido = Number(p.total) || 0;
    
    let descuentoCupon = Number(pg.descuento_cupon) || 0;
    let cuponCreditoWepi = 0;
    let cuponDescuentoLocal = 0;

    if (descuentoCupon > 0 && pg.cupon_id) {
      const promo = promocionesMap.get(pg.cupon_id);
      let porcWepi = 100; // Por defecto Wepi asume el 100%
      let porcLocal = 0;
      if (promo && promo.financiacion) {
        try {
          const fin = typeof promo.financiacion === 'string' ? JSON.parse(promo.financiacion) : promo.financiacion;
          if (fin.porcentaje_wepi !== undefined) porcWepi = Number(fin.porcentaje_wepi);
          if (fin.porcentaje_local !== undefined) porcLocal = Number(fin.porcentaje_local);
          if (fin.porc_wepi !== undefined) porcWepi = Number(fin.porc_wepi);
          if (fin.porc_local !== undefined) porcLocal = Number(fin.porc_local);
        } catch (e) {}
      }
      cuponCreditoWepi = descuentoCupon * (porcWepi / 100);
      cuponDescuentoLocal = descuentoCupon * (porcLocal / 100);
    }

    // Si el local financia una parte del cupón, el total bruto del pedido se reduce
    if (cuponDescuentoLocal > 0) {
      totalPedido -= cuponDescuentoLocal;
    }

    subtotal += totalPedido;
    
    // Usar comisión persistente si existe, si no, usar la actual como fallback
    const montoComision = Number(p.comision_monto) || (totalPedido * (comisionPct / 100));
    
    const creditoWalletBase = Number(pg.credito_wallet) || 0;
    const creditoTotalWepi = creditoWalletBase + cuponCreditoWepi;

    totalComisiones += montoComision;
    totalCreditoWepi += creditoTotalWepi;

    const metodo = (p.metodo_pago || pg.metodo_pago || '').toLowerCase();
    if (metodo.includes('efectivo')) {
      efectivo += totalPedido;
      comisionEfectivo += montoComision;
    } else {
      transferencia += totalPedido;
    }

    return {
      id: p.pedido_id,
      cliente: pg.nombre_cliente || 'Desconocido',
      metodo: p.metodo_pago || pg.metodo_pago || 'Desconocido',
      total: totalPedido.toFixed(2),
      credito_usado: creditoTotalWepi.toFixed(2),
      comision_pct: p.comision_pct || comisionPct,
      comision_monto: montoComision.toFixed(2),
      nro_operacion: pg.payment_id || 'N/A',
      hora: pg.created_at || p.created_at,
      cupon_descuento_local: cuponDescuentoLocal.toFixed(2)
    };
  });

  const neto = subtotal - totalComisiones;

  // Asegurar que siempre devolvemos una fecha de referencia para el registro del cierre
  const finalFecha = fecha || inicio || new Date().toISOString().split('T')[0];

  return {
    subtotal: subtotal.toFixed(2),
    transferencia: transferencia.toFixed(2),
    efectivo: efectivo.toFixed(2),
    totalCreditoWepi: totalCreditoWepi.toFixed(2),
    comisionEfectivo: comisionEfectivo.toFixed(2),
    pedidos: detalles,
    comisiones: totalComisiones.toFixed(2),
    neto: neto.toFixed(2),
    comisionPct, 
    fecha: finalFecha,
    success: true
  };
}



export async function createAdminTask(tarea, tipo = 'GENERAL', fecha_finalizacion = null, prioridad = 'Media') {
  const { data, error } = await supabase.from('admin_tasks')
    .insert({ tarea, tipo, fecha_finalizacion, prioridad })
    .select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateAdminTaskStatus(id, estado) {
  const { error } = await supabase.from('admin_tasks').update({ estado }).eq('id', id);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function deleteAdminTask(id) {
  const { error } = await supabase.from('admin_tasks').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { success: true };
}

// ═══════════════════════════════════════════════════
// ADMIN — Emails
// ═══════════════════════════════════════════════════
export async function adminSendBulkEmail({ target, manualEmails, subject, htmlBody }) {
  let emails = [];
  if (target === 'manual' && manualEmails) {
    emails = manualEmails;
  } else {
    // 1. Get all recipients based on target
    let table = 'usuarios';
    if (target === 'locales') table = 'locales';
    if (target === 'repartidores') table = 'repartidores';
    if (target === 'lanzamiento') table = 'lanzamiento';
    
    const { data: recipients } = await supabase.from(table).select('email');
    if (!recipients || recipients.length === 0) return { success: false, error: 'No recipients found' };
    emails = [...new Set(recipients.map(r => r.email.trim()))];
  }
  
  if (emails.length === 0) return { success: false, error: 'No recipients found' };
  
  const results = await Promise.all(emails.map(email => 
    supabase.functions.invoke('send-email', {
      body: { to: email.trim(), subject, htmlBody }
    })
  ));
  
  return { success: true, count: results.length };
}

// ═══════════════════════════════════════════════════
// COBROS — Financial Dashboard
// ═══════════════════════════════════════════════════
export async function getCobrosByLocal(localId) {
  const { data: pedidosLocales } = await supabase
    .from('pedidos_locales')
    .select('id, pedido_id, total, estado, cobro_procesado, metodo_pago')
    .eq('local_id', localId).eq('estado', 'Entregado').eq('cobro_procesado', false);
  
  let totalVentas = 0, totalTransf = 0, totalEfectivo = 0;
  const pedidosIncluidos = [];
  
  const ids = (pedidosLocales || []).map(p => p.pedido_id);
  const { data: items } = await supabase.from('pedidos_items')
    .select('pedido_id, subtotal')
    .eq('local_id', localId)
    .in('pedido_id', ids);
  
  const sumsMap = {};
  (items || []).forEach(i => {
    sumsMap[i.pedido_id] = (sumsMap[i.pedido_id] || 0) + (Number(i.subtotal) || 0);
  });

  for (const p of (pedidosLocales || [])) {
    const sub = sumsMap[p.pedido_id] || 0;
    totalVentas += sub;
    pedidosIncluidos.push(p.pedido_id);
    if ((p.metodo_pago || '').toLowerCase().includes('efectivo')) {
      totalEfectivo += sub;
    } else {
      totalTransf += sub;
    }
  }

  // Get current commission percentage from RPC instead of hardcoding 8%
  let comisionPct = 8;
  const planInfo = await getPlanInfo(localId);
  if (planInfo.success) {
    comisionPct = planInfo.comision_actual;
  }
  
  const comisionFactor = comisionPct / 100;
  const comisionTotal = totalVentas * comisionFactor;
  const comisionSaldada = totalTransf * comisionFactor;
  const comisionPendiente = totalEfectivo * comisionFactor;

  const { data: historial } = await supabase.from('gestion_cobros')
    .select('*').eq('local_id', localId).eq('tipo', 'Solicitud')
    .order('created_at', { ascending: false });

  return {
    success: true, 
    totalVentas: +totalVentas.toFixed(2),
    comisionTotal: +comisionTotal.toFixed(2),
    ventasTransf: +totalTransf.toFixed(2),
    comisionSaldada: +comisionSaldada.toFixed(2),
    ventasEfectivo: +totalEfectivo.toFixed(2),
    comisionPendiente: +comisionPendiente.toFixed(2),
    pedidosIncluidos: pedidosIncluidos.join(', '),
    historial: (historial || []).map(h => ({
      fechaSolicitud: h.fecha_solicitud || h.created_at, 
      montoNeto: +h.monto_neto || 0,
      estado: h.estado || 'Pendiente', 
      idsIncluidos: h.pedidos_incluidos || '',
      comprobanteUrl: h.comprobante_url || ''
    })),
  };
}

export async function solicitarCobro(localId, monto, comprobanteUrl = '') {
  const est = await getCobrosByLocal(localId);
  if (!est.success) return { success: false, error: 'Error recalculando cobros' };
  
  const id = `PAGO-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).substring(2,5).toUpperCase()}`;
  
  const { error } = await supabase.from('gestion_cobros').insert({
    id, 
    tipo: 'Solicitud', 
    local_id: localId, 
    total_ventas: est.totalVentas,
    comision_weep: est.totalComisiones, 
    total_transferencia: est.comisionSaldada, // Reuse this column for saldada
    monto_disponible: est.comisionPendiente,  // Reuse this column for pending
    monto_neto: monto,
    estado: 'Pendiente', 
    fecha_solicitud: new Date().toISOString(),
    pedidos_incluidos: est.pedidosIncluidos,
    comprobante_url: comprobanteUrl
  });

  if (error) return { success: false, error: error.message };

  if (est.pedidosIncluidos) {
    for (const pid of est.pedidosIncluidos.split(',').map(s => s.trim()).filter(Boolean)) {
      await supabase.from('pedidos_locales').update({ cobro_procesado: true })
        .eq('pedido_id', pid).eq('local_id', localId);
    }
  }
  return { success: true, idSolicitud: id, monto, estado: 'Pendiente' };
}

export async function saveLocalCierre(data) {

  const { error } = await supabase.from('cierre_caja').insert({
    local_id: data.localId,
    fecha: data.fecha,
    total_subtotal: data.subtotal,
    total_comisiones: data.comisiones,
    total_neto_local: data.neto,
    total_transferencia: data.transferencia,
    total_efectivo: data.efectivo,
    comision_efectivo: data.comisionEfectivo || 0,
    num_pedidos: (data.pedidos || []).length,
    datos_detallados: data.pedidos
  });


  if (error) throw new Error(error.message);

  const pedidoIds = (data.pedidos || []).map(p => p.id);
  if (pedidoIds.length > 0) {
    await supabase.from('pedidos_locales')
      .update({ cierre_caja: true })
      .in('pedido_id', pedidoIds)
      .eq('local_id', data.localId);
  }
  return { success: true };
}

export async function getAdminCierreReport(fecha, localId = null) {
  let query = supabase.from('pedidos_general')
    .select('*, repartidores:repartidor_id(nombre)')
    .eq('estado', 'Entregado')
    .eq('cierre_caja', false)
    .gte('created_at', `${fecha}T00:00:00Z`)
    .lte('created_at', `${fecha}T23:59:59Z`);

  if (localId && localId !== 'Todos') {
    const { data: pLocales, error: errIds } = await supabase
      .from('pedidos_locales')
      .select('pedido_id')
      .eq('local_id', localId);
    
    if (errIds) throw new Error(errIds.message);
    const pedidoIds = (pLocales || []).map(pl => pl.pedido_id);
    if (pedidoIds.length === 0) return { success: true, pedidos: [], repartidores: [] };
    query = query.in('id', pedidoIds);
  }

  const { data: dataGeneral, error } = await query;
  if (error) throw new Error(error.message);

  const pedidoIds = (dataGeneral || []).map(p => p.id);
  const { data: dataLocales } = await supabase.from('pedidos_locales').select('*').in('pedido_id', pedidoIds);

  const data = (dataGeneral || []).map(p => {
    const pLocales = (dataLocales || []).filter(pl => pl.pedido_id === p.id);
    const totalComision = pLocales.reduce((acc, pl) => acc + (Number(pl.comision_monto) || 0), 0);
    return {
      ...p,
      pedidos_locales: pLocales,
      total_comision: totalComision
    };
  });


  const repartidoresStats = {};
  data.forEach(p => {
    if (p.repartidor_id) {
      if (!repartidoresStats[p.repartidor_id]) {
        repartidoresStats[p.repartidor_id] = {
          id: p.repartidor_id,
          nombre: p.repartidores?.nombre || 'Desconocido',
          entregados: 0,
          monto_envio: 0,
          ids: []
        };
      }
      repartidoresStats[p.repartidor_id].entregados++;
      repartidoresStats[p.repartidor_id].monto_envio += Number(p.precio_envio) || 0;
      repartidoresStats[p.repartidor_id].ids.push(p.id);
    }
  });

  return { success: true, pedidos: data, repartidores: Object.values(repartidoresStats) };
}

export async function saveRepartidorCierre(data) {
  const { error } = await supabase.from('cierre_repartidores').insert({
    fecha_cierre: data.fecha,
    total_saldado: data.totalSaldado,
    total_adeudado: data.totalAdeudado,
    num_pedidos: data.numPedidos,
    detalles_por_repartidor: data.detalles,
    datos_pedidos: data.pedidos
  });
  if (error) throw new Error(error.message);
  const pedidoIds = (data.pedidos || []).map(p => p.id);
  if (pedidoIds.length > 0) {
    await supabase.from('pedidos_general').update({ cierre_caja: true }).in('id', pedidoIds);
  }
  return { success: true };
}

export async function getHistorialCierresRepartidores() {
  const { data, error } = await supabase.from('cierre_repartidores').select('*').order('fecha_cierre', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getHistorialCierresLocales(localId = null) {

  let query = supabase.from('cierre_caja')
    .select('*, locales(nombre)')
    .order('fecha', { ascending: false });

  if (localId && localId !== 'Todos') {
    query = query.eq('local_id', localId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function adminDeleteCierreLocal(cierreId) {
  // 1. Obtener los IDs de pedidos asociados al cierre antes de borrarlo
  const { data: cierre, error: errCierre } = await supabase
    .from('cierre_caja')
    .select('local_id, datos_detallados')
    .eq('id', cierreId)
    .single();
  
  if (errCierre) throw new Error(errCierre.message);

  const pedidoIds = (cierre.datos_detallados || []).map(p => p.id);

  // 2. Reabrir los pedidos en pedidos_locales (poner cierre_caja a false)
  if (pedidoIds.length > 0) {
    const { error: errUpdate } = await supabase
      .from('pedidos_locales')
      .update({ cierre_caja: false })
      .in('pedido_id', pedidoIds)
      .eq('local_id', cierre.local_id);
    
    if (errUpdate) throw new Error(errUpdate.message);
  }

  // 3. Borrar el registro de cierre
  const { error: errDelete } = await supabase
    .from('cierre_caja')
    .delete()
    .eq('id', cierreId);

  if (errDelete) throw new Error(errDelete.message);

  return { success: true };
}

export async function adminGetLocalesDebt() {
  // 1. Obtener suma de comision_efectivo por local desde cierre_caja
  const { data: cierres, error: errC } = await supabase
    .from('cierre_caja')
    .select('local_id, comision_efectivo');

  if (errC) throw new Error(errC.message);

  // 2. Obtener suma de pagos procesados desde gestion_cobros (Solicitudes de pago que el local hizo a Wepi)
  const { data: cobros, error: errCob } = await supabase
    .from('gestion_cobros')
    .select('local_id, monto_neto')
    .eq('tipo', 'Solicitud')
    .eq('estado', 'Pagado');

  if (errCob) throw new Error(errCob.message);

  // 3. Agrupar deudas
  const deudas = {};
  cierres.forEach(c => {
    deudas[c.local_id] = (deudas[c.local_id] || 0) + (Number(c.comision_efectivo) || 0);
  });

  // 4. Restar lo ya pagado
  cobros.forEach(c => {
    deudas[c.local_id] = (deudas[c.local_id] || 0) - (Number(c.monto_neto) || 0);
  });

  return deudas;
}


export async function adminForceDeleteOrders({ status, startDate, endDate } = {}) {
  // 1. Obtener IDs candidatos según estado y fecha
  let query = supabase.from('pedidos_general').select('id, cierre_caja, cobro_repartidor_procesado');
  
  if (status) {
    query = query.eq('estado', status);
  } else {
    query = query.eq('estado', 'Entregado');
  }

  if (startDate) query = query.gte('created_at', `${startDate}T00:00:00Z`);
  if (endDate) query = query.lte('created_at', `${endDate}T23:59:59Z`);

  const { data: candidates, error: errSelect } = await query;
  if (errSelect) throw new Error(errSelect.message);
  if (!candidates || candidates.length === 0) return { success: true, count: 0 };

  const candidateIds = candidates.map(c => c.id);

  // 2. Si es 'Entregado', verificar que REALMENTE estén cerrados en los locales
  // Esto soluciona el problema de desincronización
  let idsToDelete = candidateIds;
  
  if (!status || status === 'Entregado') {
    // Consultar el estado de cierre en pedidos_locales para estos IDs
    const { data: localesStatus } = await supabase
      .from('pedidos_locales')
      .select('pedido_id, cierre_caja')
      .in('pedido_id', candidateIds);
    
    // Un pedido es borrable si:
    // (Está marcado como cerrado en General) O (Todos sus locales asociados están cerrados)
    // Y (El cobro al repartidor está procesado)
    idsToDelete = candidates.filter(c => {
      const orderLocales = localesStatus?.filter(l => l.pedido_id === c.id) || [];
      const allLocalesClosed = orderLocales.length > 0 && orderLocales.every(l => l.cierre_caja === true);
      
      const isClosed = c.cierre_caja === true || allLocalesClosed;
      const isPaid = c.cobro_repartidor_procesado === true;
      
      return isClosed && isPaid;
    }).map(c => c.id);
  }

  if (idsToDelete.length === 0) return { success: true, count: 0 };

  // 3. Eliminación en cascada
  await supabase.from('pedidos_items').delete().in('pedido_id', idsToDelete);
  await supabase.from('pedidos_locales').delete().in('pedido_id', idsToDelete);
  const { error: errDel } = await supabase.from('pedidos_general').delete().in('id', idsToDelete);

  if (errDel) throw new Error(errDel.message);
  return { success: true, count: idsToDelete.length };
}



// ═══════════════════════════════════════════════════
// ANALYTICS — Basados en Cierre de Caja (Inmunes a borrados)
// ═══════════════════════════════════════════════════

export async function getLocalAnalytics(localId, startDate, endDate) {
  const { data, error } = await supabase
    .from('cierre_caja')
    .select('*')
    .eq('local_id', localId)
    .gte('fecha', startDate)
    .lte('fecha', endDate)
    .order('fecha', { ascending: true });

  if (error) throw new Error(error.message);

  const totals = (data || []).reduce((acc, c) => ({
    totalVentas: acc.totalVentas + Number(c.total_subtotal),
    totalComisiones: acc.totalComisiones + Number(c.total_comisiones),
    totalNeto: acc.totalNeto + Number(c.total_neto_local),
    totalPedidos: acc.totalPedidos + (c.num_pedidos || 0),
    totalEfectivo: acc.totalEfectivo + Number(c.total_efectivo),
    totalTransferencia: acc.totalTransferencia + Number(c.total_transferencia)
  }), { totalVentas: 0, totalComisiones: 0, totalNeto: 0, totalPedidos: 0, totalEfectivo: 0, totalTransferencia: 0 });

  return { totals, history: data };
}

export async function getAdminAnalytics(startDate, endDate) {
  const { data, error } = await supabase
    .from('cierre_caja')
    .select('*, locales(nombre)')
    .gte('fecha', startDate)
    .lte('fecha', endDate)
    .order('fecha', { ascending: true });

  if (error) throw new Error(error.message);

  const totals = (data || []).reduce((acc, c) => ({
    totalVentas: acc.totalVentas + Number(c.total_subtotal),
    totalComisiones: acc.totalComisiones + Number(c.total_comisiones),
    totalNetoLocales: acc.totalNetoLocales + Number(c.total_neto_local),
    totalPedidos: acc.totalPedidos + (c.num_pedidos || 0)
  }), { totalVentas: 0, totalComisiones: 0, totalNetoLocales: 0, totalPedidos: 0 });

  return { totals, rawData: data };
}





// ═══════════════════════════════════════════════════
// REPARTIDORES — Advanced
// ═══════════════════════════════════════════════════
export async function assignRepartidor(pedidoId) {
  const { data: activos } = await supabase.from('repartidores')
    .select('id, nombre, email, telefono').eq('estado', 'Activo').eq('admin_status', 'Aceptado');
  if (!activos?.length) return { success: false, message: 'No hay repartidores activos' };
  const elegido = activos[0];
  const { error } = await supabase.from('pedidos_general')
    .update({ repartidor_id: elegido.id })
    .eq('id', pedidoId)
    .is('repartidor_id', null);
  if (error) return { success: false, error: error.message };

  // Marcar como ocupado al ser asignado manualmente o por sistema
  await supabase.from('repartidores').update({ estado: 'Ocupado' }).eq('id', elegido.id);

  return { success: true, repartidor: elegido };
}

export async function getPedidosDisponibles(repartidorId) {
  // 1. Obtener datos del repartidor para ver sus prioridades y capacidad
  const { data: repData, error: repError } = await supabase.from('repartidores')
    .select('locales_prioridad, nivel_repartidor, estado')
    .eq('id', repartidorId)
    .single();

  if (repError) {
    console.error("Error fetching driver data:", repError);
  }

  const misPrioridades = repData?.locales_prioridad || [];
  const nivelRepartidor = repData?.nivel_repartidor || 1; // 1: Moto (cap 2), 2: Bici (cap 1)

  // 2. Contar pedidos actuales del repartidor
  const { data: misPedidosActuales } = await supabase.from('pedidos_general')
    .select('id, local_id, created_at')
    .eq('repartidor_id', repartidorId)
    .in('estado', ['Confirmado', 'Retirado', 'En camino', 'Preparando', 'Listo', 'Aceptado']);

  const pedidosActivosCount = misPedidosActuales?.length || 0;
  const tienePedidoLento = misPedidosActuales?.some(p => p.nivel_rapidez_pedido === 2);
  const localesEnCurso = misPedidosActuales?.map(p => p.local_id) || [];

  // 3. Obtener todos los repartidores que tienen ALGUNA prioridad
  const { data: todosLosPrioritarios } = await supabase.from('repartidores')
    .select('locales_prioridad')
    .not('locales_prioridad', 'eq', '{}');

  const localesConPrioridad = new Set();
  if (todosLosPrioritarios) {
    todosLosPrioritarios.forEach(r => {
      if (r.locales_prioridad) {
        r.locales_prioridad.forEach(lId => localesConPrioridad.add(lId));
      }
    });
  }

  // 4. Obtener Pedidos (Asignados o Disponibles para Broadcast)
  const { data, error } = await supabase.from('pedidos_general')
    .select('id, total, metodo_pago, estado, direccion, observaciones, tipo_entrega, local_id, lat, lng, nombre_cliente, created_at, pago_pendiente_at, precio_envio, repartidor_id, usuario_id, usuarios(telefono)')
    .or(`repartidor_id.eq.${repartidorId},and(repartidor_id.is.null,estado.in.("Pendiente","Buscando Repartidor","Listo","Preparando","Aceptado"),tipo_entrega.eq."Con Envío")`)
    .in('estado', ['Pendiente', 'Buscando Repartidor', 'Pendiente de Pago', 'Confirmado', 'Retirado', 'En camino', 'Listo', 'Preparando', 'Aceptado'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching available orders:", error);
    return { success: false, error: error.message };
  }

  // 5. Obtener configuración de rubros para tiempos de stacking
  const { data: rubrosConfig } = await supabase.from('rubros_config').select('*');

  // 6. Filtrar dinámicamente
  const ahora = Date.now();
  const delayMs = 10000;

  const filtered = (data || []).filter(p => {
    // Si el pedido ya es mío, lo muestro siempre
    if (p.repartidor_id === repartidorId) return true;

    // --- LÓGICA DE CAPACIDAD ---
    // Si soy Bici (Nivel 2) y ya tengo un pedido, no puedo tomar más (a menos que sea del mismo local)
    if (nivelRepartidor === 2 && pedidosActivosCount >= 1 && !localesEnCurso.includes(p.local_id)) return false;
    
    // Si soy Moto (Nivel 1) y ya tengo 2 pedidos, no puedo tomar más (a menos que sea del mismo local)
    if (nivelRepartidor === 1 && pedidosActivosCount >= 2 && !localesEnCurso.includes(p.local_id)) return false;

    // Si tengo un pedido lento (Restaurante), solo puedo tomar rápidos (Nivel 1) adicionales
    if (tienePedidoLento && p.nivel_rapidez_pedido === 2 && !localesEnCurso.includes(p.local_id)) return false;

    // --- LÓGICA DE STACKING (Mismo Local) ---
    if (localesEnCurso.includes(p.local_id)) {
        const config = rubrosConfig?.find(r => r.nivel_rapidez === p.nivel_rapidez_pedido);
        const ventanaMin = config?.ventana_stacking_minutos || 5;
        
        // Buscar el primer pedido que tomé de ese local
        const miPedidoEnLocal = misPedidosActuales.find(mp => mp.local_id === p.local_id);
        if (miPedidoEnLocal) {
            const timeDiffMin = (ahora - new Date(p.created_at).getTime()) / 60000;
            if (timeDiffMin <= ventanaMin) return true; // Permitir stacking inmediato si está en ventana
        }
    }

    // --- LÓGICA DE PRIORIDADES EXISTENTE ---
    if (misPrioridades.includes(p.local_id)) return true;
    if (!localesConPrioridad.has(p.local_id)) return true;
    const createdTime = new Date(p.created_at).getTime();
    return (ahora - createdTime) >= delayMs;
  });

  // 7. Obtener montos locales para los pedidos filtrados (Safe way without joins)
  const filteredIds = filtered.map(p => p.id);
  let totalsMap = {};
  if (filteredIds.length > 0) {
    const { data: totalsData } = await supabase.from('pedidos_locales')
      .select('pedido_id, local_id, total')
      .in('pedido_id', filteredIds);
    
    (totalsData || []).forEach(t => {
      totalsMap[`${t.pedido_id}_${t.local_id}`] = t.total;
    });
  }

  return { 
    success: true, 
    data: filtered.map(p => ({
      id: p.id, 
      cliente: p.usuario_id, 
      nombre_cliente: p.nombre_cliente || 'Cliente', 
      telefono_cliente: p.usuarios?.telefono || '',
      direccion: p.direccion || 'Sin dirección',
      monto: +p.total || 0,
      precio_envio: +p.precio_envio || 0,
      pago: p.metodo_pago || 'Efectivo',
      estado: p.estado, 
      observaciones: p.observaciones || '', 
      envio: p.tipo_entrega || 'envio',
      local_id: p.local_id, 
      lat: p.lat, 
      lng: p.lng,
      pago_pendiente_at: p.pago_pendiente_at,
      created_at: p.created_at,
      nivel_rapidez: p.nivel_rapidez_pedido,
      esBroadcast: !p.repartidor_id,
      esStacking: localesEnCurso.includes(p.local_id),
      monto_local: totalsMap[`${p.id}_${p.local_id}`] || 0
    })) 
  };
}

export async function aceptarPedidoBroadcast(pedidoId, repartidorId) {
  const { data, error } = await supabase.rpc('claim_pedido_broadcast', {
    p_pedido_id: pedidoId,
    p_repartidor_id: repartidorId
  });

  if (error) return { success: false, error: error.message };
  if (!data.success) return { success: false, error: data.error };
  
  return { success: true, mensaje: data.mensaje };
}

export async function getRepartidorHistorial(repartidorId) {
  const { data, error } = await supabase.from('pedidos_general')
    .select('id, direccion, total, metodo_pago, estado, created_at, cobro_repartidor_procesado, precio_envio')
    .eq('repartidor_id', repartidorId)
    .eq('estado', 'Entregado')
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) return { success: false, error: error.message };
  return { success: true, data: data || [] };
}

export async function getRepartidorCierresArchivados(repartidorId) {
  const { data, error } = await supabase.from('cierre_repartidores')
    .select('*')
    .contains('detalles_por_repartidor', [{ id: repartidorId }])
    .order('fecha_cierre', { ascending: false });

  if (error) return { success: false, error: error.message };

  const processed = (data || []).map(c => {
    const stats = (c.detalles_por_repartidor || []).find(r => r.id === repartidorId);
    const orders = (c.datos_pedidos || []).filter(p => p.repartidor_id === repartidorId);
    return {
      id: c.id,
      fecha: c.fecha_cierre,
      monto_total: stats?.monto_envio || 0,
      cantidad_viajes: stats?.entregados || 0,
      pedidos: orders
    };
  });

  return { success: true, data: processed };
}

export async function updateEstadoPedido(pedidoId, nuevoEstado, repartidorId, pinConfirmacion = null) {
  try {
    const ok = ['Confirmado', 'Retirado', 'En camino', 'Entregado'];
    if (!ok.includes(nuevoEstado)) return { success: false, error: `Estado no permitido: ${nuevoEstado}` };
    const { data: ped, error: pedError } = await supabase.from('pedidos_general').select('id, num_confirmacion, metodo_pago, estado')
      .eq('id', pedidoId).eq('repartidor_id', repartidorId).single();
    
    if (pedError || !ped) {
      console.error("Error buscando pedido en updateEstadoPedido:", pedError);
      return { success: false, error: 'Pedido no encontrado o ya no está asignado a ti' };
    }

    if ((nuevoEstado === 'Entregado' || nuevoEstado === 'Retirado') && ped.num_confirmacion && ped.num_confirmacion !== pinConfirmacion) {
      return { success: false, error: 'PIN incorrecto' };
    }

    // Lógica de transición de estado inteligente
    let targetEstado = nuevoEstado;
    if (targetEstado === 'Confirmado') {
      const isCash = (ped.metodo_pago || '').toLowerCase().includes('efectivo');
      const needsPayment = !isCash;
      
      // Si el repartidor acepta un pedido que requiere pago previo, lo pasamos a 'Pendiente de Pago'
      if (needsPayment && (ped.estado === 'Buscando Repartidor' || ped.estado === 'Pendiente')) {
        targetEstado = 'Pendiente de Pago';
      }
    }

    const updateData = { estado: targetEstado };
    if (targetEstado === 'Entregado' && ped.metodo_pago === 'Efectivo') {
      updateData.cobro_repartidor_procesado = true;
    }

    const { error: updateError } = await supabase.from('pedidos_general').update(updateData).eq('id', pedidoId);
    if (updateError) throw new Error(updateError.message);

    if (targetEstado === 'Entregado') {
      // Wallet System: Credit earn logic (20% back)
      try {
        await supabase.rpc('earn_wallet_credit_from_order', { p_order_id: pedidoId });
      } catch (e) { 
        console.error("Wallet earn error:", e); 
      }
    }
    
    if (nuevoEstado === 'Confirmado') {
      // Al aceptar el pedido, verificar capacidad
      const { data: activeCount } = await supabase.from('pedidos_general')
          .select('id', { count: 'exact', head: true })
          .eq('repartidor_id', repartidorId)
          .in('estado', ['Confirmado', 'Retirado', 'En camino', 'Preparando', 'Listo', 'Aceptado']);
      
      const { data: rep } = await supabase.from('repartidores').select('nivel_repartidor').eq('id', repartidorId).single();
      
      const limit = (rep?.nivel_repartidor === 1) ? 2 : 1;
      if ((activeCount || 0) >= limit) {
          await supabase.from('repartidores').update({ estado: 'Ocupado' }).eq('id', repartidorId);
      }
      
      const { data: dRep } = await supabase.from('repartidores').select('pedidos_aceptados_count').eq('id', repartidorId).single();
      if (dRep) {
        await supabase.from('repartidores').update({ 
          pedidos_aceptados_count: (dRep.pedidos_aceptados_count || 0) + 1,
          rachas_ignoradas: 0 
        }).eq('id', repartidorId);
      }

      // ENVIAR EMAIL SOLO CUANDO SE CONFIRMA EL PEDIDO
      try {
        const { data: pg } = await supabase.from('pedidos_general').select('*').eq('id', pedidoId).single();
        const { data: items } = await supabase.from('pedidos_items').select('*').eq('pedido_id', pedidoId);
        const { data: repEmail } = await supabase.from('repartidores').select('email').eq('id', repartidorId).single();

        if (pg && repEmail?.email) {
          await notifyDriverAboutNewOrder(
            pedidoId,
            items || [],
            pg.direccion,
            pg.observaciones,
            pg.total,
            pg.metodo_pago,
            repEmail.email
          );
        }
      } catch (e) {
        console.error('Error enviando email:', e);
      }
    }
    
    if (nuevoEstado === 'Entregado') {
      // Liberar repartidor si no tiene más pedidos
      const { data: activeCountRem } = await supabase.from('pedidos_general')
          .select('id', { count: 'exact', head: true })
          .eq('repartidor_id', repartidorId)
          .in('estado', ['Confirmado', 'Retirado', 'En camino', 'Preparando', 'Listo', 'Aceptado'])
          .neq('id', pedidoId);

      if ((activeCountRem || 0) === 0) {
          await supabase.from('repartidores').update({ estado: 'Activo' }).eq('id', repartidorId);
      }
      
      const { data: dStats } = await supabase.from('repartidores').select('pedidos_hoy').eq('id', repartidorId).single();
      if (dStats) await supabase.from('repartidores').update({ pedidos_hoy: (dStats.pedidos_hoy || 0) + 1 }).eq('id', repartidorId);

      const { data: pgUser } = await supabase.from('pedidos_general').select('usuario_id').eq('id', pedidoId).single();
      if (pgUser?.usuario_id) {
        await supabase.from('usuarios').update({ ya_realizo_pedidos: true }).eq('id', pgUser.usuario_id);
      }
    }
    return { success: true, mensaje: `Estado actualizado a "${nuevoEstado}"` };
  } catch (err) {
    console.error("Error inesperado en updateEstadoPedido:", err);
    return { success: false, error: err.message || 'Error interno de red o servidor' };
  }
}

export async function repartidorGetCobros(repartidorId) {
  // Solo pedidos Entregados, del repartidor, y que no hayan sido procesados para pago
  const { data: pedidos } = await supabase
    .from('pedidos_general')
    .select('id, total, metodo_pago, cobro_repartidor_procesado, precio_envio')
    .eq('repartidor_id', repartidorId)
    .eq('estado', 'Entregado')
    .ilike('metodo_pago', 'transferencia')
    .eq('cobro_repartidor_procesado', false);

  let totalDisponible = 0;
  const idsIncluidos = [];

  if (pedidos) {
    pedidos.forEach(p => {
      // El repartidor gana lo que se cobró de envío en ese pedido
      totalDisponible += Number(p.precio_envio) || 0;
      idsIncluidos.push(p.id);
    });
  }

  const { data: historial } = await supabase
    .from('gestion_cobros')
    .select('*')
    .eq('repartidor_id', repartidorId)
    .order('created_at', { ascending: false });

  return {
    success: true,
    totalDisponible: +totalDisponible.toFixed(2),
    idsIncluidos: idsIncluidos.join(', '),
    historial: (historial || []).map(h => ({
      fechaSolicitud: h.fecha_solicitud || h.created_at,
      montoNeto: +h.monto_neto || 0,
      estado: h.estado || 'Pendiente',
      pedidosIncluidos: h.pedidos_incluidos || '',
      comprobanteUrl: h.comprobante_url || ''
    }))
  };
}

export async function repartidorSolicitarCobro(repartidorId, monto) {
  const est = await repartidorGetCobros(repartidorId);
  if (!est.success) return { success: false, error: 'Error al calcular cobros' };

  const id = `REP-PAGO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

  const { error } = await supabase.from('gestion_cobros').insert({
    id,
    tipo: 'Solicitud-Repartidor',
    repartidor_id: repartidorId,
    total_ventas: est.totalDisponible, // En este caso total_ventas refleja el acumulado de $1800s
    monto_neto: monto,
    estado: 'Pendiente',
    fecha_solicitud: new Date().toISOString(),
    pedidos_incluidos: est.idsIncluidos
  });

  if (error) return { success: false, error: error.message };

  // Marcar pedidos como procesados para el repartidor
  if (est.idsIncluidos) {
    const ids = est.idsIncluidos.split(',').map(s => s.trim()).filter(Boolean);
    for (const pid of ids) {
      await supabase.from('pedidos_general').update({ cobro_repartidor_procesado: true }).eq('id', pid);
    }
  }

  return { success: true, idSolicitud: id };
}

export async function repartidorRechazarPedido(pedidoId, currentDriverId) {
  try {
    // 1. Ejecutar RPC de reasignación
    const { data, error } = await supabase.rpc('reasignar_pedido_repartidor', {
      p_pedido_id: pedidoId,
      p_repartidor_actual_id: currentDriverId
    });

    if (error) throw new Error(error.message);
    if (!data || !data.id) throw new Error('No se pudo reasignar el pedido.');

    return { success: true, nuevoRepartidor: data.nombre };
  } catch (err) {
    console.error('Error in repartidorRechazarPedido:', err);
    return { success: false, error: err.message };
  }
}

export async function getChatMessages(pedidoId) {
  const { data, error } = await supabase
    .from('chat_pedidos')
    .select('*')
    .eq('id_pedido', pedidoId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return { success: true, data: data || [] };
}

export async function sendChatMessage(pedidoId, senderId, message) {
  const { data, error } = await supabase
    .from('chat_pedidos')
    .insert({ id_pedido: pedidoId, sender_id: senderId, message });
  if (error) throw new Error(error.message);
  return { success: true };
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
  // Al intentar pagar con MP, ya marcamos al usuario (si el pago falla no importa, ya tuvo intención de pagar seguro)
  await supabase.from('usuarios').update({ ya_realizo_pedidos: true }).eq('id', userId);

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
    await supabase.from('pedidos_items').insert(localItems.map(i => ({ 
      pedido_id: pedidoId, 
      item_id: i.id, 
      nombre: i.descripcion ? `${i.nombre} (${i.descripcion})` : i.nombre, 
      precio_unitario: i.precio, 
      cantidad: i.cantidad || i.qty || 1, 
      subtotal: i.precio * (i.cantidad || i.qty || 1) 
    })));
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

  // Ensure status transitions to 'Confirmado' in both tables to trigger printer/restaurant dashboard
  try {
    await adminUpdatePedidoStatus(pedidoId, 'Confirmado');
  } catch (e) {
    console.error("Error updating status in markOrderAsPaid:", e);
  }

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
      const { data: localData } = await supabase.from('locales').select('email, nombre, onesignal_id').eq('id', localId).single();
      if (localData && localData.email) {
        let itemsHtml = group.items.map(i => 
          `<tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${i.cantidad || i.qty || 1}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">
              ${i.nombre}
              ${i.descripcion ? `<br/><small style="color: #666; font-style: italic;">${i.descripcion}</small>` : ''}
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">$${Number(i.precio).toLocaleString('es-AR')}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">$${(Number(i.precio) * (i.cantidad || i.qty || 1)).toLocaleString('es-AR')}</td>
          </tr>`
        ).join('');

        const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <div style="text-align: center; margin: 20px 0;">
              <img src="https://pub-9ccf233ac6f348aebf32f1c18a6e9622.r2.dev/wepi-logo.png" alt="Wepi" width="120" style="border-radius:12px;">
            </div>
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
              <a href="https://wepi.com.ar/locales" style="background-color: #9b1913; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                Ir a mis pedidos de locales 🖥️
              </a>
            </div>

            <p style="margin-top: 30px; font-size: 16px; color: #d32f2f; text-align: center; font-weight: bold;">
              ⚠️ IMPORTANTE: Debes ingresar al panel para ACEPTAR o RECHAZAR este pedido.
            </p>

            <p style="margin-top: 15px; font-size: 14px; color: #666; text-align: center;">
              Por favor, revisa el panel de administración de Wepi para preparar el pedido.<br>
              <strong>Wepi Delivery</strong>
            </p>
          </div>
        `;

        // Notificación OneSignal
        if (localData.onesignal_id) {
          sendPushNotification({
            subscriptionIds: [localData.onesignal_id],
            title: '¡Nuevo Pedido! 🛵',
            message: `Has recibido el pedido #${pedidoId}. ¡Entra al panel para aceptarlo!`,
            url: 'https://wepi.com.ar/locales',
            data: { type: 'new_order', pedidoId }
          }).catch(err => console.error("Error enviando push a local:", err));
        }

        await supabase.functions.invoke('send-email', {
          body: {
            to: localData.email,
            subject: `¡Nuevo Pedido #${pedidoId} en Wepi! 🛵`,
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
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">
          ${i.nombre}
          ${i.descripcion ? `<br/><small style="color: #666; font-style: italic;">${i.descripcion}</small>` : ''}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">$${Number(i.precio).toLocaleString('es-AR')}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">$${(Number(i.precio) * (i.cantidad || i.qty || 1)).toLocaleString('es-AR')}</td>
      </tr>`
    ).join('');

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="text-align: center; margin: 20px 0;">
          <img src="https://pub-9ccf233ac6f348aebf32f1c18a6e9622.r2.dev/wepi-logo.png" alt="Wepi" width="120" style="border-radius:12px;">
        </div>
        <h2 style="color: #9b1913;">¡Pedido Confirmado! #${pedidoId}</h2>
        <p>Hola <strong>${nombreCliente}</strong>, hemos recibido tu pedido correctamente.</p>
        
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

        <p style="margin-top: 30px; font-size: 14px; color: #666; text-align: center;">
          Podés seguir el estado de tu pedido desde la sección "Mis Pedidos" en la app.<br>
          <strong>¡Gracias por elegir Wepi Delivery!</strong>
        </p>
      </div>
    `;

    await supabase.functions.invoke('send-email', {
      body: {
        to: emailCliente,
        subject: `Confirmación de Pedido #${pedidoId} - Wepi 🛵`,
        htmlBody
      }
    });
  } catch (error) {
    console.error("Error enviando email al cliente:", error);
  }
}

export async function notifyDriverAboutPaymentInProgress(pedidoId, repartidorId) {
  try {
    const { data: rep } = await supabase
      .from('repartidores')
      .select('OneSignalId')
      .eq('id', repartidorId)
      .single();

    if (rep?.OneSignalId) {
      await sendPushNotification({
        subscriptionIds: [rep.OneSignalId],
        title: '¡Pago en curso! 💳',
        message: `El cliente del pedido #${pedidoId} está completando el pago. Por favor, aguarda un momento.`,
        url: 'https://wepi.com.ar/repartidores',
        data: { type: 'payment_in_progress', pedidoId }
      });
    }
  } catch (err) {
    console.error("Error notifying driver about payment:", err);
  }
}

export async function sendPushNotification({ subscriptionIds, title, message, data, url }) {
  try {
    const { data: res, error } = await supabase.functions.invoke('send-push', {
      body: { subscriptionIds, title, message, data, url }
    });
    if (error) throw error;
    return { success: true, data: res };
  } catch (err) {
    console.error("Error in sendPushNotification:", err);
    return { success: false, error: err.message };
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
          <img src="https://pub-9ccf233ac6f348aebf32f1c18a6e9622.r2.dev/wepi-logo.png" alt="Wepi" width="120" style="border-radius:12px;">
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
          <strong>¡Gracias por ser parte de Wepi!</strong>
        </p>
      </div>
    `;

    await supabase.functions.invoke('send-email', {
      body: {
        to: repartidorEmail,
        subject: `🚚 PEDIDO ASIGNADO #${pedidoId} - Wepi`,
        htmlBody
      }
    });

  } catch (error) {
    console.error("Error enviando email al repartidor:", error);
  }
}
// Función deprecada de limpieza. Ahora la desconexión por inactividad ocurre 
// nativamente en la Base de Datos a través del CRON job `check_inactive_drivers_job`.

// ═══════════════════════════════════════════════════
// NOTIFICACIONES DE ESTADO (Panel Locales)
// ═══════════════════════════════════════════════════

const LOGO_HTML = `
  <div style="text-align: center; margin: 20px 0 30px 0;">
      <img src="https://i.postimg.cc/Sx8C1DWh/2.png"
            alt="Wepi" width="120" style="border-radius:12px;">
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
      <p>¡Gracias por elegir Wepi!</p>
    `;

    await supabase.functions.invoke('send-email', { body: { to, subject, htmlBody } });
    return { success: true };
  } catch (err) {
    console.error('Error in notifyOrderEntregado:', err);
    return { success: false, error: err.message };
  }
}

export async function notifyOrderRechazado(pedido, reason = '') {
  try {
    const to = pedido.emailCliente;
    if (!to) return { success: false, error: 'No hay email del cliente' };

    const subject = `Estado actualizado de tu pedido #${pedido.idPedido}`;
    const htmlBody = `
      ${LOGO_HTML}
      <h2 style="color:#d32f2f; text-align:center;">Pedido Cancelado</h2>
      <p>Hola <strong>${pedido.nombreCliente}</strong>,</p>
      <p>Lamentablemente el local no pudo aceptar tu pedido en esta ocasión.</p>
      ${reason ? `<p><strong>Motivo:</strong> ${reason}</p>` : ''}
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
  const { data } = await supabase.from('locales').select('nombre, direccion, lat, lng').eq('id', localId).single();
  return data;
}

export async function updateLocalCoords(localId, lat, lng) {
  const { error } = await supabase.from('locales').update({ lat, lng }).eq('id', localId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function updatePedidoCoords(pedidoId, lat, lng) {
  const { error } = await supabase.from('pedidos_general').update({ lat, lng }).eq('id', pedidoId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function getMontoLocalPedido(pedidoId, localId) {
  const { data } = await supabase.from('pedidos_locales')
    .select('total')
    .eq('pedido_id', pedidoId)
    .eq('local_id', localId)
    .single();
  return data ? Number(data.total) : 0;
}


// ═══════════════════════════════════════════════════
// BOTÓN DE ARREPENTIMIENTO (Account Deletion)
// ═══════════════════════════════════════════════════

export async function deleteLocalAccount(localId) {

  const { error } = await supabase.from('locales').delete().eq('id', localId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function deleteRepartidorAccount(driverId) {
  const { error } = await supabase.from('repartidores').delete().eq('id', driverId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function adminCleanupInactiveDrivers() {
  // Función desactivada. El sistema ahora usa el CRON nativo de Supabase.
  return { success: true, count: 0 };
}

// ═══════════════════════════════════════════════════
// BANNERS
// ═══════════════════════════════════════════════════
export async function getBanners() {
  const { data } = await supabase.from('banners').select('*').eq('activo', true).order('posicion');
  return data || [];
}

export async function adminGetBanners() {
  const { data } = await supabase.from('banners').select('*').order('posicion');
  return data || [];
}

export async function adminAddBanner({ imagen_url, link, activo, posicion }) {
  const { error } = await supabase.from('banners').insert({ imagen_url, link, activo, posicion });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function adminUpdateBanner(id, updates) {
  const { error } = await supabase.from('banners').update(updates).eq('id', id);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function adminDeleteBanner(id) {
  const { error } = await supabase.from('banners').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function updateMenuItemAvailability(id, disponibilidad) {
  const { error } = await supabase.from('menu').update({ disponibilidad }).eq('id', id);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function updateMenuItemDiscount(id, descuento) {
  const { error } = await supabase.from('menu').update({ descuento }).eq('id', id);
  if (error) throw new Error(error.message);
  return { success: true };
}
// ═══════════════════════════════════════════════════
// CONFIGURATION — Global Settings
// ═══════════════════════════════════════════════════
export async function getConfiguracion() {
  const { data, error } = await supabase
    .from('configuracion')
    .select('*')
    .eq('id', 'global')
    .maybeSingle();
  
  if (error) {
    console.error('Error fetching configuration:', error);
    return { valor_envio: 2000 }; // Default fallback
  }
  
  return data || { valor_envio: 2000 };
}

export async function updateConfiguracion(updates) {
  const { error } = await supabase
    .from('configuracion')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', 'global');
    
  if (error) throw new Error(error.message);
  return { success: true };
}

// ═══════════════════════════════════════════════════
// ACTIVACIÓN POR DEMANDA (NUEVO)
// ═══════════════════════════════════════════════════
export async function getSystemActivation() {
  const { data } = await supabase
    .from('system_activation_status')
    .select('current_state, valor_incentivo, current_score')
    .eq('id', 1)
    .single();
  return data || { current_state: 'IDLE', valor_incentivo: 0 };
}

export async function trackDemandSignal(eventType, sessionId) {
  const weights = { 
    page_view: 1, 
    category_view: 2,
    local_view: 5, 
    item_view: 10, 
    add_to_cart: 25 
  };
  
  const weight = weights[eventType] || 1;
  
  return supabase.from('demand_signals').insert({
    session_id: sessionId,
    event_type: eventType,
    weight: weight
  });
}

// ═══════════════════════════════════════════════════
// GAMIFICACIÓN (NUEVO)
// ═══════════════════════════════════════════════════
export async function getDriverGamificationStats(driverId) {
  const { data, error } = await supabase
    .from('driver_gamification_stats')
    .select('*')
    .eq('driver_id', driverId)
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function getDriverRanking() {
  const { data, error } = await supabase
    .from('view_driver_ranking')
    .select('*');
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function getDriverPointsHistory(driverId) {
  const { data, error } = await supabase
    .from('driver_points_log')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

// ═══════════════════════════════════════════════════
// PLANES Y COMISIONES
// ═══════════════════════════════════════════════════

export async function getPlanInfo(localId) {
    const { data, error } = await supabase.rpc('get_current_commission_info', { p_local_id: localId });
    if (error) {
        console.error("Error fetching plan info:", error);
        return { success: false, error: error.message };
    }
    return { success: true, ...data };
}

export async function getDisponibilidadPlanes() {
    const { data, error } = await supabase.from('planes_config').select('*, planes_niveles(*)').order('precio_mensual', { ascending: true });
    if (error) throw new Error(error.message);
    return data;
}

export async function suscribirAPlan(localId, planId) {
    const { error } = await supabase.from('locales').update({ plan_id: planId }).eq('id', localId);
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function broadcastOrderToDrivers(pedidoId, total, localId = null, precioEnvio = null) {
  try {
    console.log(`⚡ Requesting server-side broadcast for order: ${pedidoId}`);
    
    const { data, error } = await supabase.functions.invoke('send-push', {
      body: {
        broadcastOrderId: pedidoId,
        localId,
        precioEnvio
      }
    });

    if (error) throw new Error(error.message);
    return { success: true, data };
  } catch (err) {
    console.error("Error in broadcastOrderToDrivers:", err);
    return { success: false, error: err.message };
  }
}
export async function notifyDriverAboutPaymentApproved(pedidoId, driverId) {
  try {
    if (!driverId) return;
    
    // Get driver OneSignal ID
    const { data: driver } = await supabase
      .from('repartidores')
      .select('onesignal_id')
      .eq('id', driverId)
      .single();

    if (driver?.onesignal_id) {
      await sendPushNotification({
        subscriptionIds: [driver.onesignal_id],
        title: '✅ ¡Pago Confirmado! 🚀',
        message: `El cliente ya pagó el pedido #${pedidoId.split('-').pop()}. Ya puedes ver los datos y retirar el pedido.`,
        url: 'https://wepi.com.ar/repartidores',
        data: { pedidoId, type: 'payment_confirmed' }
      });
    }
  } catch (err) {
    console.error("Error notifying driver about payment:", err);
  }
}

export async function subscribeToDriverAvailability(onesignalId, userId = null) {
  const { data, error } = await supabase
    .from('clientes_esperando_repartidor')
    .insert([{ onesignal_id: onesignalId, usuario_id: userId }]);
  if (error) throw error;
  return { success: true };
}

// ═══════════════════════════════════════════════════
// CUPONES
// ═══════════════════════════════════════════════════
export async function adminGetCupones() {
  const { data, error } = await supabase.from('cupones').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function adminCreateCupon(cuponData) {
  const { error } = await supabase.from('cupones').insert(cuponData);
  if (error) throw error;
  return { success: true };
}

export async function adminUpdateCupon(id, updates) {
  const { error } = await supabase.from('cupones').update(updates).eq('id', id);
  if (error) throw error;
  return { success: true };
}

export async function adminDeleteCupon(id) {
  const { error } = await supabase.from('cupones').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
}

/**
 * Valida un cupón y retorna sus datos si es válido.
 * @param {string} codigo 
 * @param {number} subtotal - Subtotal del pedido 
 * @param {string} localId - ID del local (opcional)
 */
export async function validateCupon(codigo, subtotal, localId = null) {
  if (!codigo) return { success: false, error: 'Ingresá un código' };
  
  const { data, error } = await supabase
    .from('cupones')
    .select('*')
    .eq('codigo', codigo.toUpperCase().trim())
    .eq('activo', true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { success: false, error: 'Cupón inválido o inexistente' };

  // Validar expiración
  if (data.fecha_expiracion && new Date(data.fecha_expiracion) < new Date()) {
    return { success: false, error: 'Este cupón ha expirado' };
  }

  // Validar monto mínimo
  if (subtotal < (data.minimo_compra || 0)) {
    return { success: false, error: `El monto mínimo para este cupón es $${data.minimo_compra}` };
  }

  // Validar local (si el cupón es específico)
  if (data.local_id && data.local_id !== localId) {
    return { success: false, error: 'Este cupón no es válido para este restaurante' };
  }

  // Validar límite de usos
  if (data.limite_usos !== null && data.usos_actuales >= data.limite_usos) {
    return { success: false, error: 'Este cupón ya ha alcanzado su límite de usos' };
  }

  return { success: true, cupon: data };
}

// ═══════════════════════════════════════════════════
// WALLET SYSTEM - API
// ═══════════════════════════════════════════════════

export async function getUserWalletBalance(userId) {
  if (!userId) return 0;
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('type, amount, expires_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
    
  if (error) {
    console.error("Error fetching wallet balance:", error);
    return 0;
  }
  
  if (!data || data.length === 0) return 0;

  const activeDeposits = [];

  for (const t of data) {
    const amt = Number(t.amount);
    if (t.type === 'earn' || t.type === 'refund' || t.type === 'admin_adjustment') {
      activeDeposits.push({
        amount: amt,
        expires_at: t.expires_at ? new Date(t.expires_at) : null
      });
    } else if (t.type === 'spend' || t.type === 'expire') {
      let remainingSpend = amt;
      for (const dep of activeDeposits) {
        if (remainingSpend <= 0) break;
        if (dep.amount > 0) {
          const deduct = Math.min(dep.amount, remainingSpend);
          dep.amount -= deduct;
          remainingSpend -= deduct;
        }
      }
    }
  }

  const now = new Date();
  const activeBalance = activeDeposits.reduce((sum, dep) => {
    const isExpired = dep.expires_at && dep.expires_at < now;
    return isExpired ? sum : sum + dep.amount;
  }, 0);

  return Math.max(0, activeBalance);
}

export async function getUserWalletBreakdown(userId) {
  if (!userId) return [];
  
  // Obtenemos todas las transacciones para mostrar en el panel de detalle
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error("Error fetching wallet transactions:", error);
    return [];
  }
  
  return data || [];
}

export async function getWalletTransactions(userId) {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function adminGetWalletTransactions() {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('user_id, type, amount, expires_at, created_at')
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

export async function getActiveWalletCampaigns() {
  const { data, error } = await supabase
    .from('wallet_campaigns')
    .select('*')
    .eq('active', true); // Simple version
  
  if (error) throw error;
  return data || [];
}

export async function applyWalletCredit(userId, amount, orderId) {
  const { data, error } = await supabase.rpc('spend_wallet_credit', {
    p_user_id: userId,
    p_amount: amount,
    p_order_id: orderId
  });
  
  if (error) throw error;
  return data;
}

export async function redeemWalletCoupon(userId, couponCode) {
  const { data, error } = await supabase.rpc('redeem_wallet_coupon', {
    p_user_id: userId,
    p_coupon_code: couponCode
  });
  if (error) throw error;
  return data;
}


export async function getAdminWalletStats() {
  const { data: transactions } = await supabase
    .from('wallet_transactions')
    .select('type, amount');

  const stats = {
    totalEarned: 0,
    totalSpent: 0
  };

  transactions?.forEach(t => {
    if (t.type === 'earn') stats.totalEarned += Number(t.amount);
    if (t.type === 'spend') stats.totalSpent += Number(t.amount);
  });

  return { ...stats, balance: stats.totalEarned - stats.totalSpent };
}

export async function adminGetWalletCampaigns() {
  const { data, error } = await supabase
    .from('wallet_campaigns')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ═══════════════════════════════════════════════════
// PROMOCIONES Y DESCUENTOS UNIFICADOS
// ═══════════════════════════════════════════════════

export async function adminGetPromociones() {
  const { data, error } = await supabase
    .from('promociones')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function adminGetMenuCategorias() {
  const { data, error } = await supabase
    .from('menu')
    .select('categoria');
  if (error) throw error;
  const unique = [...new Set((data || []).map(i => i.categoria))].filter(Boolean).sort();
  return unique;
}

export async function getActivePromotions() {
  const { data, error } = await supabase
    .from('promociones')
    .select('*')
    .eq('activo', true)
    .order('prioridad', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function adminSavePromocion(promoData) {
  const { id, created_at, updated_at, ...data } = promoData;
  
  if (id) {
    const { error } = await supabase
      .from('promociones')
      .update(data)
      .eq('id', id);
    if (error) {
      console.error("Error updating promo:", error);
      throw error;
    }
  } else {
    const { error } = await supabase
      .from('promociones')
      .insert(data);
    if (error) {
      console.error("Error inserting promo:", error);
      throw error;
    }
  }
  return { success: true };
}

export async function adminDeletePromocion(id) {
  const { error } = await supabase
    .from('promociones')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return { success: true };
}

export async function adminTogglePromocion(id, activo) {
  const { error } = await supabase
    .from('promociones')
    .update({ activo })
    .eq('id', id);
  if (error) throw error;
  return { success: true };
}

export async function adminUpsertWalletCampaign(campaign) {
  const { data, error } = await supabase
    .from('wallet_campaigns')
    .upsert(campaign)
    .select()
    .single();
  if (error) throw error;
  return data;
}


export async function adminDeleteWalletCampaign(id) {
  const { error } = await supabase
    .from('wallet_campaigns')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return { success: true };
}

// ──────────────────────────────────────────────────
// ADVANCED WALLET CONFIG (PER-LOCAL)
// ──────────────────────────────────────────────────

export async function adminGetWalletConfigs() {
  const { data, error } = await supabase
    .from('wallet_config_locales')
    .select('*')
    .order('local_id', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

export async function adminSaveWalletConfig(config) {
  const { data, error } = await supabase
    .from('wallet_config_locales')
    .upsert(config)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function adminDeleteWalletConfig(id) {
  const { error } = await supabase
    .from('wallet_config_locales')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return { success: true };
}

/**
 * Obtiene la configuración de créditos aplicable a un local específico.
 * Prioriza la del local, de lo contrario la global (null).
 */
export async function getWalletConfigForLocal(localId) {
  const { data, error } = await supabase
    .from('wallet_config_locales')
    .select('*')
    .or(`local_id.eq.${localId},local_id.is.null`)
    .eq('activo', true)
    .order('local_id', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching wallet config for local:", error);
    return null;
  }
  return data;
}

/**
 * Obtiene todas las configuraciones de crédito activas para todos los locales.
 */
export async function getAllWalletConfigs() {
  const { data, error } = await supabase
    .from('wallet_config_locales')
    .select('*')
    .eq('activo', true);
  
  if (error) {
    console.error("Error fetching all wallet configs:", error);
    return [];
  }
  return data || [];
}


// ──────────────────────────────────────────────────
// REPARTIDORES — CALENDARIO DE PAGOS
// ──────────────────────────────────────────────────

export async function adminGetDriverPayments(month, year) {
  // Start and end of the month
  const start = new Date(year, month, 1).toISOString().split('T')[0];
  const end = new Date(year, month + 1, 0).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('repartidores_pagos_calendario')
    .select('*, repartidores(nombre)')
    .gte('fecha', start)
    .lte('fecha', end)
    .order('fecha', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function adminCreateDriverPayment(paymentData) {
  const { data, error } = await supabase
    .from('repartidores_pagos_calendario')
    .insert(paymentData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function adminGetDriverPaymentsAll() {
  const { data, error } = await supabase
    .from('repartidores_pagos_calendario')
    .select('id, repartidor_id, monto, nota, fecha, pedido_ids, created_at, repartidores(nombre)')
    .order('fecha', { ascending: false });

  if (error) throw error;
  return data;
}

export async function adminDeleteDriverPayment(id) {
  const { error } = await supabase
    .from('repartidores_pagos_calendario')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

export async function adminGetDriverPendingSettlements(driverId) {
  // 1. Obtener todos los IDs de pedidos que ya están en el calendario
  const { data: scheduledPayments, error: scheduledError } = await supabase
    .from('repartidores_pagos_calendario')
    .select('pedido_ids')
    .not('pedido_ids', 'is', null);

  if (scheduledError) throw scheduledError;

  // Aplanar todos los IDs de pedidos agendados
  const allScheduledIds = scheduledPayments
    .flatMap(p => p.pedido_ids.split(','))
    .map(id => id.trim())
    .filter(Boolean);

  // 2. Obtener pedidos que NO estén en esa lista
  let query = supabase
    .from('pedidos_general')
    .select('id, created_at, precio_envio, metodo_pago')
    .eq('repartidor_id', driverId)
    .eq('estado', 'Entregado')
    .eq('cobro_repartidor_procesado', false);

  if (allScheduledIds.length > 0) {
    query = query.not('id', 'in', `(${allScheduledIds.join(',')})`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function repartidorGetScheduledPayments(driverId) {
  const { data, error } = await supabase
    .from('repartidores_pagos_calendario')
    .select('fecha, pedido_ids')
    .eq('repartidor_id', driverId);

  if (error) throw error;
  
  // Create a map of orderId -> date
  const dateMap = {};
  data.forEach(p => {
    if (p.pedido_ids) {
      p.pedido_ids.split(',').forEach(id => {
        dateMap[id.trim()] = p.fecha;
      });
    }
  });
  
  return dateMap;
}

// ═══════════════════════════════════════════════════
// RUBROS CONFIG
// ═══════════════════════════════════════════════════
export async function getRubrosConfig() {
  const { data } = await supabase.from('rubros_config').select('*').order('nombre');
  return data || [];
}

export async function updateRubroConfig(id, updates) {
  const { error } = await supabase.from('rubros_config').update(updates).eq('id', id);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function adminGetRepartidoresDetallado() {
  const { data } = await supabase.from('repartidores')
    .select('id, nombre, email, telefono, patente, marca_modelo, estado, admin_status, created_at, tipo_vehiculo, nivel_repartidor, foto_url, onesignal_id, horario_apertura, horario_cierre, dias_apertura, ultima_actividad, locales_prioridad')
    .order('created_at', { ascending: false });
  return data || [];
}

export async function getPedidosDisponiblesProbando(repartidorId) {
  // 1. Obtener datos del repartidor
  const { data: repData, error: repError } = await supabase.from('repartidores')
    .select('locales_prioridad, nivel_repartidor, estado')
    .eq('id', repartidorId)
    .single();

  const misPrioridades = repData?.locales_prioridad || [];
  const nivelRepartidor = repData?.nivel_repartidor || 1; 

  // 2. Contar pedidos actuales
  const { data: misPedidosActuales } = await supabase.from('pedidos_general')
    .select('id, local_id, created_at')
    .eq('repartidor_id', repartidorId)
    .in('estado', ['Confirmado', 'Retirado', 'En camino', 'Preparando', 'Listo', 'Aceptado']);

  const pedidosActivosCount = misPedidosActuales?.length || 0;
  const tienePedidoLento = misPedidosActuales?.some(p => p.nivel_rapidez_pedido === 2);
  const localesEnCurso = misPedidosActuales?.map(p => p.local_id) || [];

  // 3. Obtener Pedidos
  const { data, error } = await supabase.from('pedidos_general')
    .select('id, total, metodo_pago, estado, direccion, observaciones, tipo_entrega, local_id, lat, lng, nombre_cliente, created_at, pago_pendiente_at, precio_envio, repartidor_id, usuario_id, usuarios(telefono)')
    .or(`repartidor_id.eq.${repartidorId},and(repartidor_id.is.null,estado.in.("Pendiente","Buscando Repartidor","Listo","Preparando","Aceptado"),tipo_entrega.eq."Con Envío")`)
    .in('estado', ['Pendiente', 'Buscando Repartidor', 'Pendiente de Pago', 'Confirmado', 'Retirado', 'En camino', 'Listo', 'Preparando', 'Aceptado'])
    .order('created_at', { ascending: false });

  if (error) return { success: false, error: error.message };

  // 4. Filtrar con LÓGICA /PROBANDO
  const filtered = (data || []).filter(p => {
    if (p.repartidor_id === repartidorId) return true;

    // --- REGLAS PROBANDO ---
    // BICICLETA: Solo 1 pedido máximo
    if (nivelRepartidor === 2 && pedidosActivosCount >= 1) return false;

    // MOTO:
    if (nivelRepartidor === 1) {
        // Límite absoluto de 3
        if (pedidosActivosCount >= 3) return false;

        const esMismoLocal = localesEnCurso.includes(p.local_id);

        // Si tiene uno lento de otro local o quiere tomar uno lento de otro local -> No
        if (tienePedidoLento && p.nivel_rapidez_pedido === 2 && !esMismoLocal) return false;

        // Si es mismo local, permitimos hasta 3 (incluyendo 1 lento + 2 rápidos o 3 rápidos)
        if (esMismoLocal) {
            return true; 
        } else {
            // Si es local diferente, mantenemos límite de 1 activo para poder tomar otro (total 2)
            if (pedidosActivosCount >= 2) return false;
        }
    }

    return true; 
  });

  return { 
    success: true, 
    data: filtered.map(p => ({
      id: p.id, 
      cliente: p.usuario_id, 
      nombre_cliente: p.nombre_cliente || 'Cliente', 
      telefono_cliente: p.usuarios?.telefono || '',
      direccion: p.direccion || 'Sin dirección',
      monto: +p.total || 0,
      precio_envio: +p.precio_envio || 0,
      pago: p.metodo_pago || 'Efectivo',
      estado: p.estado, 
      observaciones: p.observaciones || '', 
      envio: p.tipo_entrega || 'envio',
      local_id: p.local_id, 
      lat: p.lat, 
      lng: p.lng,
      pago_pendiente_at: p.pago_pendiente_at,
      created_at: p.created_at,
      nivel_rapidez: p.nivel_rapidez_pedido,
      repartidor_id: p.repartidor_id,
      esStacking: localesEnCurso.includes(p.local_id)
    }))
  };
}

// ═══════════════════════════════════════════════════
// CAMPAÑA MUNDIALISTA - FRONTEND & ADMIN
// ═══════════════════════════════════════════════════

export async function getMundialConfig() {
  const { data, error } = await supabase
    .from('mundial_config')
    .select('*')
    .eq('id', 'global')
    .single();
  if (error) {
    console.error("Error fetching mundial config:", error);
    return null;
  }
  return data;
}

export async function updateMundialConfig(updates) {
  const { error } = await supabase
    .from('mundial_config')
    .update(updates)
    .eq('id', 'global');
  if (error) throw error;
  return { success: true };
}

export async function getMundialPartidos() {
  const { data, error } = await supabase
    .from('mundial_partidos')
    .select('*')
    .order('fecha_partido', { ascending: true });
  if (error) {
    console.error("Error fetching partidos:", error);
    return [];
  }
  return data || [];
}

export async function adminSavePartido(partido) {
  const { id, ...data } = partido;
  if (id) {
    const { error } = await supabase
      .from('mundial_partidos')
      .update(data)
      .eq('id', id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('mundial_partidos')
      .insert(data);
    if (error) throw error;
  }
  return { success: true };
}

export async function adminDeletePartido(partidoId) {
  const { error } = await supabase
    .from('mundial_partidos')
    .delete()
    .eq('id', partidoId);
  if (error) throw error;
  return { success: true };
}

export async function getMundialFiguritas() {
  const { data, error } = await supabase
    .from('mundial_figuritas')
    .select('*')
    .order('numero', { ascending: true });
  if (error) {
    console.error("Error fetching figuritas:", error);
    return [];
  }
  return data || [];
}

export async function adminSaveFigurita(fig) {
  const { id, ...data } = fig;
  const { error } = await supabase
    .from('mundial_figuritas')
    .update(data)
    .eq('id', id);
  if (error) throw error;
  return { success: true };
}

export async function getMundialUsuarioStats(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('mundial_usuario_stats')
    .select('*')
    .eq('usuario_id', userId)
    .maybeSingle();
  
  if (error) {
    console.error("Error fetching mundial user stats:", error);
    return null;
  }
  
  // Si no existen stats, crearlas automáticamente inyectando los premios iniciales de bienvenida
  if (!data) {
    const { data: newStats, error: createError } = await supabase
      .from('mundial_usuario_stats')
      .insert({ 
        usuario_id: userId,
        sobres_disponibles: 2,
        puntos_totales: 100 // Regalo de 100 puntos iniciales de bienvenida
      })
      .select()
      .single();
    if (createError) {
      console.error("Error creating user stats:", createError);
      return null;
    }
    return newStats;
  }
  return data;
}

export async function getMundialPronosticos(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('mundial_pronosticos')
    .select('*')
    .eq('usuario_id', userId);
  if (error) {
    console.error("Error fetching pronosticos:", error);
    return [];
  }
  return data || [];
}

export async function saveMundialPronostico(userId, partidoId, golesA, golesB) {
  const { error } = await supabase
    .from('mundial_pronosticos')
    .upsert({
      usuario_id: userId,
      partido_id: partidoId,
      pronostico_a: golesA,
      pronostico_b: golesB,
      procesado: false
    }, {
      onConflict: 'usuario_id,partido_id'
    });
  if (error) throw error;
  return { success: true };
}

export async function getMundialMisiones(userId) {
  // Cargar misiones de hoy
  const todayStr = new Date().toISOString().split('T')[0];
  const { data: misiones, error: errorMisiones } = await supabase
    .from('mundial_misiones')
    .select('*')
    .eq('fecha', todayStr);
  
  if (errorMisiones) {
    console.error("Error fetching misiones:", errorMisiones);
    return [];
  }

  if (!userId) {
    return misiones?.map(m => ({ ...m, completada: false })) || [];
  }

  // Cargar misiones completadas por el usuario hoy
  const { data: completadas, error: errorCompletadas } = await supabase
    .from('mundial_misiones_usuarios')
    .select('mision_id')
    .eq('usuario_id', userId);

  if (errorCompletadas) {
    console.error("Error fetching completed misiones:", errorCompletadas);
    return misiones?.map(m => ({ ...m, completada: false })) || [];
  }

  const completadasIds = new Set(completadas.map(c => c.mision_id));

  return misiones.map(m => ({
    ...m,
    completada: completadasIds.has(m.id)
  }));
}

export async function getMundialCalendario(userId) {
  const { data: premios, error: errorPremios } = await supabase
    .from('mundial_calendario_premios')
    .select('*')
    .order('dia', { ascending: true });
  
  if (errorPremios) {
    console.error("Error fetching calendario premios:", errorPremios);
    return [];
  }

  if (!userId) {
    return premios.map(p => ({ ...p, reclamado: false }));
  }

  const { data: reclamos, error: errorReclamos } = await supabase
    .from('mundial_calendario_reclamos')
    .select('dia')
    .eq('usuario_id', userId);

  if (errorReclamos) {
    console.error("Error fetching reclamos:", errorReclamos);
    return premios.map(p => ({ ...p, reclamado: false }));
  }

  const reclamosDias = new Set(reclamos.map(r => r.dia));

  return premios.map(p => ({
    ...p,
    reclamado: reclamosDias.has(p.dia)
  }));
}

export async function reclamarDiaCalendario(userId, dia) {
  const { data, error } = await supabase.rpc('fn_reclamar_premio_calendario', {
    p_usuario_id: userId,
    p_dia: dia
  });
  if (error) throw error;
  return data; // Retorna { success, message, tipo, cantidad }
}

export async function abrirSobreMundialista(userId) {
  const { data, error } = await supabase.rpc('fn_abrir_sobre_mundialista', {
    p_usuario_id: userId
  });
  if (error) throw error;
  return data; // Retorna { success, figuritas: [...] }
}

export async function pegarFiguritaMundialista(userId, figuritaId) {
  const { data, error } = await supabase.rpc('fn_pegar_figurita_mundialista', {
    p_usuario_id: userId,
    p_figurita_id: figuritaId
  });
  if (error) throw error;
  return data;
}

export async function reciclarRepetidasMundialista(userId, fig1, fig2, fig3) {
  const { data, error } = await supabase.rpc('fn_reciclar_repetidas_mundialista', {
    p_usuario_id: userId,
    p_fig1: fig1,
    p_fig2: fig2,
    p_fig3: fig3
  });
  if (error) throw error;
  return data;
}

export async function getMundialRanking() {
  const { data, error } = await supabase
    .from('mundial_usuario_stats')
    .select('usuario_id, puntos_totales, racha_actual, usuarios(nombre, email)')
    .order('puntos_totales', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error("Error fetching mundial ranking:", error);
    return [];
  }

  return data.map((d, index) => ({
    posicion: index + 1,
    usuario_id: d.usuario_id,
    nombre: d.usuarios?.nombre || d.usuarios?.email?.split('@')[0] || 'Participante',
    puntos: d.puntos_totales || 0,
    racha: d.racha_actual || 0
  }));
}

export async function completarLoginMision(userId) {
  if (!userId) return { success: false };
  const { data, error } = await supabase.rpc('fn_mision_login_diario', {
    p_usuario_id: userId
  });
  if (error) {
    console.error("Error tracking daily login mission:", error);
    return { success: false };
  }
  return data;
}

export async function canjearCuponMundialista(userId, codigo) {
  if (!userId || !codigo) return { success: false, message: 'Faltan datos para realizar el canje.' };
  const { data, error } = await supabase.rpc('fn_canjear_cupon_mundialista', {
    p_usuario_id: userId,
    p_codigo: codigo.trim().toUpperCase()
  });
  if (error) throw error;
  return data;
}

export async function completarMisionCliente(userId, misionId, puntosPremio, sobresPremio = 0) {
  if (!userId || !misionId) return { success: false };
  
  const { error: insErr } = await supabase
    .from('mundial_misiones_usuarios')
    .insert({ usuario_id: userId, mision_id: misionId });
    
  if (insErr) {
    console.error("Error inserting completed mission:", insErr);
    return { success: false, message: 'Ya has completado esta misión o hubo un error.' };
  }

  const { data: st } = await supabase
    .from('mundial_usuario_stats')
    .select('puntos_totales, sobres_disponibles')
    .eq('usuario_id', userId)
    .maybeSingle();
  
  const newPoints = (st ? (st.puntos_totales || 0) : 0) + (puntosPremio || 0);
  const newSobres = (st ? (st.sobres_disponibles || 0) : 0) + (sobresPremio || 0);
  
  const { error: updErr } = await supabase
    .from('mundial_usuario_stats')
    .upsert({ 
      usuario_id: userId, 
      puntos_totales: newPoints,
      sobres_disponibles: newSobres
    });

  if (updErr) {
    console.error("Error updating user stats:", updErr);
  }

  let msg = `¡Misión completada con éxito!`;
  if (puntosPremio > 0 && sobresPremio > 0) {
    msg += ` +${puntosPremio} puntos y +${sobresPremio} sobres.`;
  } else if (puntosPremio > 0) {
    msg += ` +${puntosPremio} puntos.`;
  } else if (sobresPremio > 0) {
    msg += ` +${sobresPremio} sobres.`;
  }

  return { success: true, message: msg };
}


