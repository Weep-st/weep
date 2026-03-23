function doGet(e) {
  const action = e.parameter.action;
  Logger.log('doGet action: ' + action);
  Logger.log('Parámetros recibidos: ' + JSON.stringify(e.parameter));
  // Acciones existentes (mantengo el orden aproximado que tenías)
  if (action === 'getLocalEstado') {
    const resultado = getLocalEstado(e); // tu función actual
    const jsonString = JSON.stringify(resultado);
    // IMPORTANTE: usamos MimeType.JAVASCRIPT + callback
    const callback = e.parameter.callback || 'callback';
    const output = `${callback}(${jsonString})`;
    return ContentService
      .createTextOutput(output)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }


  // ============================================================================
// NUEVAS ACCIONES PARA LA SECCIÓN "MIS PEDIDOS" DEL CLIENTE
// ============================================================================

/**
 * Devuelve los pedidos en curso e historial del usuario
 * action = getMyOrders
 * Parámetros requeridos: userId
 */
/**
 * Devuelve los pedidos en curso e historial del usuario
 * action = getMyOrders
 * Parámetros requeridos: userId
 */
if (action === 'getMyOrders') {
  const userId = (e.parameter.userId || '').trim();
  if (!userId) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: 'Falta userId' })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const localesSheet  = ss.getSheetByName('Pedidos LOCALES');
  const generalSheet  = ss.getSheetByName('Pedidos GENERAL');
  const itemsSheet    = ss.getSheetByName('Pedidos ITEMS');

  if (!localesSheet || !generalSheet || !itemsSheet) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: 'Faltan hojas de cálculo' })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  // ───────────────────────────────────────────────
  // 1. Cargar datos (solo lo necesario)
  // ───────────────────────────────────────────────
  const localesData  = localesSheet.getDataRange().getValues();
  const generalData  = generalSheet.getDataRange().getValues();
  const itemsData    = itemsSheet.getDataRange().getValues();

  // Índices de columnas (0-based)
  const COL_LOCALES = {
    ID_PEDIDO_LOCAL: 0,     // A
    ID_PEDIDO_GEN:   1,     // B
    ID_LOCAL:        2,     // C
    NOMBRE_LOCAL:    3,     // D
    ESTADO_LOCAL:    4,     // E  ← columna clave
    SUBTOTAL:        5,
    COSTO_ENVIO:     6,
    // ... resto según tu estructura
  };

  const COL_GENERAL = {
    ID_PEDIDO:     0,     // A
    ID_USUARIO:    1,     // B
    FECHA:         2,     // C
    DIRECCION:     3,
    ESTADO:        4,
    TOTAL:         5,
    METODO_PAGO:   6,
    OBSERVACIONES: 7,
    ENVIO:         8,     // 'si' = retiro en local
    REPARTIDOR:    9,
  };

  // ───────────────────────────────────────────────
  // 2. Mapa para evitar duplicados y agrupar por ID PEDIDO
  // ───────────────────────────────────────────────
  const pedidosMap = new Map(); // key: idPedidoGen → objeto completo

  for (let i = 1; i < localesData.length; i++) {
    const row = localesData[i];
    const idPedidoGen = String(row[COL_LOCALES.ID_PEDIDO_GEN] || '').trim();
    if (!idPedidoGen) continue;

    // Ya procesamos este pedido → saltamos (evita duplicados)
    if (pedidosMap.has(idPedidoGen)) continue;

    // Buscar fila en Pedidos GENERAL
    let generalRow = null;
    for (let j = 1; j < generalData.length; j++) {
      if (String(generalData[j][COL_GENERAL.ID_PEDIDO]) === idPedidoGen) {
        generalRow = generalData[j];
        break;
      }
    }

    if (!generalRow) continue;
    if (String(generalRow[COL_GENERAL.ID_USUARIO]) !== userId) continue;

    // ──────────────────────────────
    // Construir objeto base del pedido
    // ──────────────────────────────
    const pedido = {
      idPedido:     idPedidoGen,
      fecha:        generalRow[COL_GENERAL.FECHA] || '',
      nombreLocal:  row[COL_LOCALES.NOMBRE_LOCAL] || 'Local desconocido',
      total:        Number(generalRow[COL_GENERAL.TOTAL]) || 0,
      metodoPago:   generalRow[COL_GENERAL.METODO_PAGO] || '—',
      tipoEntrega:  generalRow[COL_GENERAL.ENVIO] === 'si' ? 'retiro' : 'envío',
      estadoGeneral: generalRow[COL_GENERAL.ESTADO] || 'Pendiente',
      estadoLocal:  (row[COL_LOCALES.ESTADO_LOCAL] || '').trim(),
      itemsResumen: []
    };

    // Items resumen (solo nombre y cantidad para la lista)
    for (let k = 1; k < itemsData.length; k++) {
      if (String(itemsData[k][1]) === idPedidoGen) {   // columna B = ID_PEDIDO
        pedido.itemsResumen.push({
          nombre:   itemsData[k][4] || '—',           // Nombre Producto
          cantidad: Number(itemsData[k][6]) || 1      // Cantidad
        });
      }
    }

    pedidosMap.set(idPedidoGen, pedido);
  }

  // ───────────────────────────────────────────────
  // 3. Clasificar: decisión FINAL basada en columna E
  
const enCurso = [];
const historialEntregados = [];

const estadosEnCurso = ['Pendiente', 'Listo'];  // ← solo estos van a "En curso"

for (const pedido of pedidosMap.values()) {
    const estado = (pedido.estadoLocal || '').trim();

    if (estado === 'Entregado') {
        historialEntregados.push(pedido);
    } else if (estadosEnCurso.includes(estado)) {
        enCurso.push(pedido);
    }
    // Otros estados (Preparando, Retirado, En camino, Rechazado, etc.) → se descartan de ambas listas
}
  // ───────────────────────────────────────────────
  // Respuesta final
  // ───────────────────────────────────────────────
  const respuesta = {
    success: true,
    pedidosEnCurso: enCurso,
    historialEntregados: historialEntregados,   // ← nombre más claro
    debug: {
      userIdBuscado: userId,
      totalPedidosEncontrados: pedidosMap.size,
      enCurso: enCurso.length,
      historialEntregados: historialEntregados.length,
      timestamp: new Date().toISOString()
    }
  };

  return ContentService.createTextOutput(
    JSON.stringify(respuesta)
  ).setMimeType(ContentService.MimeType.JSON);
}


/**
 * Devuelve detalle completo de un pedido específico
 * action = getOrderDetail
 * Parámetros: userId, pedidoId (el ID de Pedidos GENERAL)
 */
if (action === 'getOrderDetail') {
  const userId   = (e.parameter.userId || '').trim();
  const pedidoId = (e.parameter.pedidoId || '').trim();
  const callback = e.parameter.callback || 'callback';

  if (!userId || !pedidoId) {
    return ContentService.createTextOutput(
      callback + '(' + JSON.stringify({ success: false, error: 'Faltan userId o pedidoId' }) + ')'
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const generalSheet  = ss.getSheetByName('Pedidos GENERAL');
  const localesSheet  = ss.getSheetByName('Pedidos LOCALES');
  const itemsSheet    = ss.getSheetByName('Pedidos ITEMS');
  const repartidoresSheet = ss.getSheetByName('Repartidores');

  if (!generalSheet || !localesSheet || !itemsSheet) {
    return ContentService.createTextOutput(
      callback + '(' + JSON.stringify({ success: false, error: 'Faltan hojas' }) + ')'
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  let pedidoGeneral = null;
  const generalData = generalSheet.getDataRange().getValues();
  for (let i = 1; i < generalData.length; i++) {
    if (String(generalData[i][0]) === pedidoId && String(generalData[i][1]) === userId) {
      pedidoGeneral = generalData[i];
      break;
    }
  }

  if (!pedidoGeneral) {
    return ContentService.createTextOutput(
      callback + '(' + JSON.stringify({ success: false, error: 'Pedido no encontrado o no pertenece al usuario' }) + ')'
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  // Datos básicos del pedido general
  const detalle = {
    idPedido: pedidoId,
    fecha: pedidoGeneral[2] || '',
    direccion: pedidoGeneral[3] || 'Retiro en local',
    estadoGeneral: pedidoGeneral[4] || 'Pendiente',
    total: Number(pedidoGeneral[5]) || 0,
    metodoPago: pedidoGeneral[6] || '—',
    observaciones: pedidoGeneral[7] || '',
    tipoEntrega: pedidoGeneral[8] === 'si' ? 'retiro' : 'envio',
    repartidor: null,
    items: [],
    locales: []  // por si hay múltiples locales (aunque normalmente es uno)
  };

  // Buscar repartidor asignado (columna J = índice 9)
  const repartidorId = (pedidoGeneral[9] || '').trim();
  if (repartidorId && repartidoresSheet) {
    const repData = repartidoresSheet.getDataRange().getValues();
    for (let j = 1; j < repData.length; j++) {
      if (String(repData[j][0]).trim() === repartidorId) {
        detalle.repartidor = {
          id: repartidorId,
          nombre: repData[j][1] || '—',
          telefono: repData[j][2] || '—',
          estado: repData[j][7] || '—'   // Col H
        };
        break;
      }
    }
  }

  // Buscar locales relacionados y sus estados
  const localesData = localesSheet.getDataRange().getValues();
  for (let i = 1; i < localesData.length; i++) {
    if (String(localesData[i][1]) === pedidoId) { // Col B = ID_PEDIDO
      detalle.locales.push({
        idPedidoLocal: localesData[i][0],
        localId: localesData[i][2],
        nombreLocal: localesData[i][3] || '—',
        estadoLocal: localesData[i][4] || 'Pendiente'
      });
    }
  }

  // Items del pedido
  const itemsData = itemsSheet.getDataRange().getValues();
  for (let i = 1; i < itemsData.length; i++) {
    if (String(itemsData[i][1]) === pedidoId) { // Col B = ID_PEDIDO
      detalle.items.push({
        nombre: itemsData[i][4] || '—',
        cantidad: Number(itemsData[i][6]) || 1,
        precioUnitario: Number(itemsData[i][5]) || 0,
        totalItem: Number(itemsData[i][7]) || 0,
        variantes: itemsData[i][8] || ''
      });
    }
  }

  return ContentService.createTextOutput(
    callback + '(' + JSON.stringify({ success: true, detalle }) + ')'
  ).setMimeType(ContentService.MimeType.JAVASCRIPT);
}


/**
 * Vuelve a cargar los ítems de un pedido anterior al carrito del usuario
 * action = reOrder
 * Parámetros: userId, pedidoId
 */
if (action === 'reOrder') {
  const userId   = (e.parameter.userId || '').trim();
  const pedidoId = (e.parameter.pedidoId || '').trim();
  const callback = e.parameter.callback || 'callback';

  if (!userId || !pedidoId) {
    return ContentService.createTextOutput(
      callback + '(' + JSON.stringify({ success: false, error: 'Faltan userId o pedidoId' }) + ')'
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const itemsSheet = ss.getSheetByName('Pedidos ITEMS');
  if (!itemsSheet) {
    return ContentService.createTextOutput(
      callback + '(' + JSON.stringify({ success: false, error: 'Hoja Pedidos ITEMS no encontrada' }) + ')'
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  const itemsData = itemsSheet.getDataRange().getValues();
  const items = [];

  for (let i = 1; i < itemsData.length; i++) {
    if (String(itemsData[i][1]) === pedidoId) { // Col B = ID_PEDIDO
      items.push({
        idProducto: itemsData[i][3] || '',
        nombreProducto: itemsData[i][4] || '',
        precioUnitario: Number(itemsData[i][5]) || 0,
        cantidad: Number(itemsData[i][6]) || 1,
        variantes: itemsData[i][8] || ''
      });
    }
  }

  if (items.length === 0) {
    return ContentService.createTextOutput(
      callback + '(' + JSON.stringify({ success: false, error: 'No se encontraron ítems para este pedido' }) + ')'
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(
    callback + '(' + JSON.stringify({ success: true, items }) + ')'
  ).setMimeType(ContentService.MimeType.JAVASCRIPT);
}


/**
 * Registra la calificación de un pedido
 * action = rateOrder
 * Parámetros: userId, pedidoId, calificacion (1–5), comentario (opcional)
 */
if (action === 'rateOrder') {
  const userId      = (e.parameter.userId || '').trim();
  const pedidoId    = (e.parameter.pedidoId || '').trim();
  const calificacion = Number(e.parameter.calificacion) || 0;
  const comentario  = (e.parameter.comentario || '').trim();
  const callback    = e.parameter.callback || 'callback';

  if (!userId || !pedidoId) {
    return ContentService.createTextOutput(
      callback + '(' + JSON.stringify({ success: false, error: 'Faltan userId o pedidoId' }) + ')'
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  if (calificacion < 1 || calificacion > 5) {
    return ContentService.createTextOutput(
      callback + '(' + JSON.stringify({ success: false, error: 'Calificación debe estar entre 1 y 5' }) + ')'
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const localesSheet = ss.getSheetByName('Pedidos LOCALES');

  if (!localesSheet) {
    return ContentService.createTextOutput(
      callback + '(' + JSON.stringify({ success: false, error: 'Hoja Pedidos LOCALES no encontrada' }) + ')'
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  const data = localesSheet.getDataRange().getValues();
  let actualizado = false;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === pedidoId) { // Col B = ID_PEDIDO
      // Suponiendo que columna K (índice 10) es para calificación
      localesSheet.getRange(i + 1, 11).setValue(calificacion);     // K = calificación
      localesSheet.getRange(i + 1, 12).setValue(comentario || ''); // L = comentario (opcional)
      actualizado = true;
      break;
    }
  }

  return ContentService.createTextOutput(
    callback + '(' + JSON.stringify({
      success: actualizado,
      message: actualizado ? 'Calificación registrada' : 'No se encontró el pedido'
    }) + ')'
  ).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

  // ============================================================================
// NUEVAS ACCIONES PARA REPARTIDORES - PEDIDOS DISPONIBLES Y CAMBIO DE ESTADO
// ============================================================================

if (action === 'get_pedidos_disponibles') {
  const repartidorId = (e.parameter.id || '').trim();
  const callback = e.parameter.callback || 'callback';

  if (!repartidorId) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify({success: false, error: 'Falta id'}) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Pedidos GENERAL');
  if (!sheet) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify({success: false, error: 'Hoja Pedidos GENERAL no encontrada'}) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  const data = sheet.getDataRange().getValues();
  const pedidos = [];

  // Índices confirmados por ti
  const COL_ID           = 0;  // A - ID PEDIDO
  const COL_USUARIO      = 1;  // B - USUARIO
  const COL_DIRECCION    = 3;  // D - Dirección
  const COL_TOTAL        = 5;  // F - Total Pedido
  const COL_METODO_PAGO  = 6;  // G - Método de Pago
  const COL_REPARTIDOR   = 9;  // J - Repartidor Asignado

  // Dentro del if (action === 'get_pedidos_disponibles')

const estadosMostrables = ['pendiente', 'confirmado', 'retirado'];

for (let i = 1; i < data.length; i++) {
  const row = data[i];
  const repartidorValor = (row[COL_REPARTIDOR] || '').toString().trim().toLowerCase();
  const estadoValor     = (row[4] || '').toString().trim().toLowerCase(); // columna E

  if (repartidorValor === repartidorId.toLowerCase() && 
      estadosMostrables.includes(estadoValor)) {
    
    pedidos.push({
      id: row[COL_ID] || '—',
      cliente: row[COL_USUARIO] || 'Cliente',
      direccion: row[COL_DIRECCION] || 'Sin dirección',
      monto: Number(row[COL_TOTAL]) || 0,
      pago: row[COL_METODO_PAGO] || 'Efectivo',
      estado: row[4] || 'Pendiente',
      observaciones: row[7] || '',
      envio: row[8] || 'no'
    });
  }
}

// Orden descendente por ID (más nuevo primero)
pedidos.sort((a, b) => Number(b.id) - Number(a.id));

  return ContentService.createTextOutput(
    callback + '(' + JSON.stringify({success: true, data: pedidos}) + ')'
  ).setMimeType(ContentService.MimeType.JAVASCRIPT);
}


if (action === 'update_estado_pedido') {
  const pedidoId     = (e.parameter.pedido_id   || '').trim();
  const nuevoEstado  = (e.parameter.nuevo_estado || '').trim();
  const repartidorId = (e.parameter.repartidor_id || '').trim();
  const callback     = e.parameter.callback || 'callback';

  // Validación básica de parámetros
  if (!pedidoId || !nuevoEstado || !repartidorId) {
    return ContentService.createTextOutput(
      callback + '(' + JSON.stringify({ 
        success: false, 
        error: 'Faltan parámetros requeridos (pedido_id, nuevo_estado, repartidor_id)' 
      }) + ')'
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pedidosSheet = ss.getSheetByName('Pedidos GENERAL');
  
  if (!pedidosSheet) {
    return ContentService.createTextOutput(
      callback + '(' + JSON.stringify({ 
        success: false, 
        error: 'Hoja "Pedidos GENERAL" no encontrada' 
      }) + ')'
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  const data = pedidosSheet.getDataRange().getValues();
  let actualizado = false;
  let filaEncontrada = -1;

  // Índices de columnas (0-based)
  const COL_PEDIDO_ID    = 0;   // Columna A
  const COL_ESTADO       = 4;   // Columna E
  const COL_REPARTIDOR   = 9;   // Columna J

  // Buscar la fila que coincide con pedidoId y repartidorId
  for (let i = 1; i < data.length; i++) {
    const idHoja       = String(data[i][COL_PEDIDO_ID]).trim();
    const repartHoja   = String(data[i][COL_REPARTIDOR]).trim();

    if (idHoja === pedidoId && repartHoja === repartidorId) {
      filaEncontrada = i;
      
      // Estados permitidos (actualizado para incluir "Confirmado")
      const estadosPermitidos = [
        'Confirmado',    // ← Agregado para cuando se acepta el pedido
        'Retirado',
        'En camino',     // opcional, si lo usas después
        'Entregado'
      ];

      if (!estadosPermitidos.includes(nuevoEstado)) {
        return ContentService.createTextOutput(
          callback + '(' + JSON.stringify({ 
            success: false, 
            error: `Estado no permitido: "${nuevoEstado}". Estados válidos: ${estadosPermitidos.join(', ')}`
          }) + ')'
        ).setMimeType(ContentService.MimeType.JAVASCRIPT);
      }

      // Actualizar el estado
      pedidosSheet.getRange(i + 1, COL_ESTADO + 1).setValue(nuevoEstado);
      actualizado = true;
      break;
    }
  }

  // Si se marcó como Entregado → actualizar contador de pedidos hoy del repartidor
  if (actualizado && nuevoEstado === 'Entregado') {
    const repartSheet = ss.getSheetByName('Repartidores');
    if (repartSheet) {
      const repData = repartSheet.getDataRange().getValues();
      const COL_ID_REPARTIDOR = 0;     // Suponiendo ID en columna A
      const COL_PEDIDOS_HOY   = 12;    // Columna M (índice 12 = 0-based)

      for (let j = 1; j < repData.length; j++) {
        if (String(repData[j][COL_ID_REPARTIDOR]).trim() === repartidorId) {
          let pedidosHoy = Number(repData[j][COL_PEDIDOS_HOY]) || 0;
          repartSheet.getRange(j + 1, COL_PEDIDOS_HOY + 1).setValue(pedidosHoy + 1);
          break;
        }
      }
    }
  }

  // Respuesta final
  return ContentService.createTextOutput(
    callback + '(' + JSON.stringify({ 
      success: actualizado,
      mensaje: actualizado 
        ? `Estado actualizado a "${nuevoEstado}" en fila ${filaEncontrada + 1}`
        : `No se encontró pedido #${pedidoId} asignado al repartidor ${repartidorId}`
    }) + ')'
  ).setMimeType(ContentService.MimeType.JAVASCRIPT);
}



  if (e.parameter.action === "addLaunchEmail") {
    return addLaunchEmail(e.parameter.email);
  }
    // 1. Obtener datos actuales para mostrar en el panel de cobros
  if (action === 'getCobrosByLocal') {
    return ContentService
      .createTextOutput(JSON.stringify(getCobrosByLocal(e)))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 2. Registrar una nueva solicitud de cobro
  if (action === 'solicitarCobro') {
    try {
      const resultado = solicitarCobro(e.parameter);
      return ContentService
        .createTextOutput(JSON.stringify(resultado))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      Logger.log('ERROR GRAVE en solicitarCobro: ' + err);
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: err.message || 'Error interno al procesar solicitud de cobro'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'updateLocalEstado') {
    return ContentService.createTextOutput(JSON.stringify(updateLocalEstado(e)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'getMenuByLocalIdColK') {
    return ContentService.createTextOutput(JSON.stringify(getMenuByLocalIdColK(e)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'updateDisponibilidad') {
    return ContentService.createTextOutput(JSON.stringify(updateDisponibilidad(e)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'updateMenuItem') {
  Logger.log('===== updateMenuItem vía GET ejecutado =====');
  Logger.log('Parámetros recibidos: ' + JSON.stringify(e.parameter, null, 2));
 
  try {
    // ────────────────────────────────────────────────
    // 1. Recopilar y limpiar parámetros
    // ────────────────────────────────────────────────
    const itemId = (e.parameter.itemId || '').trim();
    const localId = (e.parameter.localId || '').trim();
    const updateData = {
      itemId,
      localId,
      nombre: (e.parameter.nombre || '').trim() || undefined,
      categoria: (e.parameter.categoria || '').trim() || undefined,
      descripcion: (e.parameter.descripcion || '').trim() || undefined,
      precio: e.parameter.precio ? Number(e.parameter.precio) : undefined,
      disponibilidad: (e.parameter.disponibilidad || '').trim() || undefined,
      tamano_porcion: (e.parameter.tamano_porcion || '').trim() || undefined,
      variantes: (e.parameter.variantes || '').trim() || undefined,
      tiempo_preparacion: (e.parameter.tiempo_preparacion || '').trim() || undefined,
      imagen_url: (e.parameter.imagen_url || e.parameter.imagenUrl || '').trim() || undefined
    };
    // ────────────────────────────────────────────────
    // 2. Validaciones mínimas
    // ────────────────────────────────────────────────
    const errores = [];
    if (!updateData.itemId) errores.push("Falta itemId");
    if (!updateData.localId) errores.push("Falta localId (seguridad)");
    if (Object.keys(updateData).length <= 2) { // solo itemId y localId → nada que actualizar
      errores.push("No se enviaron campos para actualizar");
    }
    if (updateData.precio !== undefined && (isNaN(updateData.precio) || updateData.precio < 0)) {
      errores.push("Precio inválido");
    }
    if (errores.length > 0) {
      Logger.log('Validación fallida en GET updateMenuItem: ' + errores.join(' | '));
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Validación fallida',
          detalles: errores
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    // ────────────────────────────────────────────────
    // 3. Llamar a la función de actualización (la versión segura)
    // ────────────────────────────────────────────────
    const resultado = updateMenuItem(updateData);
    if (!resultado.success) {
      return ContentService
        .createTextOutput(JSON.stringify(resultado))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: 'Plato actualizado correctamente vía GET',
        itemId: itemId,
        camposActualizados: resultado.camposActualizados || 0
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('ERROR GRAVE en updateMenuItem vía GET: ' + err.message);
    Logger.log(err.stack || 'sin stack');
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: 'Error interno al actualizar plato',
        detalles: err.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
  if (action === 'deleteMenuItem') {
    return ContentService.createTextOutput(JSON.stringify(deleteMenuItem(e)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'getFilters') {
    return ContentService.createTextOutput(JSON.stringify(getFilters()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'registerLocal') {
    const result = registerLocal(e.parameter);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'loginLocal') {
    const result = loginLocal(e.parameter);
    const callback = e.parameter.callback || 'callback';
    const jsonString = JSON.stringify(result);
    const responseText = `${callback}(${jsonString})`;
    return ContentService.createTextOutput(responseText)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  if (action === 'getPerfilLocal') {
    return ContentService.createTextOutput(JSON.stringify(getPerfilLocal(e)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'updatePerfilLocal') {
  Logger.log('===== updatePerfilLocal vía GET ejecutado =====');
  Logger.log('Parámetros recibidos: ' + JSON.stringify(e.parameter, null, 2));
  try {
    // ────────────────────────────────────────────────
    // 1. Recopilar y limpiar TODOS los parámetros
    // ────────────────────────────────────────────────
    const updateData = {
      localId: (e.parameter.localId || e.parameter.local_id || '').trim(),
      nombre: (e.parameter.nombre || '').trim() || undefined,
      email: (e.parameter.email || '').trim().toLowerCase() || undefined,
      password: (e.parameter.password || '').trim() || undefined,
      foto_url: (e.parameter.foto_url || e.parameter.fotoUrl || '').trim() || undefined,
      direccion: (e.parameter.direccion || e.parameter.address || '').trim() || undefined,
      // ── CAMPOS NUEVOS PARA HORARIOS ──
      horario_apertura: (e.parameter.horario_apertura || '').trim() || undefined,
      horario_cierre: (e.parameter.horario_cierre || '').trim() || undefined,
      modo_automatico: (e.parameter.modo_automatico || '').trim() || undefined
    };
    // ────────────────────────────────────────────────
    // 2. Validaciones mínimas
    // ────────────────────────────────────────────────
    const errores = [];
    if (!updateData.localId) {
      errores.push("Falta localId (obligatorio para identificar el local)");
    }
    // Al menos UN campo para actualizar (excepto localId)
    const camposEnviados = [
      updateData.nombre,
      updateData.email,
      updateData.password,
      updateData.foto_url,
      updateData.direccion,
      updateData.horario_apertura,
      updateData.horario_cierre,
      updateData.modo_automatico
    ].filter(v => v !== undefined && v !== '');
    if (camposEnviados.length === 0) {
      errores.push("No se enviaron campos para actualizar");
    }
    // Validaciones específicas de campos existentes
    if (updateData.email && !updateData.email.includes('@')) {
      errores.push("Formato de email inválido");
    }
    if (updateData.password && updateData.password.length < 6) {
      errores.push("La contraseña debe tener al menos 6 caracteres");
    }
    // ── Validaciones para horarios ──
    if (updateData.horario_apertura !== undefined) {
      const val = updateData.horario_apertura;
      if (!/^\d{2}:\d{2}$/.test(val)) {
        errores.push("Formato de horario_apertura inválido → debe ser HH:MM (ej: 09:00)");
      } else {
        const [h, m] = val.split(':').map(Number);
        if (h < 0 || h > 23 || m < 0 || m > 59) {
          errores.push("hora_apertura fuera de rango (00:00 - 23:59)");
        }
      }
    }
    if (updateData.horario_cierre !== undefined) {
      const val = updateData.horario_cierre;
      if (!/^\d{2}:\d{2}$/.test(val)) {
        errores.push("Formato de horario_cierre inválido → debe ser HH:MM (ej: 23:00)");
      } else {
        const [h, m] = val.split(':').map(Number);
        if (h < 0 || h > 23 || m < 0 || m > 59) {
          errores.push("hora_cierre fuera de rango (00:00 - 23:59)");
        }
      }
    }
    // modo_automatico: normalizamos a 'Sí' o 'No'
    if (updateData.modo_automatico !== undefined) {
      const val = String(updateData.modo_automatico).trim().toLowerCase();
      if (!['sí', 'si', 'yes', 's', 'true', '1', 'no', 'n', 'false', '0'].includes(val)) {
        errores.push("modo_automatico inválido (debe ser Sí/No o equivalente)");
      }
      // Normalizamos el valor antes de pasarlo a la función
      updateData.modo_automatico = ['sí', 'si', 'yes', 's', 'true', '1'].includes(val) ? 'Sí' : 'No';
    }
    if (errores.length > 0) {
      Logger.log('Validación fallida en updatePerfilLocal: ' + errores.join(' | '));
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Validación fallida',
          detalles: errores
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    // ────────────────────────────────────────────────
    // 3. Llamar a la función de actualización
    // ────────────────────────────────────────────────
    const resultado = updatePerfilLocal(updateData);
    if (!resultado.success) {
      return ContentService
        .createTextOutput(JSON.stringify(resultado))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: 'Perfil del local (incluyendo horarios) actualizado correctamente vía GET',
        localId: updateData.localId,
        camposActualizados: resultado.camposActualizados || 0
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('ERROR GRAVE en updatePerfilLocal vía GET: ' + err.message);
    Logger.log(err.stack || 'sin stack');
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: 'Error interno al actualizar perfil del local',
        detalles: err.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
  if (action === 'getMenuItemById') {
    return ContentService.createTextOutput(JSON.stringify(getMenuItemById(e)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'getMenus') {
    return ContentService.createTextOutput(JSON.stringify(getMenus(e.parameter.type, e.parameter.local)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'search') {
    const query = e.parameter.query || '';
    const results = searchMenusAndLocals(query);
    return ContentService.createTextOutput(JSON.stringify({ menus: results }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'getPedidosLocalesByLocal') {
    return ContentService.createTextOutput(JSON.stringify(getPedidosLocalesByLocal(e)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'getItemsByPedidoLocal') {
    return ContentService.createTextOutput(JSON.stringify(getItemsByPedidoLocal(e)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'getPedidoGeneral') {
    return ContentService.createTextOutput(JSON.stringify(getPedidoGeneral(e)))
      .setMimeType(ContentService.MimeType.JSON);
  }
    if (action === 'updateEstadoLocalOrder') {
    try {
      const idPedidoLocal = e.parameter.idPedidoLocal;
      const nuevoEstado = e.parameter.nuevoEstado;
      if (!idPedidoLocal || !nuevoEstado) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: 'Faltan parámetros: idPedidoLocal o nuevoEstado'
        })).setMimeType(ContentService.MimeType.JSON);
      }
      Logger.log('doGet → updateEstadoLocalOrder llamado');
      Logger.log(' idPedidoLocal: ' + idPedidoLocal);
      Logger.log(' nuevoEstado: ' + nuevoEstado);
      updateEstadoLocal(idPedidoLocal, nuevoEstado);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Estado actualizado correctamente'
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      Logger.log('ERROR en doGet updateEstadoLocalOrder: ' + err.message);
      Logger.log(err.stack || 'sin stack');
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Error interno: ' + err.message
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
// Dentro de doGet, después de updateEstadoLocalOrder por ejemplo
if (action === 'enviarNotificacionEmail') {
  try {
    const toEmail = e.parameter.toEmail;
    const subject = e.parameter.subject;
    const htmlBody = e.parameter.htmlBody;
    Logger.log('===== NOTIFICACIÓN EMAIL SOLICITADA =====');
    Logger.log('To: ' + toEmail);
    Logger.log('Asunto: ' + subject);
    Logger.log('Body (primeros 200 chars): ' + (htmlBody || '').substring(0, 200));
    if (!toEmail || !subject || !htmlBody) {
      Logger.log('Faltan parámetros para email');
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Faltan toEmail, subject o htmlBody'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    MailApp.sendEmail({
      to: toEmail,
      subject: subject,
      htmlBody: htmlBody,
      name: "Weep",
      replyTo: "weep.notificaciones@gmail.com"
    });
    Logger.log('EMAIL ENVIADO EXITOSAMENTE a: ' + toEmail);
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('ERROR AL ENVIAR EMAIL: ' + err.message);
    Logger.log('Stack: ' + (err.stack || 'sin stack'));
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Error enviando email: ' + err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
  if (action === 'getAllMenus') {
  return ContentService.createTextOutput(JSON.stringify({menus: getMenus(null, null)}))
    .setMimeType(ContentService.MimeType.JSON);
}
  if (action === 'getLocalesByCategoria') {
  const categoria = e.parameter.type;
  if (!categoria || categoria.trim() === '') {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Falta el parámetro 'type' (categoría)"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  const resultado = getLocalesConPrecioMinimoPorCategoria(categoria.trim());
  return ContentService.createTextOutput(JSON.stringify(resultado))
    .setMimeType(ContentService.MimeType.JSON);
}
if (action === 'addMenuItem') {
  Logger.log('===== addMenuItem vía GET ejecutado =====');
  Logger.log('Parámetros completos: ' + JSON.stringify(e.parameter, null, 2));
  try {
    const itemData = {
      localId: (e.parameter.localId || '').trim(),
      nombre: (e.parameter.nombre || '').trim(),
      categoria: (e.parameter.categoria || '').trim(),
      descripcion: (e.parameter.descripcion || '').trim(),
      precio: Number(e.parameter.precio) || 0,
      disponibilidad: (e.parameter.disponibilidad || 'Sí').trim(),
      tamano_porcion: (e.parameter.tamano_porcion || '').trim(),
      variantes: (e.parameter.variantes || '').trim(),
      tiempo_preparacion: (e.parameter.tiempo_preparacion || '').trim(),
      imagen_url: (e.parameter.imagen_url || '').trim()
    };
    // Validaciones rápidas
    if (!itemData.localId || !itemData.nombre || !itemData.categoria || itemData.precio <= 0) {
      Logger.log('Validación fallida en GET addMenuItem');
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Faltan datos obligatorios'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    const result = addMenuItem(itemData);
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      itemId: result.itemId,
      message: 'Plato agregado vía GET'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('ERROR en addMenuItem vía GET: ' + err.message);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
if (action === "checkActiveRepartidores") {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName("Repartidores");
       
        if (!sheet) {
            return ContentService.createTextOutput(
                JSON.stringify({ hasActive: false })
            ).setMimeType(ContentService.MimeType.JSON);
        }
        const data = sheet.getDataRange().getValues();
        // Columna H → índice 7 (0 = A, 1 = B, ..., 7 = H)
        const hasActive = data.some(row => {
            const estado = (row[7] || "").toString().trim().toLowerCase();
            return estado === "activo";
        });
        return ContentService.createTextOutput(
            JSON.stringify({ hasActive: hasActive })
        ).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        console.error(err);
        return ContentService.createTextOutput(
            JSON.stringify({ hasActive: false })
        ).setMimeType(ContentService.MimeType.JSON);
    }
}
if (action === "assignRepartidorOnly") {
  try {
    const idPedido = e.parameter.idPedido;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const repartSheet = ss.getSheetByName("Repartidores");
    const pedidosSheet = ss.getSheetByName("Pedidos GENERAL");
    if (!repartSheet || !pedidosSheet) {
      return ContentService.createTextOutput(JSON.stringify({success: false, error: "Faltan hojas"})).setMimeType(ContentService.MimeType.JSON);
    }
    // Buscar repartidores activos (columna H = índice 7)
    const repartData = repartSheet.getDataRange().getValues();
    let candidatos = [];
    for (let i = 1; i < repartData.length; i++) {
      if ((repartData[i][7] || "").toString().trim().toLowerCase() === "activo") {
        candidatos.push({
          id: repartData[i][0] || "",
          nombre: repartData[i][1] || "Sin nombre",
          email: repartData[i][3] || ""
        });
      }
    }
    if (candidatos.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({success: false, message: "No hay repartidores activos"})).setMimeType(ContentService.MimeType.JSON);
    }
    // Elegir uno (puedes mejorar con round-robin después)
    const elegido = candidatos[0];
    // Escribir ID en columna J (índice 10)
    const pedidosData = pedidosSheet.getDataRange().getValues();
    let filaPedido = -1;
    for (let i = 1; i < pedidosData.length; i++) {
      if (String(pedidosData[i][0]) === String(idPedido)) {
        filaPedido = i + 1;
        break;
      }
    }
    if (filaPedido !== -1) {
      pedidosSheet.getRange(filaPedido, 10).setValue(elegido.id);
    }
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      repartidor: {
        id: elegido.id,
        nombre: elegido.nombre,
        email: elegido.email
      }
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log(err);
    return ContentService.createTextOutput(JSON.stringify({success: false, error: err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}
if (action === "getLocalInfoForDelivery") {
  try {
    const localId = e.parameter.localId;
    if (!localId) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: "Falta localId" })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const localesSheet = ss.getSheetByName("Locales"); // Asegúrate que el nombre sea exacto
    if (!localesSheet) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: "Hoja Locales no encontrada" })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    const data = localesSheet.getDataRange().getValues();
    let direccion = "—";
    let nombreLocal = "Local desconocido";
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(localId)) { // columna A = ID (ajusta si es distinta)
        direccion = data[i][6] || "—"; // columna G → índice 6 (A=0, B=1, ..., G=6)
        nombreLocal = data[i][1] || "—"; // columna B = nombre (opcional, por si querés mostrarlo)
        break;
      }
    }
    return ContentService.createTextOutput(
      JSON.stringify({
        success: true,
        direccion: direccion,
        nombreLocal: nombreLocal
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log(err);
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
if (action === "getLocalAddress") {
  try {
    const localId = e.parameter.localId;
    if (!localId) {
      return ContentService.createTextOutput(JSON.stringify({success: false, error: "Falta localId"})).setMimeType(ContentService.MimeType.JSON);
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const localesSheet = ss.getSheetByName("Locales"); // ← nombre de tu hoja de locales
    if (!localesSheet) {
      return ContentService.createTextOutput(JSON.stringify({success: false, error: "Hoja Locales no encontrada"})).setMimeType(ContentService.MimeType.JSON);
    }
    const data = localesSheet.getDataRange().getValues();
    let direccion = "—";
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(localId)) { // columna A = ID local
        direccion = data[i][6] || "—"; // columna G → índice 6 (A=0, B=1, ..., G=6)
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      direccion: direccion
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log(err);
    return ContentService.createTextOutput(JSON.stringify({success: false, error: err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}
if (action === "getUserName") {
  try {
    const userId = e.parameter.userId;
    if (!userId) {
      return ContentService.createTextOutput(JSON.stringify({success: false, error: "Falta userId"})).setMimeType(ContentService.MimeType.JSON);
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const usuariosSheet = ss.getSheetByName("Usuarios");
    if (!usuariosSheet) {
      return ContentService.createTextOutput(JSON.stringify({success: false, error: "Hoja Usuarios no encontrada"})).setMimeType(ContentService.MimeType.JSON);
    }
    const data = usuariosSheet.getDataRange().getValues();
    let nombre = "Cliente";
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(userId)) { // columna A = ID usuario
        nombre = data[i][1] || "Cliente"; // columna B = Nombre (índice 1)
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      nombre: nombre
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log(err);
    return ContentService.createTextOutput(JSON.stringify({success: false, error: err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}
  // ==================== USUARIOS ====================
if (action === 'register') {
  Logger.log('Registro vía GET - Parámetros recibidos: ' + JSON.stringify(e.parameter));
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Usuarios");
    if (!sheet) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, message: "No se encontró la hoja 'Usuarios'" })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    // ── Obtener parámetros ────────────────────────────────────────
    var nombre = (e.parameter.nombre || "").trim();
    var email = (e.parameter.email || "").trim().toLowerCase();
    var password = (e.parameter.password || "").trim();
    var direccion = (e.parameter.direccion || "").trim();
    var telefono = (e.parameter.telefono || "").trim(); // viene con +54 / +55 incluido
    // ── Validaciones básicas ──────────────────────────────────────
    if (!nombre) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, message: "El nombre es obligatorio" })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    if (!email || !email.includes("@")) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, message: "Email inválido o faltante" })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    if (!password || password.length < 6) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, message: "La contraseña debe tener al menos 6 caracteres" })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    if (!telefono) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, message: "El teléfono es obligatorio" })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    // ── Verificar duplicados ──────────────────────────────────────
    var data = sheet.getDataRange().getValues();
    // Email ya existe? (columna C → índice 2)
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][2]).toLowerCase() === email) {
        return ContentService.createTextOutput(
          JSON.stringify({ success: false, message: "El email ya está registrado" })
        ).setMimeType(ContentService.MimeType.JSON);
      }
    }
    // Teléfono ya existe? (columna F → índice 5)
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][5]).trim() === telefono) {
        return ContentService.createTextOutput(
          JSON.stringify({ success: false, message: "El teléfono ya está registrado" })
        ).setMimeType(ContentService.MimeType.JSON);
      }
    }
    // ── Generar ID y fecha ────────────────────────────────────────
    var userId = Utilities.getUuid();
    var fechaRegistro = new Date();
    // ── Guardar en el orden EXACTO de las columnas ────────────────
    sheet.appendRow([
      userId, // A → ID
      nombre, // B → Nombre
      email, // C → Email
      password, // D → Contraseña ← ¡ATENCIÓN! guardar en plano NO es seguro
      direccion, // E → Dirección
      telefono // F → Teléfono ← con +54 o +55 incluido
    ]);
    // Respuesta exitosa
    return ContentService.createTextOutput(
      JSON.stringify({
        success: true,
        userId: userId,
        message: "Usuario registrado correctamente"
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log("Error en registro: " + error);
    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        message: "Error interno al registrar: " + (error.message || "desconocido")
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
  if (action === 'login') {
    Logger.log('Login vía GET');
    const result = loginUser(e.parameter);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // ==================== NUEVAS ACCIONES PARA USUARIOS ====================
  if (action === 'updateProfile') {
    return ContentService.createTextOutput(JSON.stringify(updateUserProfile(e.parameter)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'updateAddress') {
    return ContentService.createTextOutput(JSON.stringify(updateUserAddress(e.parameter)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // ==================== FAVORITOS ====================
  if (action === 'addFavorite') {
    return ContentService.createTextOutput(JSON.stringify(addFavorite(e.parameter)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'removeFavorite') {
    return ContentService.createTextOutput(JSON.stringify(removeFavorite(e.parameter)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'getFavorites') {
    const userId = e.parameter.userId;
    if (!userId) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Falta userId" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify(getFavorites(userId)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // ==================== NUEVO: CREAR PEDIDO VÍA GET (para efectivo y MP) ====================
  if (action === 'createOrder' || action === 'createPaidOrder') {
    try {
      const orderData = {
        userId: e.parameter.userId || 'USER1',
        fecha: e.parameter.fecha,
        direccion: e.parameter.direccion,
        metodoPago: e.parameter.metodoPago,
        observaciones: e.parameter.observaciones || '',
        cart: JSON.parse(decodeURIComponent(e.parameter.cart || '[]')),
        envioGratis: e.parameter.envioGratis === 'true' || e.parameter.envioGratis === 'si',
        tipoEntrega: e.parameter.tipoEntrega || 'envio'
      };
      Logger.log('Creando pedido vía GET - Acción: ' + action);
      Logger.log('UserId: ' + orderData.userId);
      Logger.log('Cart items recibidos: ' + (orderData.cart ? orderData.cart.length : 0));
      if (!orderData.cart || orderData.cart.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: 'Carrito vacío o no recibido'
        })).setMimeType(ContentService.MimeType.JSON);
      }
      const idPedido = createOrder(
        orderData.userId,
        orderData.fecha,
        orderData.direccion,
        orderData.metodoPago,
        orderData.observaciones,
        orderData.cart,
        orderData.envioGratis
      );
      // Opcional: si es pago con Mercado Pago, marcar como pagado
      if (action === 'createPaidOrder') {
        // Aquí puedes agregar lógica extra si quieres (ej: cambiar estado)
        Logger.log('Pedido creado y marcado como pagado: ' + idPedido);
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        idPedido: idPedido,
        message: 'Pedido creado exitosamente'
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      Logger.log('ERROR en createOrder vía GET: ' + err.message);
      Logger.log('Stack: ' + err.stack);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Error al crear pedido: ' + err.message
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  // Acciones nuevas de repartidores (consistentes con locales)
  if (action === 'repartidor_register') {
    const result = repartidor_register(e.parameter);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'repartidor_login') {
    const result = repartidor_login(e.parameter);
    const callback = e.parameter.callback || 'callback';
    const jsonString = JSON.stringify(result);
    const responseText = `${callback}(${jsonString})`;
    return ContentService.createTextOutput(responseText)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  if (action === 'repartidor_getDatos') {
    return ContentService.createTextOutput(JSON.stringify(repartidor_getDatos(e.parameter)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'repartidor_actualizarEstado') {
    return ContentService.createTextOutput(JSON.stringify(repartidor_actualizarEstado(e.parameter)))
      .setMimeType(ContentService.MimeType.JSON);
  }
 
  // Respuesta por defecto
  return ContentService.createTextOutput(JSON.stringify({
    error: 'Acción no válida',
    actionRecibida: action || 'sin acción'
  })).setMimeType(ContentService.MimeType.JSON);
}
// ======================================================================
// FUNCIONES AUXILIARES PARA FAVORITOS
// ======================================================================
/**
 * Agrega un plato a favoritos
 */
function addFavorite(params) {
  try {
    const userId = params.userId;
    const menuId = params.menuId;
    if (!userId || !menuId) {
      return { success: false, message: "Faltan userId o menuId" };
    }
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Favoritos');
    if (!sheet) {
      return { success: false, message: "Hoja 'Favoritos' no encontrada" };
    }
    // Verificar si ya existe (evitar duplicados)
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === userId && data[i][2] === menuId) {
        return { success: false, message: "Este plato ya está en favoritos" };
      }
    }
    // Generar ID único
    const favoritoId = 'FAV-' + userId + '-' + menuId;
    // Agregar fila nueva
    sheet.appendRow([
      favoritoId, // Columna A
      userId, // Columna B
      menuId, // Columna C
      new Date().toISOString(), // Columna D - fechaAgregado
      "" // Columna E - notas (vacío por ahora)
    ]);
    SpreadsheetApp.flush();
    return { success: true, message: "Agregado a favoritos" };
  } catch (err) {
    Logger.log("Error en addFavorite: " + err);
    return { success: false, message: "Error al agregar favorito", error: err.toString() };
  }
}
/**
 * Elimina un plato de favoritos
 */
function removeFavorite(params) {
  try {
    const userId = params.userId;
    const menuId = params.menuId;
    if (!userId || !menuId) {
      return { success: false, message: "Faltan userId o menuId" };
    }
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Favoritos');
    if (!sheet) {
      return { success: false, message: "Hoja 'Favoritos' no encontrada" };
    }
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === userId && data[i][2] === menuId) {
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return { success: true, message: "Eliminado de favoritos" };
      }
    }
    return { success: false, message: "No se encontró el favorito" };
  } catch (err) {
    Logger.log("Error en removeFavorite: " + err);
    return { success: false, message: "Error al eliminar favorito", error: err.toString() };
  }
}
/**
 * Obtiene todos los favoritos de un usuario
 * Devuelve array de objetos con menuId y fechaAgregado
 */
function getFavorites(userId) {
  try {
    if (!userId) {
      return { success: false, message: "Falta userId" };
    }
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Favoritos');
    if (!sheet) {
      return [];
    }
    const data = sheet.getDataRange().getValues();
    const favorites = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === userId) {
        favorites.push({
          menuId: data[i][2],
          fechaAgregado: data[i][3] || "",
          notas: data[i][4] || ""
        });
      }
    }
    // Ordenar por fecha descendente (más recientes primero)
    favorites.sort((a, b) => new Date(b.fechaAgregado) - new Date(a.fechaAgregado));
    return favorites;
  } catch (err) {
    Logger.log("Error en getFavorites: " + err);
    return [];
  }
}
function doPost(e) {
  const output = ContentService.createTextOutput();
  // Headers CORS EN TODA RESPUESTA (incluso errores)
  output.addHeader('Access-Control-Allow-Origin', '*');
  output.addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.addHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  output.addHeader('Access-Control-Max-Age', '3600');
  // Preflight OPTIONS - prioridad máxima
  if (e.httpMethod === 'OPTIONS' ||
      (e.parameter && e.parameter.method === 'OPTIONS') ||
      e.parameter?.action === 'OPTIONS') {
    output.setMimeType(ContentService.MimeType.TEXT);
    output.setContent('OK');
    Logger.log('Preflight OPTIONS respondido correctamente');
    return output;
  }
  // POST real
  output.setMimeType(ContentService.MimeType.JSON);
  Logger.log('POST real recibido - ' + new Date().toISOString());
  Logger.log('httpMethod: ' + (e.httpMethod || 'no detectado'));
  if (e.postData) {
    Logger.log('postData.type: ' + e.postData.type);
    if (e.postData.contents) {
      const rawPreview = e.postData.contents.substring(0, 800) + (e.postData.contents.length > 800 ? '...' : '');
      Logger.log('Contenido recibido (primeros 800 chars): ' + rawPreview);
    } else {
      Logger.log('postData existe pero contents está vacío');
    }
  } else {
    Logger.log('¡No se recibió postData! (probablemente form-urlencoded o GET)');
  }
  // =============================================================
  // SOLUCIÓN FINAL: leer directamente e.parameter (como registerLocal)
  // =============================================================
  const params = e.parameter || {};
  // Opcional: si hay JSON en body, mergearlo (para compatibilidad con POST JSON antiguos)
  try {
    if (e.postData && e.postData.contents && e.postData.contents.trim() !== '') {
      const jsonData = JSON.parse(e.postData.contents);
      Object.assign(params, jsonData); // JSON sobreescribe si hay conflicto
      Logger.log('JSON mergeado en params');
    }
  } catch (err) {
    Logger.log('No es JSON o error parseo: ' + err.message);
  }
  // Log completo de lo que realmente llegó (para depurar)
  Logger.log('Parámetros recibidos (e.parameter):');
  Logger.log(JSON.stringify(params, null, 2));
  const action = params.action || '';
  const jsonResponse = (content) => {
    output.setContent(JSON.stringify(content));
    return output;
  };
  if (!action) {
    Logger.log('Falta action → respuesta de error');
    return jsonResponse({
      success: false,
      error: 'Falta el campo "action" en la solicitud'
    });
  }
  Logger.log('Acción detectada y procesada: ' + action);
  // =====================================================================
  // ACCIONES PRINCIPALES (cambia TODOS los payload → params)
  // =====================================================================
  // Crear pedido normal
  if (action === 'createOrder') {
    try {
      const orderData = params.data || {};
      if (!orderData?.cart?.length) {
        return jsonResponse({ success: false, error: 'Carrito vacío o datos incompletos' });
      }
      const idPedido = createOrder(
        orderData.userId || 'USER1',
        orderData.fecha,
        orderData.direccion,
        orderData.metodoPago,
        orderData.observaciones || '',
        orderData.cart,
        orderData.envioGratis || false
      );
      return jsonResponse({ success: true, idPedido });
    } catch (err) {
      Logger.log('Error en createOrder: ' + err);
      return jsonResponse({ success: false, error: 'Error al crear pedido', details: err.message });
    }
  }
  if (action === 'updateEstadoLocalOrder') {
  try {
    const idPedidoLocal = params.idPedidoLocal || e.parameter.idPedidoLocal;
    const nuevoEstado = params.nuevoEstado || e.parameter.nuevoEstado;
   
    if (!idPedidoLocal || !nuevoEstado) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Faltan idPedidoLocal o nuevoEstado'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    updateEstadoLocal(idPedidoLocal, nuevoEstado);
   
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Estado actualizado correctamente'
    })).setMimeType(ContentService.MimeType.JSON);
   
  } catch (err) {
    Logger.log('Error updateEstadoLocalOrder: ' + err);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
  if (action === 'addMenuItem') {
  Logger.log('===== INICIO addMenuItem - ' + new Date().toISOString() + ' =====');
  try {
    // ────────────────────────────────────────────────
    // 1. Recopilar todos los parámetros posibles
    // ────────────────────────────────────────────────
    const params = e.parameter || {};
  
    // Si llegó JSON en el body, lo mergeamos (por si alguien envía JSON)
    try {
      if (e.postData && e.postData.type === 'application/json' && e.postData.contents) {
        const json = JSON.parse(e.postData.contents);
        Object.assign(params, json);
        Logger.log('Se mergeó contenido JSON en params');
      }
    } catch (jsonErr) {
      Logger.log('No se pudo parsear JSON del body: ' + jsonErr.message);
    }
    // ────────────────────────────────────────────────
    // 2. Extraer y limpiar valores
    // ────────────────────────────────────────────────
    const itemData = {
      localId: (params.localId || params.local_id || '').trim(),
      nombre: (params.nombre || '').trim(),
      categoria: (params.categoria || '').trim(),
      descripcion: (params.descripcion || '').trim(),
      precio: Number(params.precio) || 0,
      disponibilidad: (params.disponibilidad || 'Sí').trim(),
      tamano_porcion: (params.tamano_porcion || params.tamanoPorcion || '').trim(),
      variantes: (params.variantes || '').trim(),
      tiempo_preparacion: (params.tiempo_preparacion || params.tiempoPreparacion || '').trim(),
      imagen_url: (params.imagen_url || params.imagenUrl || '').trim()
    };
    // ────────────────────────────────────────────────
    // 3. Logging exhaustivo (muy importante para depurar)
    // ────────────────────────────────────────────────
    Logger.log('Parámetros crudos recibidos (e.parameter):');
    Logger.log(JSON.stringify(e.parameter, null, 2));
  
    Logger.log('Datos procesados para guardar:');
    Logger.log(JSON.stringify(itemData, null, 2));
    // ────────────────────────────────────────────────
    // 4. Validaciones estrictas
    // ────────────────────────────────────────────────
    const errores = [];
    if (!itemData.localId) errores.push("Falta localId");
    if (!itemData.nombre) errores.push("Falta nombre del plato");
    if (!itemData.categoria) errores.push("Falta categoría");
    if (isNaN(itemData.precio) || itemData.precio <= 0)
                                     errores.push("Precio inválido o ≤ 0");
    if (errores.length > 0) {
      Logger.log('VALIDACIÓN FALLIDA: ' + errores.join(' | '));
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Validación fallida',
          detalles: errores
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    // ────────────────────────────────────────────────
    // 5. Guardar en la hoja
    // ────────────────────────────────────────────────
    Logger.log('Validaciones pasadas → procediendo a guardar');
    const result = addMenuItem(itemData);
    Logger.log('Resultado final de addMenuItem: ' + JSON.stringify(result));
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        itemId: result.itemId,
        message: 'Plato agregado correctamente'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('ERROR GRAVE en addMenuItem:');
    Logger.log(err.message);
    Logger.log(err.stack || 'sin stack');
  
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: 'Error interno al guardar plato',
        detalles: err.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
  // Resto de acciones (sin cambios, pero ahora usan 'params' si las adaptas)
  if (action === 'updateMenuItem') return jsonResponse(updateMenuItem(params));
  if (action === 'updatePerfilLocal') return jsonResponse(updatePerfilLocal(params));
  if (['register', 'registerUser'].includes(action)) return jsonResponse(registerUser(params));
  if (['login', 'loginUser'].includes(action)) return jsonResponse(loginUser(params));
  if (action === 'registerLocal') return jsonResponse(registerLocal(params));
  if (action === 'loginLocal') return jsonResponse(loginLocal(params));
  if (action === 'enviarNotificacionEmail') {
    try {
      const { toEmail, subject, htmlBody } = params;
      if (!toEmail || !subject || !htmlBody) throw new Error('Faltan parámetros');
      MailApp.sendEmail({
        to: toEmail,
        subject,
        htmlBody,
        name: "Weep",
        replyTo: "weep.notificaciones@gmail.com"
      });
      Logger.log(`Email enviado a ${toEmail}`);
      return jsonResponse({ success: true });
    } catch (err) {
      Logger.log('Error email: ' + err);
      return jsonResponse({ success: false, error: err.message });
    }
  }
  // Mercado Pago - createPendingMercadoPagoOrder
  const MP_ACCESS_TOKEN = "APP_USR-595288641172928-010710-d915bce4137b3ee26e0c6e04873f1ac1-695835795";
  if (action === 'createPendingMercadoPagoOrder') {
    try {
      const d = params.data || params;
      if (!d?.cart?.length) throw new Error('Carrito vacío');
      const idPedido = createPendingOrder(d);
      const preference = {
        items: [{
          id: "WEEP-ORDER-" + idPedido,
          title: `Pedido Weep #${idPedido}`,
          quantity: 1,
          currency_id: "ARS",
          unit_price: Number(d.total)
        }],
        payer: { email: d.emailCliente || "cliente@weep.com.ar" },
        external_reference: `WEEP-ORD-${idPedido}-${Utilities.getUuid().substring(0,8)}`,
        back_urls: {
          success: "https://bajoneando.github.io/weep.html?status=approved",
          failure: "https://bajoneando.github.io/weep.html?status=failure",
          pending: "https://bajoneando.github.io/weep.html?status=pending"
        },
        auto_return: "approved",
        notification_url: ScriptApp.getService().getUrl() + "?action=webhookMercadoPago"
      };
      const mpRes = UrlFetchApp.fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "post",
        headers: {
          "Authorization": "Bearer " + MP_ACCESS_TOKEN,
          "Content-Type": "application/json"
        },
        payload: JSON.stringify(preference),
        muteHttpExceptions: true
      });
      const mpData = JSON.parse(mpRes.getContentText());
      if (mpData.error) throw new Error(mpData.message || "Error en Mercado Pago");
      updateOrderWithPaymentInfo(idPedido, mpData.id, mpData.external_reference);
      return jsonResponse({
        success: true,
        idPedido,
        init_point: mpData.init_point,
        preference_id: mpData.id
      });
    } catch (err) {
      Logger.log("Error en createPendingMercadoPagoOrder: " + err);
      return jsonResponse({ success: false, error: err.message });
    }
  }
  // Webhook de Mercado Pago
  if (e.parameter?.action === 'webhookMercadoPago') {
    Logger.log('WEBHOOK MERCADO PAGO RECIBIDO - ' + new Date().toISOString());
    try {
      const topic = e.parameter.topic;
      const paymentId = e.parameter.id;
      if (topic === 'payment' && paymentId) {
        const paymentRes = UrlFetchApp.fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { "Authorization": "Bearer " + MP_ACCESS_TOKEN },
          muteHttpExceptions: true
        });
        const payment = JSON.parse(paymentRes.getContentText());
        if (payment.status === "approved") {
          const extRef = payment.external_reference;
          const idPedido = extractOrderIdFromExternalReference(extRef);
          if (idPedido) markOrderAsPaid(idPedido, payment.id);
        }
      }
      return ContentService.createTextOutput("OK")
        .setMimeType(ContentService.MimeType.TEXT);
    } catch (err) {
      Logger.log('ERROR EN WEBHOOK: ' + err.toString());
      return ContentService.createTextOutput("ERROR")
        .setMimeType(ContentService.MimeType.TEXT);
    }
  }
    // Acciones de repartidores (usando params como en el resto)
  if (action === 'repartidor_register') {
    return jsonResponse(repartidor_register(params));
  }
  if (action === 'repartidor_actualizarEstado') {
    return jsonResponse(repartidor_actualizarEstado(params));
  }
  // Acción desconocida
  Logger.log('Acción desconocida: ' + (action || 'sin action'));
  return jsonResponse({ success: false, error: 'Acción no reconocida' });
}
// ======================================================================
// FUNCIONES AUXILIARES PARA MERCADO PAGO (agregar al final)
// ======================================================================
function createPendingOrder(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Pedidos GENERAL');
  if (!sheet) throw new Error('Hoja Pedidos GENERAL no encontrada');
  const idPedido = 'ORD-' + Utilities.getUuid().substring(0,10).toUpperCase();
  sheet.appendRow([
    idPedido, // A
    data.userId, // B
    new Date().toLocaleString('es-AR'), // C
    data.direccion, // D
    'Pendiente de Pago', // E
    data.total, // F
    'Mercado Pago', // G
    data.observaciones || '', // H
    data.envioGratis ? 'si' : 'no',// I
    '', // J preference_id
    '', // K external_reference
    '' // L payment_id
  ]);
  SpreadsheetApp.flush();
  return idPedido;
}
function updateOrderWithPaymentInfo(idPedido, preferenceId, externalReference) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Pedidos GENERAL');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === idPedido) {
      sheet.getRange(i + 1, 10).setValue(preferenceId); // J
      sheet.getRange(i + 1, 11).setValue(externalReference); // K
      SpreadsheetApp.flush();
      return;
    }
  }
  Logger.log('No se encontró pedido para actualizar info de pago: ' + idPedido);
}
function markOrderAsPaid(idPedido, paymentId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Pedidos GENERAL');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === idPedido) {
      sheet.getRange(i + 1, 5).setValue('Pagado'); // E - Estado
      sheet.getRange(i + 1, 12).setValue(paymentId); // L - payment_id
      sheet.getRange(i + 1, 13).setValue(new Date()); // M - Fecha pago (opcional)
      SpreadsheetApp.flush();
      Logger.log(`Pedido ${idPedido} marcado como PAGADO`);
      return;
    }
  }
  Logger.log('No se encontró pedido para marcar como pagado: ' + idPedido);
}
function extractOrderIdFromExternalReference(ref) {
  if (!ref) return null;
  Logger.log("Parseando external_reference: " + ref);
  const parts = ref.split('-');
  if (parts.length >= 3 && parts[1] === 'ORD') {
    const id = parts[2];
    Logger.log("ID extraído correctamente: " + id);
    return id;
  }
  Logger.log("Formato inválido: " + ref);
  return null;
}
// ==================== FUNCIONES DE USUARIOS ====================
function registerUser(params) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
    if (!sheet) {
      return { success: false, message: 'Hoja Usuarios no encontrada' };
    }
    // Normalizamos los parámetros (acepta name/nombre y address/direccion)
    let name = (params.name || params.nombre || '').toString().trim();
    const email = (params.email || '').toString().trim().toLowerCase();
    const password = (params.password || '').toString().trim();
    let address = (params.address || params.direccion || '').toString().trim();
    // Valores por defecto para evitar celdas completamente vacías
    if (!name) name = 'Usuario sin nombre';
    if (!address) address = ''; // Puede estar vacío, no hay problema
    if (!email || !password) {
      return { success: false, message: 'Email y contraseña son obligatorios' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, message: 'Formato de email inválido' };
    }
    // === VERIFICAR DUPLICADOS ===
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) { // desde fila 1 (encabezados en 0)
      const existingEmail = (data[i][2] || '').toString().trim().toLowerCase();
      if (existingEmail === email) {
        return { success: false, message: 'Este email ya está registrado' };
      }
    }
    // === GENERAR ID Y GUARDAR ===
    const userId = 'USR-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    // Usar appendRow (es la forma más segura y rápida)
    sheet.appendRow([userId, name, email, password, address]);
    // Forzar guardado inmediato
    SpreadsheetApp.flush();
    Logger.log(`REGISTRO EXITOSO → ID: ${userId} | Nombre: "${name}" | Email: ${email} | Dirección: "${address}"`);
    return {
      success: true,
      message: 'Registro exitoso',
      userId: userId
    };
  } catch (error) {
    Logger.log('ERROR en registerUser: ' + error.toString() + '\n' + error.stack);
    return { success: false, message: 'Error interno al registrar usuario', details: error.toString() };
  }
}
function loginUser(params) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
    if (!sheet) {
      return { success: false, message: 'Hoja Usuarios no encontrada' };
    }
    const email = (params.email || '').toString().trim().toLowerCase();
    const password = (params.password || '').toString().trim();
    if (!email || !password) {
      return { success: false, message: 'Email y contraseña requeridos' };
    }
    // === FORZAR LECTURA FRESCA Y EVITAR CACHÉ ===
    // Método más fiable: obtener el rango completo pero forzar recarga
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) { // solo encabezados o vacío
      return { success: false, message: 'Email o contraseña incorrectos' };
    }
    // Leer desde fila 2 hasta la última
    const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues(); // columnas A a E
    for (let i = 0; i < data.length; i++) {
      const rowEmail = (data[i][2] || '').toString().trim().toLowerCase();
      const rowPassword = (data[i][3] || '').toString().trim();
      if (rowEmail === email && rowPassword === password) {
        const userId = (data[i][0] || '').toString().trim();
        const address = (data[i][4] || '').toString().trim();
        Logger.log(`LOGIN EXITOSO → ${userId} (${email})`);
        return {
          success: true,
          message: 'Login exitoso',
          userId: userId,
          address: address
        };
      }
    }
    return { success: false, message: 'Email o contraseña incorrectos' };
  } catch (error) {
    Logger.log('ERROR en loginUser: ' + error.toString() + '\n' + error.stack);
    return { success: false, message: 'Error al iniciar sesión', details: error.toString() };
  }
}
// NUEVA FUNCIÓN: Búsqueda en nombres de platos (col B Menú) y locales (col B Locales)
function searchMenusAndLocals(query) {
  if (!query || query.trim().length < 2) return [];
  const normalizedQuery = query.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const menus = [];
  const matchingLocalIds = new Set();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
  
    // ────────────────────────────────────────────────
    // 1. Obtener locales activos (filtro global clave)
    // ────────────────────────────────────────────────
    const localesActivos = getLocalesActivos();
  
    // ────────────────────────────────────────────────
    // 2. Buscar locales coincidentes (solo activos)
    // ────────────────────────────────────────────────
    const localSheet = ss.getSheetByName('Locales');
    if (localSheet) {
      const localData = localSheet.getDataRange().getValues();
      for (let i = 1; i < localData.length; i++) {
        const nombreLocal = (localData[i][1] || "").toString().trim(); // Col B = nombre
        const normalizedLocal = nombreLocal.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
        const localId = (localData[i][0] || "").toString().trim(); // Col A = local_id
      
        // Solo si coincide con la búsqueda Y está activo
        if (normalizedLocal.includes(normalizedQuery) && localesActivos.has(localId)) {
          matchingLocalIds.add(localId);
        }
      }
    }
  
    // ────────────────────────────────────────────────
    // 3. Procesar menús (solo de locales activos)
    // ────────────────────────────────────────────────
    const menuSheet = ss.getSheetByName('Menú');
    if (!menuSheet) return [];
  
    const menuData = menuSheet.getDataRange().getValues();
  
    for (let i = 1; i < menuData.length; i++) {
      const row = menuData[i];
    
      const localId = (row[10] || "").toString().trim(); // Col K = local_id
    
      // FILTRO PRINCIPAL: solo locales activos
      if (!localesActivos.has(localId)) continue;
    
      const idRaw = (row[0] || "").toString().trim();
      const nombre = (row[1] || "").toString().trim();
      const categoriaCelda = (row[2] || "").toString().trim();
      const descripcion = (row[3] || "").toString().trim();
      const precio = row[4] || 0;
      const disponibilidad = (row[5] || "").toString().trim().toLowerCase();
      const tamano = (row[6] || "").toString().trim();
      const variantes = (row[7] || "").toString().trim();
      const tiempo = (row[8] || "").toString().trim();
      const imagen_url = (row[9] || "").toString().trim();
    
      const normalizedNombre = nombre.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
      const estaDisponible = ['sí', 'si', 'yes', 's', '1', 'true'].includes(disponibilidad);
      const coincidePorPlato = normalizedNombre.includes(normalizedQuery);
      const coincidePorLocal = localId && matchingLocalIds.has(localId);
    
      if (estaDisponible && (coincidePorPlato || coincidePorLocal)) {
        menus.push({
          id: idRaw,
          nombre: nombre,
          categoria: categoriaCelda,
          descripcion: descripcion,
          precio: precio,
          disponibilidad: row[5] || "",
          tamano_porcion: tamano,
          variantes: variantes,
          tiempo_preparacion: tiempo,
          imagen_url: imagen_url,
          local_id: localId,
          nombre_local: getLocalName(localId) || "Bajoneando",
          logo_url: getLocalLogo(localId) || ""
        });
      }
    }
  
    Logger.log(`Búsqueda "${query}" → ${menus.length} resultados (solo locales activos)`);
    return menus;
  } catch (e) {
    Logger.log("Error en searchMenusAndLocals: " + e.toString());
    return [];
  }
}
/**
 * Obtiene los menús disponibles, con opción de filtrar por tipo/categoría y/o por local.
 * Solo devuelve menús de locales que estén "Activo" en la hoja Locales.
 * Incluye email y dirección del local para facilitar notificaciones desde frontend.
 *
 * @param {string|null} filterType - Categoría/tipo de menú (opcional)
 * @param {string|null} filterLocal - ID del local (opcional)
 * @return {Array} Lista de menús con datos completos + email y dirección del local
 */
function getMenus(filterType, filterLocal) {
  const menus = [];
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Menú');
    if (!sheet) {
      Logger.log('Hoja "Menú" no encontrada');
      return [];
    }
    const data = sheet.getDataRange().getValues();
    // Obtenemos locales activos UNA SOLA VEZ (muy eficiente)
    const localesActivos = getLocalesActivos();
    // Normalizamos filtro de categoría (si existe)
    const tipoBuscado = filterType
      ? filterType.toString().trim().toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      : null;
    Logger.log(`getMenus → filtro categoría: "${tipoBuscado || 'ninguno'}", local: "${filterLocal || 'todos'}"`);
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const localId = (row[10] || "").toString().trim(); // Col K = local_id
      // FILTRO PRINCIPAL: solo locales activos
      if (!localesActivos.has(localId)) continue;
      // Filtro por local específico (si se pasó)
      if (filterLocal && localId !== filterLocal) continue;
      const idRaw = (row[0] || "").toString().trim();
      const nombre = (row[1] || "").toString().trim();
      const categoriaCelda = (row[2] || "").toString().trim();
      const descripcion = (row[3] || "").toString().trim();
      const precio = Number(row[4]) || 0;
      const disponibilidad = (row[5] || "").toString().trim().toLowerCase();
      const tamano_porcion = (row[6] || "").toString().trim();
      const variantes = (row[7] || "").toString().trim();
      const tiempo_preparacion = (row[8] || "").toString().trim();
      const imagen_url = (row[9] || "").toString().trim();
      // Normalizamos categoría para comparar (sin acentos)
      const categoriaNorm = categoriaCelda.toLowerCase()
                                           .normalize("NFD")
                                           .replace(/[\u0300-\u036f]/g, "");
      // Solo mostramos disponibles
      const estaDisponible = ['sí', 'si', 'yes', 's', '1', 'true'].includes(disponibilidad);
      // Aplicamos filtro de categoría si existe
      const coincideTipo = !tipoBuscado || categoriaNorm === tipoBuscado;
      if (estaDisponible && coincideTipo) {
        // Obtenemos email y dirección del local (solo una vez por local)
        const emailLocal = getLocalEmail(localId) || '';
        const direccionLocal = getDireccionLocal(localId) || '';
        menus.push({
          id: idRaw,
          nombre: nombre,
          categoria: categoriaCelda,
          descripcion: descripcion,
          precio: precio,
          disponibilidad: row[5] || "No",
          tamano_porcion: tamano_porcion,
          variantes: variantes,
          tiempo_preparacion: tiempo_preparacion,
          imagen_url: imagen_url,
          local_id: localId,
          nombre_local: getLocalName(localId) || "Local sin nombre",
          logo_url: getLocalLogo(localId) || "",
          // ── CAMPOS NUEVOS para notificaciones desde frontend ──
          email_local: emailLocal,
          direccion_local: direccionLocal
        });
      }
    }
    Logger.log(`getMenus → encontrados ${menus.length} menús (solo locales activos)`);
    return menus;
  } catch (e) {
    Logger.log('Error grave en getMenus: ' + e.toString());
    Logger.log(e.stack || 'sin stack');
    return [];
  }
}
function getLocalesActivos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Locales');
  if (!sheet) return new Set();
  const data = sheet.getDataRange().getValues();
  const activos = new Set();
  for (let i = 1; i < data.length; i++) {
    const estado = (data[i][4] || "").toString().trim().toLowerCase(); // Col E = estado
    if (estado === 'activo') {
      const localId = (data[i][0] || "").toString().trim(); // Col A = local_id
      if (localId) activos.add(localId);
    }
  }
  return activos;
}
function getLocalEmail(localId) {
  if (!localId) return '';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Locales');
  if (!sheet) return '';
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === localId) {
      return (data[i][2] || '').toString().trim(); // Col C = email
    }
  }
  return '';
}
function getDireccionLocal(localId) {
  if (!localId) return '';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Locales');
  if (!sheet) return '';
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === localId) {
      return (data[i][6] || '').toString().trim(); // Col G = dirección (índice 6)
    }
  }
  return '';
}
function getLocalName(localId) {
  if (!localId) return '';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Locales');
  if (!sheet) return '';
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === localId) {
      return (data[i][1] || '').toString().trim(); // Col B = nombre
    }
  }
  return '';
}
function getLocalLogo(localId) {
  if (!localId) return '';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Locales');
  if (!sheet) return '';
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === localId) {
      return (data[i][5] || '').toString().trim(); // Col F = logo_url
    }
  }
  return '';
}
function updateLocalEstado(e) {
  try {
    const localId = e.parameter.localId;
    const estado = e.parameter.estado;
    if (!localId || !estado) return { success: false };
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Locales');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === localId) {
        sheet.getRange(i + 1, 5).setValue(estado);
        return { success: true };
      }
    }
    return { success: false };
  } catch (err) {
    Logger.log('Error updateLocalEstado: ' + err);
    return { success: false };
  }
}
function getMenuByLocalIdColK(e) {
  try {
    const localId = e.parameter.localId;
    if (!localId) return [];
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Menú');
    const data = sheet.getDataRange().getValues();
    const menu = [];
    for (let i = 1; i < data.length; i++) {
      const rowLocalId = (data[i][10] || "").toString().trim();
      if (rowLocalId === localId) {
        menu.push({
          id: data[i][0] || "",
          nombre: data[i][1] || "",
          categoria: data[i][2] || "",
          descripcion: data[i][3] || "",
          precio: data[i][4] || 0,
          disponibilidad: data[i][5] || "No",
          tamano_porcion: data[i][6] || "",
          variantes: data[i][7] || "",
          tiempo_preparacion: data[i][8] || "",
          imagen_url: data[i][9] || ""
        });
      }
    }
    return menu;
  } catch (err) {
    Logger.log('Error getMenuByLocalIdColK: ' + err);
    return [];
  }
}
function updateDisponibilidad(e) {
  try {
    const itemId = e.parameter.itemId;
    const disponibilidad = e.parameter.disponibilidad;
    if (!itemId) return { success: false };
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Menú');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === itemId) {
        sheet.getRange(i + 1, 6).setValue(disponibilidad);
        return { success: true };
      }
    }
    return { success: false };
  } catch (err) {
    Logger.log('Error updateDisponibilidad: ' + err);
    return { success: false };
  }
}
function deleteMenuItem(e) {
  try {
    const itemId = e.parameter.itemId;
    if (!itemId) return { success: false };
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Menú');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === itemId) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false };
  } catch (err) {
    Logger.log('Error deleteMenuItem: ' + err);
    return { success: false };
  }
}
// ────────────────────────────────────────────────────────────────
// FUNCIÓN AUXILIAR addMenuItem
// ────────────────────────────────────────────────────────────────
function addMenuItem(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Menú');
  // Crear hoja si no existe (por seguridad)
  if (!sheet) {
    Logger.log('Hoja "Menú" no existía → se crea automáticamente');
    sheet = ss.insertSheet('Menú');
    sheet.appendRow([
      'ID', 'Nombre', 'Categoría', 'Descripción', 'Precio',
      'Disponibilidad', 'Tamaño Porción', 'Variantes',
      'Tiempo Prep', 'Imagen URL', 'Local ID'
    ]);
    SpreadsheetApp.flush();
  }
  // Generar ID único y legible
  const timestamp = Utilities.formatDate(new Date(), "GMT-3", "yyyyMMdd-HHmmss");
  const safeLocal = (data.localId || 'LOC-XXX').replace(/[^a-zA-Z0-9-]/g, '');
  const itemId = `MENU-${safeLocal}-${timestamp}`;
  const fila = [
    itemId,
    data.nombre || '(sin nombre)',
    data.categoria || '',
    data.descripcion || '',
    Number(data.precio) || 0,
    data.disponibilidad || 'Sí',
    data.tamano_porcion || '',
    data.variantes || '',
    data.tiempo_preparacion || '',
    data.imagen_url || '',
    data.localId || '(no recibido)'
  ];
  Logger.log('Fila que se va a guardar:');
  Logger.log(fila.join(' | '));
  sheet.appendRow(fila);
  SpreadsheetApp.flush(); // ← fuerza escritura inmediata
  Logger.log(`Plato guardado → ID: ${itemId}`);
  return {
    success: true,
    itemId: itemId
  };
}
// ==================== REGISTRO DE LOCAL (con dirección) ====================
function registerLocal(params) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Locales');
    if (!sheet) {
      return { success: false, error: "Hoja 'Locales' no encontrada" };
    }
    const localId = 'LOC-' + Date.now();
    const nombre = (params.nombre || "").toString().trim();
    const email = (params.email || "").toString().trim().toLowerCase();
    const password = (params.password || "").toString().trim();
    const direccion = (params.direccion || "").toString().trim(); // ← NUEVO
    const foto_url = (params.foto_url || "").toString().trim();
    if (!nombre || !email || !password) {
      return { success: false, error: "Nombre, email y contraseña son obligatorios" };
    }
    // Verificar si el email ya existe
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if ((data[i][2] || "").toString().trim().toLowerCase() === email) {
        return { success: false, error: "Este email ya está registrado" };
      }
    }
    // Guardar con dirección (columna G = índice 6)
    sheet.appendRow([
      localId,
      nombre,
      email,
      password,
      "Inactivo", // estado
      foto_url, // foto_url
      direccion // ← DIRECCIÓN AQUÍ
    ]);
    Logger.log(`Local registrado: ${localId} | ${nombre} | Dirección: ${direccion}`);
    return { success: true, localId: localId };
  } catch (error) {
    Logger.log('Error registerLocal: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}
// ==================== OBTENER PERFIL DEL LOCAL (incluye dirección) ====================
function getPerfilLocal(e) {
  try {
    const localId = e.parameter.localId || e.parameter.local_id;
    if (!localId) return { success: false, error: "Falta localId" };
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Locales');
    if (!sheet) return { success: false, error: "Hoja Locales no encontrada" };
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(localId).trim()) {
        return {
          success: true,
          nombre: data[i][1] || "",
          email: data[i][2] || "",
          foto_url: data[i][5] || "",
          direccion: data[i][6] || "",
          // ── CAMPOS NUEVOS ──
          horario_apertura: data[i][7] || "09:00", // columna H (índice 7)
          horario_cierre: data[i][8] || "23:00", // columna I (índice 8)
          modo_automatico: data[i][9] || "No" // columna J (índice 9)
        };
      }
    }
    return { success: false, error: "Local no encontrado" };
  } catch (err) {
    Logger.log('Error getPerfilLocal: ' + err.toString());
    return { success: false, error: err.toString() };
  }
}
// ==================== ACTUALIZAR PERFIL DEL LOCAL (con dirección) ====================
function updatePerfilLocal(data) {
  try {
    const localId = data.localId || data.local_id;
    if (!localId) {
      return { success: false, error: "Falta localId" };
    }
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Locales');
    if (!sheet) {
      return { success: false, error: "Hoja 'Locales' no encontrada" };
    }
    const values = sheet.getDataRange().getValues();
    let rowFound = -1;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim() === String(localId).trim()) {
        rowFound = i + 1;
        break;
      }
    }
    if (rowFound === -1) {
      return { success: false, error: "Local no encontrado" };
    }
    let camposActualizados = 0;
    // Campos ya existentes
    if (data.nombre !== undefined && data.nombre.trim()) {
      sheet.getRange(rowFound, 2).setValue(data.nombre.trim()); // B
      camposActualizados++;
    }
    if (data.email !== undefined && data.email.trim()) {
      const emailYaExiste = values.some((row, idx) =>
        idx > 0 && idx !== (rowFound-1) &&
        String(row[2]).trim().toLowerCase() === data.email.toLowerCase()
      );
      if (emailYaExiste) {
        return { success: false, error: "El email ya está registrado por otro local" };
      }
      sheet.getRange(rowFound, 3).setValue(data.email.trim()); // C
      camposActualizados++;
    }
    if (data.password !== undefined && data.password.trim()) {
      sheet.getRange(rowFound, 4).setValue(data.password.trim()); // D
      camposActualizados++;
    }
    if (data.foto_url !== undefined) {
      sheet.getRange(rowFound, 6).setValue(data.foto_url.trim()); // F
      camposActualizados++;
    }
    if (data.direccion !== undefined) {
      sheet.getRange(rowFound, 7).setValue(data.direccion.trim()); // G
      camposActualizados++;
    }
    // ── CAMPOS NUEVOS PARA HORARIOS ──
    if (data.horario_apertura !== undefined) {
      // Validación básica de formato HH:MM
      const val = String(data.horario_apertura).trim();
      if (/^\d{2}:\d{2}$/.test(val)) {
        sheet.getRange(rowFound, 8).setValue(val); // H
        camposActualizados++;
      }
    }
    if (data.horario_cierre !== undefined) {
      const val = String(data.horario_cierre).trim();
      if (/^\d{2}:\d{2}$/.test(val)) {
        sheet.getRange(rowFound, 9).setValue(val); // I
        camposActualizados++;
      }
    }
    if (data.modo_automatico !== undefined) {
      const val = String(data.modo_automatico).trim();
      const valorFinal = (val === 'Sí' || val === 'SI' || val === 'true' || val === true) ? 'Sí' : 'No';
      sheet.getRange(rowFound, 10).setValue(valorFinal); // J
      camposActualizados++;
    }
    SpreadsheetApp.flush();
    if (camposActualizados === 0) {
      return {
        success: true,
        message: "No se enviaron campos válidos para actualizar",
        localId
      };
    }
    Logger.log(`Perfil local actualizado → localId: ${localId}, campos: ${camposActualizados}`);
    return {
      success: true,
      message: "Perfil actualizado correctamente",
      localId,
      camposActualizados
    };
  } catch (err) {
    Logger.log('ERROR en updatePerfilLocal: ' + err.message);
    Logger.log(err.stack || '(sin stack)');
    return { success: false, error: err.message };
  }
}
function getMenuItemById(e) {
  try {
    const itemId = e.parameter.itemId;
    if (!itemId) return { success: false };
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Menú');
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === itemId) {
        return {
          success: true,
          id: data[i][0],
          nombre: data[i][1] || "",
          categoria: data[i][2] || "",
          descripcion: data[i][3] || "",
          precio: data[i][4] || 0,
          disponibilidad: data[i][5] || "No",
          tamano_porcion: data[i][6] || "",
          variantes: data[i][7] || "",
          tiempo_preparacion: data[i][8] || "",
          imagen_url: data[i][9] || ""
        };
      }
    }
    return { success: false };
  } catch (err) {
    Logger.log('Error getMenuItemById: ' + err);
    return { success: false };
  }
}
function updateMenuItem(data) {
  try {
    const { itemId, localId } = data;
    if (!itemId || !localId) {
      return {
        success: false,
        error: "Faltan itemId o localId"
      };
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Menú');
    if (!sheet) throw new Error("Hoja 'Menú' no encontrada");
    const values = sheet.getDataRange().getValues();
    let rowFound = -1;
    for (let i = 1; i < values.length; i++) {
      const rowItemId = (values[i][0] || "").toString().trim();
      const rowLocalId = (values[i][10] || "").toString().trim(); // Col K = local_id
      if (rowItemId === itemId && rowLocalId === localId) {
        rowFound = i + 1;
        break;
      }
    }
    if (rowFound === -1) {
      return { success: false, error: "Plato no encontrado para ese local" };
    }
    const columnas = {
      nombre: 2,
      categoria: 3,
      descripcion: 4,
      precio: 5,
      disponibilidad: 6,
      tamano_porcion: 7,
      variantes: 8,
      tiempo_preparacion: 9,
      imagen_url: 10
    };
    let camposActualizados = 0;
    // Actualizar solo lo que vino definido y no vacío (excepto precio que permite 0)
    if (data.nombre !== undefined && data.nombre.trim()) {
      sheet.getRange(rowFound, columnas.nombre).setValue(data.nombre.trim());
      camposActualizados++;
    }
    if (data.categoria !== undefined) {
      sheet.getRange(rowFound, columnas.categoria).setValue(data.categoria.trim());
      camposActualizados++;
    }
    if (data.descripcion !== undefined) {
      sheet.getRange(rowFound, columnas.descripcion).setValue(data.descripcion.trim());
      camposActualizados++;
    }
    if (data.precio !== undefined && !isNaN(data.precio)) {
      sheet.getRange(rowFound, columnas.precio).setValue(Number(data.precio));
      camposActualizados++;
    }
    if (data.disponibilidad !== undefined) {
      const disp = String(data.disponibilidad).trim().toLowerCase();
      sheet.getRange(rowFound, columnas.disponibilidad).setValue(
        ['sí','si','yes','s','1','true'].includes(disp) ? 'Sí' : 'No'
      );
      camposActualizados++;
    }
    if (data.tamano_porcion !== undefined) {
      sheet.getRange(rowFound, columnas.tamano_porcion).setValue(data.tamano_porcion.trim());
      camposActualizados++;
    }
    if (data.variantes !== undefined) {
      sheet.getRange(rowFound, columnas.variantes).setValue(data.variantes.trim());
      camposActualizados++;
    }
    if (data.tiempo_preparacion !== undefined) {
      sheet.getRange(rowFound, columnas.tiempo_preparacion).setValue(data.tiempo_preparacion.trim());
      camposActualizados++;
    }
    if (data.imagen_url !== undefined) {
      sheet.getRange(rowFound, columnas.imagen_url).setValue(data.imagen_url.trim());
      camposActualizados++;
    }
    SpreadsheetApp.flush();
    return {
      success: true,
      itemId,
      camposActualizados
    };
  } catch (err) {
    Logger.log('ERROR updateMenuItem: ' + err.message);
    return { success: false, error: err.message };
  }
}
function getFilters() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
  
    // ── Obtener todas las categorías (sin cambios) ────────────────────────
    const menuSheet = ss.getSheetByName('Menú');
    const types = new Set();
    if (menuSheet) {
      const menuData = menuSheet.getDataRange().getValues();
      for (let i = 1; i < menuData.length; i++) {
        const categoria = (menuData[i][2] || "").toString().trim();
        if (categoria) types.add(categoria);
      }
    }
  
    // ── Obtener TODOS los locales (sin filtrar por activo) ────────────────
    const localSheet = ss.getSheetByName('Locales');
    const locals = [];
  
    if (localSheet) {
      const localData = localSheet.getDataRange().getValues();
      for (let i = 1; i < localData.length; i++) {
        const row = localData[i];
        const local_id = (row[0] || "").toString().trim();
        const nombre_local = (row[1] || "").toString().trim();
        const imagen_url = (row[5] || "").toString().trim(); // columna F
        const estado = (row[4] || "Inactivo").toString().trim(); // columna E
      
        if (local_id && nombre_local) {
          locals.push({
            local_id: local_id,
            nombre_local: nombre_local,
            imagen_url: imagen_url,
            estado: estado // ← nuevo campo: "Activo" o "Inactivo"
          });
        }
      }
    }
  
    Logger.log('getFilters → Categorías: ' + Array.from(types).length + ', Locales totales: ' + locals.length);
  
    return {
      types: Array.from(types),
      locals: locals
    };
  } catch (error) {
    Logger.log('Error in getFilters: ' + error);
    return { types: [], locals: [] };
  }
}
function loginLocal(params) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Locales');
    if (!sheet) {
      return { success: false, error: "Hoja Locales no encontrada" };
    }
    const localData = sheet.getDataRange().getValues();
    const email = params.email || params['email'];
    const password = params.password || params['password'];
    if (!email || !password) {
      return { success: false, error: "Faltan credenciales" };
    }
    for (let i = 1; i < localData.length; i++) {
      const rowEmail = (localData[i][2] || "").toString().trim();
      const rowPass = (localData[i][3] || "").toString().trim();
      if (rowEmail === email && rowPass === password) {
        const localId = localData[i][0];
        Logger.log("Login exitoso: " + localId);
        return { success: true, localId: localId };
      }
    }
    return { success: false, error: "Credenciales inválidas" };
  } catch (error) {
    Logger.log('Error en loginLocal: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}
/**
 * Crea un pedido completo: 
 * - Genera ID de pedido general
 * - Agrupa productos por local
 * - Crea registro en Pedidos GENERAL
 * - Crea registro por local en Pedidos LOCALES (con "No" en I y metodoPago en J)
 * - Crea los ítems en Pedidos ITEMS
 * - Recalcula subtotales y total
 */
function createOrder(userId, fecha, direccion, metodoPago, observaciones, cart, envioGratis = false) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      throw new Error('El carrito está vacío o no es válido');
    }

    Logger.log('createOrder iniciado | userId: ' + userId + ' | items: ' + cart.length);

    // 1. Agrupar productos por local
    const grouped = groupProductsByLocal(cart);
    if (Object.keys(grouped).length === 0) {
      throw new Error('No se pudo agrupar ningún producto por local');
    }

    // 2. Crear pedido en Pedidos GENERAL
    const idPedido = createPedidoGeneral(ss, userId, fecha, direccion, metodoPago, observaciones, envioGratis);

    // 3. Procesar cada local
    const localesSheet = ss.getSheetByName('Pedidos LOCALES');

    Object.keys(grouped).forEach(localId => {
      const products = grouped[localId];
      const nombreLocal = products[0].nombreLocal || getLocalName(localId) || 'Local';
      const cleanLocalId = localId.replace(/[^a-zA-Z0-9]/g, '');
      const idPedidoLocal = idPedido + cleanLocalId;

      // Crear el registro del local
      createPedidoLocal(ss, idPedidoLocal, idPedido, localId, nombreLocal, envioGratis);

      // =============================================
      // IMPORTANTE: Actualizar columnas I y J
      // =============================================
      // Como acabamos de agregar la fila, usamos getLastRow()
      const ultimaFilaLocales = localesSheet.getLastRow();

      // Columna I (9) → "No"
      // Columna J (10) → mismo valor que metodoPago (viene de Pedidos GENERAL col G)
      localesSheet.getRange(ultimaFilaLocales, 9).setValue("No");          // CobroProcesado
      localesSheet.getRange(ultimaFilaLocales, 10).setValue(metodoPago);   // Método de Pago

      // Forzar guardado inmediato (muy recomendado aquí)
      SpreadsheetApp.flush();

      Logger.log(`Pedido local creado → ${idPedidoLocal} | CobroProcesado: No | Método pago: ${metodoPago}`);

      // 4. Guardar los ítems de este local
      products.forEach(product => {
        const cleanProductId = product.idProducto.replace(/[^a-zA-Z0-9]/g, '');
        const idItem = idPedidoLocal + cleanProductId;
        const totalItem = product.precioUnitario * product.cantidad;

        createPedidoItem(
          ss,
          idItem,
          idPedido,
          idPedidoLocal,
          product.idProducto,
          product.nombreProducto,
          product.precioUnitario,
          product.cantidad,
          totalItem,
          product.variantes || ''
        );
      });
    });

    // 5. Recalcular subtotales y total general
    calculateSubtotalsAndTotal(ss, idPedido);

    Logger.log('Pedido creado exitosamente → ID general: ' + idPedido);

    return idPedido;

  } catch (error) {
    Logger.log('ERROR GRAVE en createOrder: ' + error.message);
    Logger.log(error.stack || 'sin stack');
    throw error;
  }
}
// ==================== FUNCIONES AUXILIARES ====================
function groupProductsByLocal(cart) {
  const grouped = {};
  cart.forEach(item => {
    const key = item.idLocal;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });
  return grouped;
}
function createPedidoGeneral(ss, userId, fecha, direccion, metodoPago, observaciones, envioGratis) {
  const sheet = ss.getSheetByName('Pedidos GENERAL');
  if (!sheet) throw new Error('Hoja "Pedidos GENERAL" no encontrada');
  const lastRow = sheet.getLastRow();
  let idPedido;
  if (lastRow < 2) {
    idPedido = 1001;
  } else {
    const lastId = sheet.getRange(lastRow, 1).getValue();
    idPedido = Number(lastId) + 1;
  }
  sheet.appendRow([
    idPedido,
    userId,
    fecha,
    direccion,
    'Pendiente',
    0,
    metodoPago,
    observaciones,
    envioGratis ? 'si' : 'no'
  ]);
  return idPedido;
}
function createPedidoLocal(ss, idPedidoLocal, idPedido, idLocal, nombreLocal, envioGratis) {
  const sheet = ss.getSheetByName('Pedidos LOCALES');
  if (!sheet) throw new Error('Hoja "Pedidos LOCALES" no encontrada');
  const costoEnvio = envioGratis ? 0 : 500; // Default 500, ajusta según necesites
  sheet.appendRow([
    idPedidoLocal,
    idPedido,
    idLocal,
    nombreLocal,
    'Pendiente',
    0,
    costoEnvio,
    0
  ]);
}
function createPedidoItem(ss, idItem, idPedido, idPedidoLocal, idProducto, nombreProducto, precioUnitario, cantidad, totalItem, variantes) {
  const sheet = ss.getSheetByName('Pedidos ITEMS');
  if (!sheet) throw new Error('Hoja "Pedidos ITEMS" no encontrada');
  sheet.appendRow([
    idItem,
    idPedido,
    idPedidoLocal,
    idProducto,
    nombreProducto,
    precioUnitario,
    cantidad,
    totalItem,
    variantes
  ]);
}
function calculateSubtotalsAndTotal(ss, idPedido) {
  const itemsSheet = ss.getSheetByName('Pedidos ITEMS');
  const localesSheet = ss.getSheetByName('Pedidos LOCALES');
  const generalSheet = ss.getSheetByName('Pedidos GENERAL');
  if (!itemsSheet || !localesSheet || !generalSheet) {
    throw new Error('Una o más hojas no encontradas para cálculo');
  }
  const itemsData = itemsSheet.getDataRange().getValues();
  const localesData = localesSheet.getDataRange().getValues();
  // Mapear filas de locales por ID_PEDIDO_LOCAL
  const localesMap = {};
  for (let i = 1; i < localesData.length; i++) {
    if (localesData[i][1] == idPedido) { // Columna B = ID_PEDIDO
      localesMap[localesData[i][0]] = i + 1; // fila
    }
  }
  // Calcular subtotales
  const subtotales = {};
  for (let i = 1; i < itemsData.length; i++) {
    if (itemsData[i][1] == idPedido) { // Columna B = ID_PEDIDO
      const idPedidoLocal = itemsData[i][2];
      const totalItem = itemsData[i][7] || 0;
      subtotales[idPedidoLocal] = (subtotales[idPedidoLocal] || 0) + totalItem;
    }
  }
  let totalGeneral = 0;
  // Actualizar subtotales y sumar envíos
  Object.keys(subtotales).forEach(idPedidoLocal => {
    const subtotal = subtotales[idPedidoLocal];
    const row = localesMap[idPedidoLocal];
    if (row) {
      const costoEnvio = localesSheet.getRange(row, 7).getValue() || 0; // Columna G
      localesSheet.getRange(row, 6).setValue(subtotal); // Columna F = Subtotal Local
      totalGeneral += subtotal + costoEnvio;
    }
  });
  // Actualizar total en Pedidos GENERAL (última fila)
  const lastGeneralRow = generalSheet.getLastRow();
  generalSheet.getRange(lastGeneralRow, 6).setValue(totalGeneral); // Columna F = Total Pedido
}
function getLocalEmail(localId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Locales');
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === localId) {
      return data[i][2] || null; // Columna C = email
    }
  }
  return null;
}
// Actualizar estado local y verificar si el general pasa a Entregado
function updateEstadoLocal(idPedidoLocal, nuevoEstado) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const localesSheet = ss.getSheetByName('Pedidos LOCALES');
  const generalSheet = ss.getSheetByName('Pedidos GENERAL');
  const localesData = localesSheet.getDataRange().getValues();
  let rowLocal = 0;
  let idPedido = '';
  for (let i = 1; i < localesData.length; i++) {
    if (localesData[i][0] === idPedidoLocal) {
      rowLocal = i + 1;
      idPedido = localesData[i][1];
      localesSheet.getRange(rowLocal, 5).setValue(nuevoEstado);
      break;
    }
  }
  if (nuevoEstado === 'Listo' && idPedido) {
    const allListo = localesData
      .filter(row => row[1] === idPedido)
      .every(row => row[4] === 'Listo');
    if (allListo) {
      const generalData = generalSheet.getDataRange().getValues();
      for (let i = 1; i < generalData.length; i++) {
        if (generalData[i][0] == idPedido) {
          generalSheet.getRange(i + 1, 5).setValue('Entregado');
          break;
        }
      }
    }
  }
}
// ==================== MIS PEDIDOS - FUNCIONES PARA LOCAL ====================
// 1. Obtener todos los pedidos locales del local autenticado
function getPedidosLocalesByLocal(e) {
  const localId = e.parameter.localId;
  if (!localId) return [];
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Pedidos LOCALES');
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    const pedidosLocales = [];
    // Columnas: A=ID_PEDIDO_LOCAL, B=ID_PEDIDO, C=ID_LOCAL, D=Nombre_Local, E=Estado_Local, ...
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === localId) { // Columna C = ID_LOCAL
        pedidosLocales.push(data[i]); // Devuelve toda la fila
      }
    }
    // Ordenar por fecha descendente (usando ID_PEDIDO como proxy)
    pedidosLocales.sort((a, b) => b[1] - a[1]);
    return pedidosLocales;
  } catch (err) {
    Logger.log('Error en getPedidosLocalesByLocal: ' + err.toString());
    return [];
  }
}
// 2. Obtener todos los items de un pedido local específico
function getItemsByPedidoLocal(e) {
  const idPedidoLocal = e.parameter.idPedidoLocal;
  if (!idPedidoLocal) return [];
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Pedidos ITEMS');
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    const items = [];
    // Columnas: A=ID_ITEM, B=ID_PEDIDO, C=ID_PEDIDO_LOCAL, D=ID_PRODUCTO, E=Nombre_Producto, ...
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === idPedidoLocal) {
        items.push(data[i]);
      }
    }
    return items;
  } catch (err) {
    Logger.log('Error en getItemsByPedidoLocal: ' + err.toString());
    return [];
  }
}
function getPedidoGeneral(e) {
  const idPedido = e.parameter.idPedido;
  if (!idPedido) return {};
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const generalSheet = ss.getSheetByName('Pedidos GENERAL');
    const usuariosSheet = ss.getSheetByName('Usuarios');
    if (!generalSheet) return {};
    const generalData = generalSheet.getDataRange().getValues();
    let pedidoInfo = {};
    // Buscar el pedido en la hoja Pedidos GENERAL
    for (let i = 1; i < generalData.length; i++) {
      if (generalData[i][0] == idPedido) {
        const userId = generalData[i][1];
        const direccion = generalData[i][3] || '';
        const envioGratis = (generalData[i][8] || '').toString().toLowerCase() === 'si';
        pedidoInfo = {
          idPedido: generalData[i][0],
          userId: userId,
          fecha: generalData[i][2],
          direccion: direccion,
          estado: generalData[i][4] || 'Pendiente',
          total: generalData[i][5] || 0,
          metodoPago: generalData[i][6] || '',
          observaciones: generalData[i][7] || '',
          // Detectar tipo de entrega
          tipoEntrega: (direccion && direccion.trim() !== '' && !envioGratis) ? 'Con Envío' : 'Para Retirar'
        };
        break;
      }
    }
    if (!pedidoInfo.userId || !usuariosSheet) {
      // Si no hay usuario o hoja de usuarios, devolver solo lo básico
      return pedidoInfo;
    }
    // Buscar nombre y email del cliente en la hoja Usuarios
    const usuariosData = usuariosSheet.getDataRange().getValues();
    for (let i = 1; i < usuariosData.length; i++) {
      if (usuariosData[i][0] === pedidoInfo.userId) {
        pedidoInfo.nombreCliente = usuariosData[i][1] || 'Cliente';
        pedidoInfo.emailCliente = usuariosData[i][2] || '';
        break;
      }
    }
    return pedidoInfo;
  } catch (err) {
    Logger.log('Error en getPedidoGeneral: ' + err.toString());
    return {};
  }
}
// ======================================================================
// FUNCIONES PARA ACTUALIZAR PERFIL DE USUARIO (CLIENTE)
// ======================================================================
/**
 * Actualiza nombre y/o email del usuario
 * (puede usarse también para cambiar solo la contraseña si se envía)
 */
function updateUserProfile(params) {
  try {
    const userId = params.userId;
    const name = params.name ? params.name.trim() : null;
    const email = params.email ? params.email.trim().toLowerCase() : null;
    const newPassword = params.newPassword ? params.newPassword.trim() : null;
    if (!userId) {
      return { success: false, message: "Falta userId" };
    }
    if (!name && !email && !newPassword) {
      return { success: false, message: "Debes enviar al menos un campo para actualizar (nombre, email o nueva contraseña)" };
    }
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
    if (!sheet) {
      return { success: false, message: "Hoja 'Usuarios' no encontrada" };
    }
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === userId) { // Columna A = userId
        // Actualizar nombre (columna B)
        if (name) {
          sheet.getRange(i + 1, 2).setValue(name);
        }
        // Actualizar email (columna C)
        if (email) {
          // Opcional: verificar que el nuevo email no esté en uso
          const emailExists = data.some((row, idx) => idx > 0 && idx !== i && row[2]?.toString().trim().toLowerCase() === email);
          if (emailExists) {
            return { success: false, message: "El nuevo email ya está registrado por otra cuenta" };
          }
          sheet.getRange(i + 1, 3).setValue(email);
        }
        // Actualizar contraseña solo si se envió
        if (newPassword) {
          if (newPassword.length < 6) {
            return { success: false, message: "La nueva contraseña debe tener al menos 6 caracteres" };
          }
          sheet.getRange(i + 1, 4).setValue(newPassword);
        }
        SpreadsheetApp.flush();
        return {
          success: true,
          message: "Perfil actualizado correctamente"
        };
      }
    }
    return { success: false, message: "Usuario no encontrado" };
  } catch (err) {
    Logger.log("Error en updateUserProfile: " + err);
    return { success: false, message: "Error interno al actualizar perfil", error: err.toString() };
  }
}
/**
 * Actualiza SOLO la dirección del usuario
 * (más liviana y específica)
 */
function updateUserAddress(params) {
  try {
    const userId = params.userId;
    const address = (params.address || "").trim();
    if (!userId) {
      return { success: false, message: "Falta userId" };
    }
    if (address === "") {
      return { success: false, message: "La dirección no puede estar vacía" };
    }
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
    if (!sheet) {
      return { success: false, message: "Hoja 'Usuarios' no encontrada" };
    }
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === userId) { // Columna A = userId
        sheet.getRange(i + 1, 5).setValue(address); // Columna E = dirección
        SpreadsheetApp.flush();
        return {
          success: true,
          message: "Dirección actualizada correctamente",
          address: address // opcional: devolver el valor nuevo
        };
      }
    }
    return { success: false, message: "Usuario no encontrado" };
  } catch (err) {
    Logger.log("Error en updateUserAddress: " + err);
    return { success: false, message: "Error interno al actualizar dirección", error: err.toString() };
  }
}
/**
 * Devuelve lista de locales que tienen al menos un plato en la categoría indicada,
 * junto con el precio MÍNIMO de esa categoría en cada local
 */
function getLocalesConPrecioMinimoPorCategoria(categoriaBuscada) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const menuSheet = ss.getSheetByName('Menú');
    if (!menuSheet) return { success: false, message: "Hoja 'Menú' no encontrada" };
  
    const menuData = menuSheet.getDataRange().getValues();
  
    const catNormalizada = categoriaBuscada
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  
    // Obtenemos locales activos
    const localesActivos = getLocalesActivos();
  
    const localesMap = {};
  
    for (let i = 1; i < menuData.length; i++) {
      const row = menuData[i];
      const localId = (row[10] || "").toString().trim();
    
      // FILTRO CLAVE: solo locales activos
      if (!localesActivos.has(localId)) continue;
    
      const categoria = (row[2] || "").toString().trim();
      const precio = Number(row[4]) || 0;
      const disponibilidad = (row[5] || "").toString().trim().toLowerCase();
    
      if (precio <= 0) continue;
      if (!['sí','si','yes','s','1','true'].includes(disponibilidad)) continue;
    
      const catPlatoNorm = categoria
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    
      if (catPlatoNorm !== catNormalizada) continue;
    
      if (!localesMap[localId]) {
        localesMap[localId] = {
          precios: [],
          nombre_local: "",
          logo_url: ""
        };
      }
    
      localesMap[localId].precios.push(precio);
    }
  
    // Completar nombre y logo
    const localesSheet = ss.getSheetByName('Locales');
    if (localesSheet) {
      const localesData = localesSheet.getDataRange().getValues();
      for (let i = 1; i < localesData.length; i++) {
        const locId = (localesData[i][0] || "").toString().trim();
        if (localesMap[locId]) {
          localesMap[locId].nombre_local = (localesData[i][1] || "").toString().trim();
          localesMap[locId].logo_url = (localesData[i][5] || "").toString().trim();
        }
      }
    }
  
    const locales = [];
    Object.keys(localesMap).forEach(localId => {
      const info = localesMap[localId];
      if (info.precios.length === 0) return;
      const precioMin = Math.min(...info.precios);
      locales.push({
        local_id: localId,
        nombre_local: info.nombre_local || "Local sin nombre",
        logo_url: info.logo_url || "",
        precio_min_categoria: precioMin
      });
    });
  
    locales.sort((a, b) => a.precio_min_categoria - b.precio_min_categoria);
  
    return {
      success: true,
      locales: locales
    };
  } catch (err) {
    Logger.log("Error: " + err);
    return { success: false, message: "Error interno", error: err.toString() };
  }
}
/**
 * Devuelve un Set con los local_id de locales que están "Activo" en columna E
 */
function getLocalesActivos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Locales');
  if (!sheet) return new Set();
  const data = sheet.getDataRange().getValues();
  const activos = new Set();
  // Columna E = índice 4 (0-based)
  for (let i = 1; i < data.length; i++) {
    const estado = (data[i][4] || "").toString().trim().toLowerCase();
    if (estado === 'activo') {
      const localId = (data[i][0] || "").toString().trim();
      if (localId) activos.add(localId);
    }
  }
  return activos;
}
function getLocalEstado(e) {
  try {
    const localId = e.parameter.localId || '';
   
    if (!localId) {
      return { success: false, error: 'Falta el parámetro localId' };
    }
   
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Locales');
   
    if (!sheet) {
      return { success: false, error: 'Hoja "Locales" no encontrada' };
    }
   
    const data = sheet.getDataRange().getValues();
   
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === localId.trim()) { // Columna A = localId
        const estado = String(data[i][4] || 'Inactivo').trim(); // Columna E = estado
        return {
          success: true,
          estado: estado,
          localId: localId
        };
      }
    }
   
    return { success: false, estado: 'Inactivo', message: 'Local no encontrado' };
   
  } catch (err) {
    Logger.log('Error en getLocalEstado → ' + err.message);
    return { success: false, error: 'Error interno: ' + err.message };
  }
}
// ============================================================================
// FUNCIONES DE REPARTIDORES – con manejo de errores detallado
// ============================================================================
function repartidor_register(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Repartidores');
   
    if (!sheet) {
      Logger.log('ERROR: Hoja "Repartidores" no existe en el spreadsheet');
      return { success: false, error: 'Hoja "Repartidores" no encontrada en Google Sheets' };
    }
    const email = (params.email || '').trim().toLowerCase();
    const password = (params.password || '').trim();
    const nombre = (params.nombre || '').trim();
    const telefono = (params.telefono || '').trim();
    const patente = (params.patente || '').trim().toUpperCase();
    const marcaModelo = (params.marcaModelo || params['marca-modelo'] || '').trim();
    if (!email || !password || !nombre || !telefono || !patente) {
      return { success: false, error: 'Faltan campos obligatorios (email, contraseña, nombre, teléfono, patente)' };
    }
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const existingEmail = (data[i][3] || '').toString().trim().toLowerCase();
      if (existingEmail === email) {
        return { success: false, error: 'Este email ya está registrado' };
      }
    }
    const id = 'REP-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    const ahora = new Date();
    sheet.appendRow([
      id, nombre, telefono, email, password, patente, marcaModelo,
      'Inactivo', '', ahora, 0, 0, '', '', ''
    ]);
    SpreadsheetApp.flush();
    Logger.log(`Repartidor registrado: ${id} | ${email}`);
    return { success: true, repartidorId: id, message: 'Registrado correctamente' };
  } catch (err) {
    Logger.log('ERROR GRAVE en repartidor_register: ' + err.message);
    Logger.log(err.stack || 'Sin stack trace');
    return { success: false, error: 'Error interno al registrar: ' + err.message };
  }
}
function repartidor_login(params) {
  try {
    const email = (params.email || '').trim().toLowerCase();
    const password = (params.password || '').trim();
    if (!email || !password) {
      return { success: false, error: 'Email y contraseña son obligatorios' };
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Repartidores');
   
    if (!sheet) {
      Logger.log('ERROR: Hoja "Repartidores" no existe');
      return { success: false, error: 'Hoja "Repartidores" no encontrada en Google Sheets' };
    }
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      Logger.log('Hoja Repartidores está vacía o solo tiene encabezados');
      return { success: false, error: 'No hay repartidores registrados aún' };
    }
    for (let i = 1; i < data.length; i++) {
      const rowEmail = (data[i][3] || '').toString().trim().toLowerCase();
      const rowPassword = (data[i][4] || '').toString().trim();
      if (rowEmail === email && rowPassword === password) {
        const row = data[i];
        Logger.log(`Login exitoso: ${row[0]} (${email})`);
        return {
          success: true,
          data: {
            ID: row[0],
            Nombre: row[1],
            Telefono: row[2],
            Patente: row[5],
            MarcaModelo: row[6],
            Estado: row[7],
            UltimaConexion: row[8] ? row[8].toISOString() : '',
            PedidosHoy: Number(row[11]) || 0
          }
        };
      }
    }
    Logger.log(`Intento de login fallido: ${email}`);
    return { success: false, error: 'Credenciales incorrectas' };
  } catch (err) {
    Logger.log('ERROR en repartidor_login: ' + err.message);
    Logger.log(err.stack || 'Sin stack');
    return { success: false, error: 'Error interno al intentar iniciar sesión: ' + err.message };
  }
}
/**
 * Actualiza el estado del repartidor (Activo / Inactivo)
 * Usado por el toggle en el frontend
 */
function repartidor_actualizarEstado(params) {
  try {
    const id = (params.id || '').trim();
    const estado = (params.estado || '').trim();
    if (!id || !['Activo', 'Inactivo'].includes(estado)) {
      return { success: false, error: 'Faltan id o estado válido (Activo/Inactivo)' };
    }
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Repartidores');
    if (!sheet) return { success: false, error: 'Hoja Repartidores no encontrada' };
    const data = sheet.getDataRange().getValues();
    const ahora = new Date();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        sheet.getRange(i + 1, 8).setValue(estado); // Col H = Estado
        if (estado === 'Activo') {
          sheet.getRange(i + 1, 9).setValue(ahora); // I = UltimaConexion
          sheet.getRange(i + 1, 14).setValue(ahora); // N = ActivoDesde
        } else {
          sheet.getRange(i + 1, 15).setValue(ahora); // O = InactivoDesde
        }
        SpreadsheetApp.flush();
        return { success: true, message: 'Estado actualizado a ' + estado };
      }
    }
    return { success: false, error: 'Repartidor no encontrado' };
  } catch (err) {
    Logger.log('ERROR repartidor_actualizarEstado: ' + err.message);
    return { success: false, error: err.message };
  }
}
/**
 * Obtiene datos básicos del repartidor (para cargar el panel)
 * Incluye nombre, pedidosHoy, estado, etc.
 */
function repartidor_getDatos(params) {
  try {
    const id = (params.id || '').trim();
    if (!id) return { success: false, error: 'Falta id' };
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Repartidores');
    if (!sheet) return { success: false, error: 'Hoja Repartidores no encontrada' };
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        const row = data[i];
        return {
          success: true,
          data: {
            ID: row[0],
            Nombre: row[1] || 'Sin nombre',
            Telefono: row[2] || '',
            Patente: row[5] || '',
            MarcaModelo: row[6] || '',
            Estado: row[7] || 'Inactivo',
            UltimaConexion: row[8] ? row[8].toISOString() : '',
            PedidosHoy: Number(row[11]) || 0
          }
        };
      }
    }
    return { success: false, error: 'Repartidor no encontrado' };
  } catch (err) {
    Logger.log('ERROR repartidor_getDatos: ' + err.message);
    return { success: false, error: err.message };
  }
}
function handleAssignAndNotifyRepartidor(e) {
  try {
    const idPedido = e.parameter.idPedido;
    const direccion = e.parameter.direccion || "—";
    const observaciones = e.parameter.observaciones || "Ninguna";
    const envioGratis = e.parameter.envioGratis === 'true';
    const total = parseFloat(e.parameter.total) || 0;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const repartidoresSheet = ss.getSheetByName("Repartidores");
    const pedidosSheet = ss.getSheetByName("Pedidos GENERAL");
    if (!repartidoresSheet || !pedidosSheet) {
      return ContentService.createTextOutput(JSON.stringify({success: false, error: "Hoja no encontrada"}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    // 1. Buscar repartidores activos
    const repartData = repartidoresSheet.getDataRange().getValues();
    const activos = [];
    for (let i = 1; i < repartData.length; i++) { // saltar header
      const row = repartData[i];
      const estado = (row[7] || "").toString().trim(); // columna H → índice 7
      if (estado.toLowerCase() === "activo") {
        activos.push({
          rowIndex: i + 1,
          id: row[0] || "",
          nombre: row[1] || "Repartidor",
          telefono: row[2] || "",
          email: row[3] || "",
          patente: row[4] || "",
          marca: row[5] || "",
          modelo: row[6] || ""
        });
      }
    }
    if (activos.length === 0) {
      // No hay repartidores activos → no se asigna, pero el pedido ya existe
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "No hay repartidores activos en este momento"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    // 2. Elegir uno (estrategia simple: el primero, o round-robin, o el de menos pedidos)
    // Por simplicidad → tomamos el primero activo
    const repartidor = activos[0];
    // 3. Registrar en Pedidos GENERAL (agregar columna si no existe)
    // Suponiendo que la columna "Repartidor Asignado" es la última o la #K (índice 10)
    // Ajusta el número de columna según tu hoja real
    const repartidorCol = 11; // ← CAMBIAR según dónde pongas la columna "Repartidor Asignado"
    const pedidosData = pedidosSheet.getDataRange().getValues();
    let pedidoRow = -1;
    for (let i = 1; i < pedidosData.length; i++) {
      if (pedidosData[i][0] == idPedido) { // columna A = ID PEDIDO
        pedidoRow = i + 1;
        break;
      }
    }
    if (pedidoRow > 0) {
      pedidosSheet.getRange(pedidoRow, repartidorCol).setValue(
        `${repartidor.nombre} (${repartidor.email})`
      );
    }
    // 4. Enviar email al repartidor
    if (repartidor.email) {
    const metodoPago = e.parameter.metodoPago || "efectivo";
    const esEfectivo = metodoPago.toLowerCase() === "efectivo";
   
    const totalPedido = parseFloat(e.parameter.total) || 0;
    const envioGratis = e.parameter.envioGratis === 'true';
   
    // Suponiendo que ya tienes la dirección de retiro (del local) o la de entrega
    // Aquí usamos la que vino como parámetro (direccion)
    const direccionEntrega = e.parameter.direccion || "—";
    // Si necesitas la dirección del local (para retiro), tendrías que buscarla por idPedido o por items
    const subject = `¡NUEVO PEDIDO ASIGNADO! #${idPedido} - Weep Delivery`;
    const logoUrl = "https://i.postimg.cc/6q2TgqKF/Chat-GPT-Image-Feb-23-2026-12-10-45-PM-(1).png";
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align:center; margin-bottom: 30px;">
          <img src="${logoUrl}" alt="Weep Logo" style="max-width:140px; border-radius:12px;">
        </div>
       
        <h2 style="color:#d32f2f; text-align:center; margin:0 0 8px;">
          ¡Nuevo pedido asignado!
        </h2>
        <p style="text-align:center; color:#555; font-size:1.1em; margin-bottom:30px;">
          Pedido #${idPedido}
        </p>
        <hr style="border:0; border-top:1px solid #eee; margin:25px 0;">
        ${tipoEntrega === 'envio' ? `
          <h3 style="color:#d32f2f; margin:20px 0 10px;">ENTREGA</h3>
          <p><strong>Dirección de entrega:</strong><br>${direccionEntrega}</p>
          <p><strong>Observaciones:</strong><br>${observaciones || 'Ninguna'}</p>
         
          ${esEfectivo ? `
            <p style="font-size:1.15em; font-weight:bold; color:#2e7d32; margin-top:20px;">
              Total a cobrar: $${totalPedido.toFixed(2)}
            </p>
          ` : `
            <p style="color:#777; margin-top:20px;">
              Total a cobrar: NADA (pago con Transferencia / Mercado Pago)
            </p>
          `}
        ` : `
          <h3 style="color:#d32f2f; margin:20px 0 10px;">RETIRO</h3>
          <p><strong>Dirección de retiro:</strong><br>${direccionEntrega}</p> <!-- aquí podrías poner dirección del local -->
         
          ${esEfectivo ? `
            <p style="font-size:1.15em; font-weight:bold; color:#2e7d32; margin-top:20px;">
              Total a pagar al local: $${totalPedido.toFixed(2)}
            </p>
          ` : `
            <p style="color:#777; margin-top:20px;">
              Total a pagar al local: NADA (pago con Transferencia / Mercado Pago)
            </p>
          `}
        `}
        <hr style="border:0; border-top:1px solid #eee; margin:30px 0 20px;">
        <p style="color:#555; font-size:0.95em; line-height:1.5;">
          <strong>Repartidor asignado:</strong> ${repartidor.nombre}<br>
          <strong>Teléfono:</strong> ${repartidor.telefono || '—'}<br>
          <strong>Vehículo:</strong> ${repartidor.patente ? repartidor.patente + ' - ' : ''}${repartidor.marca || ''} ${repartidor.modelo || ''}
        </p>
        <p style="text-align:center; color:#777; margin-top:40px; font-size:0.9em;">
          Por favor dirígete lo antes posible.<br>
          ¡Gracias por ser parte del equipo Weep!
        </p>
      </div>
    `;
    MailApp.sendEmail({
      to: repartidor.email,
      subject: subject,
      htmlBody: htmlBody
    });
  }
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      repartidor: repartidor.nombre,
      email: repartidor.email
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log(err);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
function addLaunchEmail(email) {
  try {
    if (!email || !email.includes("@")) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, message: "Email inválido" })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Lanzamiento");
   
    if (!sheet) {
      sheet = ss.insertSheet("Lanzamiento");
      sheet.appendRow(["Email", "Fecha", "Hora"]);
    }
    const now = new Date();
    sheet.appendRow([
      email,
      Utilities.formatDate(now, Session.getScriptTimeZone(), "dd/MM/yyyy"),
      Utilities.formatDate(now, Session.getScriptTimeZone(), "HH:mm:ss")
    ]);
    return ContentService.createTextOutput(
      JSON.stringify({ success: true, message: "Email registrado" })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log("Error en addLaunchEmail: " + error);
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, message: "Error interno" })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function getCobrosByLocal(e) {
  try {
    const localId = (e.parameter.localId || '').trim();
    if (!localId) return { success: false, error: "Falta localId" };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pedidosLocalesSheet = ss.getSheetByName("Pedidos LOCALES");
    if (!pedidosLocalesSheet) return { success: false, error: "Hoja 'Pedidos LOCALES' no encontrada" };

    const data = pedidosLocalesSheet.getDataRange().getValues();

    let totalVentas = 0;
    let totalIngresadoTransferencia = 0;
    const pedidosIncluidos = [];

    const COL_ESTADO_LOCAL     = 4;  // E
    const COL_SUBTOTAL_LOCAL   = 5;  // F
    const COL_COBRO_PROCESADO  = 8;  // I
    const COL_METODO_PAGO      = 9;  // J

    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      if (String(row[2]).trim() !== localId) continue;             // C - ID LOCAL
      if (String(row[COL_ESTADO_LOCAL]).trim() !== "Entregado") continue;
      if (["sí","si","yes","1","true","s"].includes(String(row[COL_COBRO_PROCESADO] || "").trim().toLowerCase())) continue;

      const subtotal = Number(row[COL_SUBTOTAL_LOCAL]) || 0;
      totalVentas += subtotal;
      pedidosIncluidos.push(String(row[1]));  // ← CAMBIO: columna B (índice 1) → ID PEDIDO

      const metodo = String(row[COL_METODO_PAGO] || "").trim().toLowerCase();
      if (metodo.includes("transfer") || metodo.includes("transf") || metodo === "transferencia") {
        totalIngresadoTransferencia += subtotal;
      }
    }

    const comisionWeep = totalVentas * 0.05;
    const montoDisponible = Math.max(0, totalIngresadoTransferencia - comisionWeep);

    // Historial
    const cobrosSheet = ss.getSheetByName("Gestión de cobros");
    const historial = [];

    if (cobrosSheet) {
      const cobrosData = cobrosSheet.getDataRange().getValues();
      for (let i = 1; i < cobrosData.length; i++) {
        const row = cobrosData[i];
        if (String(row[3]).trim() === localId && String(row[1]).trim() === "Solicitud") {
          let fechaStr = "";
          if (row[4] instanceof Date) {
            fechaStr = Utilities.formatDate(row[4], "GMT-3", "dd/MM/yyyy");
          } else if (row[4]) {
            fechaStr = String(row[4]).trim();
          }

          historial.push({
            fechaSolicitud: fechaStr,
            montoNeto: Number(row[9]) || 0,
            estado: String(row[10] || "Pendiente").trim(),
            idsIncluidos: String(row[11] || "").trim()
          });
        }
      }
      historial.sort((a, b) => {
        const fechaA = a.fechaSolicitud ? new Date(a.fechaSolicitud.split('/').reverse().join('-')) : new Date(0);
        const fechaB = b.fechaSolicitud ? new Date(b.fechaSolicitud.split('/').reverse().join('-')) : new Date(0);
        return fechaB - fechaA;
      });
    }

    return {
      success: true,
      totalVentas: Number(totalVentas.toFixed(2)),
      comisionWeep: Number(comisionWeep.toFixed(2)),
      totalIngresadoTransferencia: Number(totalIngresadoTransferencia.toFixed(2)),
      montoDisponibleParaRetirar: Number(montoDisponible.toFixed(2)),
      pedidosIncluidos: pedidosIncluidos.join(", "),
      historial
    };

  } catch (err) {
    Logger.log("ERROR en getCobrosByLocal: " + err.message + "\n" + err.stack);
    return { success: false, error: err.message || "Error interno" };
  }
}

/**
 * Registra una nueva solicitud de cobro y marca los pedidos como procesados
 * 
 * @param {Object} params - Parámetros recibidos (localId, montoNeto)
 * @returns {Object} Resultado de la operación
 */
/**
 * Registra una nueva solicitud de cobro y marca los pedidos como procesados
 * Marca "Sí" en columna I (CobroProcesado) de "Pedidos LOCALES"
 */
function solicitarCobro(params) {
  const localId = (params.localId || '').trim();
  const montoNetoStr = (params.montoNeto || '0').trim();
  const montoNeto = Number(montoNetoStr);

  // Validaciones iniciales
  if (!localId) {
    return { success: false, error: "Falta localId" };
  }
  if (isNaN(montoNeto) || montoNeto <= 0) {
    return { success: false, error: "Monto neto inválido o ≤ 0" };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getScriptLock();
  let lockObtenido = lock.tryLock(30000); // 30 segundos de espera máxima

  try {
    // 1. Recalcular estado actual (seguridad anti-race-condition)
    const estadoActual = getCobrosByLocal({ parameter: { localId } });
    if (!estadoActual.success) {
      return { success: false, error: "No se pudo recalcular el estado actual de cobros" };
    }

    const disponibleReal = estadoActual.montoDisponibleParaRetirar;

    if (montoNeto > disponibleReal + 0.01) {
      return {
        success: false,
        error: `Monto solicitado ($${montoNeto.toFixed(2)}) supera disponible real ($${disponibleReal.toFixed(2)})`
      };
    }

    // Opcional: mínimo de retiro
    if (montoNeto < 5000) {
      return { success: false, error: "El monto mínimo para solicitar es $5.000" };
    }

    // 2. Verificar no haya solicitud pendiente
    const cobrosSheet = ss.getSheetByName("Gestión de cobros");
    if (cobrosSheet) {
      const cobrosData = cobrosSheet.getDataRange().getValues();
      const tienePendiente = cobrosData.some(row => 
        String(row[3]).trim() === localId && 
        String(row[2]).trim() === "Solicitud" && 
        String(row[10]).trim() === "Pendiente"
      );
      if (tienePendiente) {
        return { success: false, error: "Ya tienes una solicitud pendiente. Espera a que sea procesada." };
      }
    }

    // 3. Generar ID de solicitud
    const fechaHoy = Utilities.formatDate(new Date(), "GMT-3", "yyyyMMdd");
    const sufijo = Utilities.getUuid().substring(0, 3).toUpperCase();
    const idSolicitud = `COBRO-${fechaHoy}-${sufijo}`;

    // 4. Preparar IDs con formato bonito para guardar
    let idsConHash = estadoActual.pedidosIncluidos || "";
    if (idsConHash && !idsConHash.includes("#")) {
      idsConHash = idsConHash
        .split(/[, ]+/)
        .filter(id => id.trim())
        .map(id => "#" + id.trim())
        .join(", ");
    }

    // 5. Guardar solicitud en "Gestión de cobros"
    const filaNueva = [
      new Date(),               // A - Timestamp
      "Solicitud",              // B - Tipo
      idSolicitud,              // C - ID Solicitud
      localId,                  // D - LocalID
      Utilities.formatDate(new Date(), "GMT-3", "dd/MM/yyyy"), // E - Fecha Solicitud
      estadoActual.totalVentas,
      estadoActual.comisionWeep,
      estadoActual.totalIngresadoTransferencia,
      estadoActual.montoDisponibleParaRetirar,
      montoNeto,
      "Pendiente",
      idsConHash                // L - IDs Pedidos Incluidos
    ];

    if (cobrosSheet) {
      cobrosSheet.appendRow(filaNueva);
    } else {
      const nuevaHoja = ss.insertSheet("Gestión de cobros");
      nuevaHoja.appendRow([
        "Timestamp","Tipo","ID Solicitud","LocalID","Fecha Solicitud",
        "Total Ventas","Comisión Weep (5%)","Total Ingresado por Transferencia",
        "Monto Disponible para Retirar","Monto Neto Solicitado","Estado",
        "IDs Pedidos Incluidos"
      ]);
      nuevaHoja.appendRow(filaNueva);
    }

    // 6. MARcar "Sí" en columna I (índice 9 en 1-based) de Pedidos LOCALES
    if (estadoActual.pedidosIncluidos) {
      // Extraer solo los IDs limpios (sin # ni espacios)
      const idsProcesar = estadoActual.pedidosIncluidos
        .split(/[, ]+/)
        .map(id => id.replace(/^#/, '').trim())
        .filter(id => id.length > 0);

      Logger.log(`Marcando como procesados los siguientes ID PEDIDO: ${idsProcesar.join(", ")}`);

      const pedidosLocalesSheet = ss.getSheetByName("Pedidos LOCALES");
      if (pedidosLocalesSheet) {
        const data = pedidosLocalesSheet.getDataRange().getValues();
        let marcados = 0;

        for (let i = 1; i < data.length; i++) {
          const idPedido = String(data[i][1]).trim(); // Columna B = ID PEDIDO (índice 1)

          if (idsProcesar.includes(idPedido)) {
            // Columna I = CobroProcesado → índice 8 (0-based) → getRange usa 1-based → columna 9
            pedidosLocalesSheet.getRange(i + 1, 9).setValue("Sí");
            marcados++;
            Logger.log(`Marcado CobroProcesado = Sí para ID PEDIDO ${idPedido} (fila ${i+1})`);
          }
        }

        Logger.log(`Total pedidos marcados como procesados: ${marcados} de ${idsProcesar.length} esperados`);
      } else {
        Logger.log("¡ALERTA! No se encontró hoja 'Pedidos LOCALES' para marcar CobroProcesado");
      }
    } else {
      Logger.log("No había pedidos incluidos para marcar como procesados");
    }

    SpreadsheetApp.flush();

    // Opcional: notificación por email a admin
    try {
      MailApp.sendEmail({
        to: "weep.notificaciones@gmail.com",
        subject: `Solicitud de Cobro - ${localId} - $${montoNeto.toFixed(2)}`,
        htmlBody: `
          <h2>Nueva solicitud de cobro</h2>
          <p><strong>Local:</strong> ${localId}</p>
          <p><strong>Monto:</strong> $${montoNeto.toFixed(2)}</p>
          <p><strong>ID Solicitud:</strong> ${idSolicitud}</p>
          <p><strong>Pedidos incluidos:</strong> ${idsConHash || "—"}</p>
          <p>Revisar hoja "Gestión de cobros".</p>
        `
      });
    } catch (emailErr) {
      Logger.log("No se pudo enviar email: " + emailErr);
    }

    return {
      success: true,
      message: "Solicitud registrada y pedidos marcados como procesados",
      idSolicitud,
      montoNeto,
      estado: "Pendiente",
      pedidosIncluidos: idsConHash
    };

  } catch (err) {
    Logger.log("ERROR en solicitarCobro: " + err.message + "\n" + err.stack);
    return { success: false, error: err.message || "Error interno" };
  } finally {
    if (lockObtenido) lock.releaseLock();
  }
}