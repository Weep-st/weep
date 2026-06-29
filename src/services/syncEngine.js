import Papa from 'papaparse';
import * as XLSX from 'xlsx';

/**
 * Convierte un link de Google Sheets compartido en su link de exportación a CSV
 * @param {string} url 
 * @returns {string}
 */
function getGoogleSheetsCsvUrl(url) {
  // Reemplaza /edit... por /export?format=csv
  if (url.includes('/edit')) {
    return url.split('/edit')[0] + '/export?format=csv';
  }
  return url;
}

/**
 * Parsea un archivo o URL de Google Sheets y devuelve ÚNICAMENTE los encabezados de columnas (Array de strings)
 * @param {File} file - El objeto de archivo HTML5 (opcional si es sheets)
 * @param {string} tipo - 'csv', 'xlsx' o 'sheets'
 * @param {string} urlOrigen - Enlace de Google Sheets (opcional si es local)
 * @returns {Promise<Array<string>>}
 */
export function parseFile(file, tipo, urlOrigen = null) {
  return new Promise(async (resolve, reject) => {
    try {
      if (tipo === 'sheets') {
        const csvUrl = getGoogleSheetsCsvUrl(urlOrigen || '');
        const res = await fetch(csvUrl);
        if (!res.ok) throw new Error('No se pudo acceder a Google Sheets. Asegúrate de que sea público.');
        const csvText = await res.text();
        const results = Papa.parse(csvText, { preview: 1 }); // Solo primera fila
        resolve(results.data[0] || []);
      } else if (tipo === 'csv') {
        Papa.parse(file, {
          preview: 1, // Solo primera fila para obtener headers rápido
          complete: (results) => {
            resolve(results.data[0] || []);
          },
          error: (error) => reject(error)
        });
      } else if (tipo === 'xlsx') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
            const headers = jsonData[0] || [];
            resolve(headers.map(h => (h !== null && h !== undefined) ? h.toString().trim() : ''));
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
      } else {
        reject(new Error('Tipo de archivo no soportado: ' + tipo));
      }
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Parsea un archivo o URL de Google Sheets a filas de datos JavaScript (Array de objetos)
 * @param {File} file
 * @param {string} tipo
 * @param {string} urlOrigen
 * @returns {Promise<Array<Object>>}
 */
export function parseFileToRows(file, tipo, urlOrigen = null) {
  return new Promise(async (resolve, reject) => {
    try {
      if (tipo === 'sheets') {
        const csvUrl = getGoogleSheetsCsvUrl(urlOrigen || '');
        const res = await fetch(csvUrl);
        if (!res.ok) throw new Error('No se pudo descargar Google Sheets. Asegúrate de que sea público.');
        const csvText = await res.text();
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results.data),
          error: (error) => reject(error)
        });
      } else if (tipo === 'csv') {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results.data),
          error: (error) => reject(error)
        });
      } else if (tipo === 'xlsx') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            resolve(jsonData);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
      } else {
        reject(new Error('Tipo no soportado: ' + tipo));
      }
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Sincroniza el catálogo de productos de forma totalmente autónoma.
 * Parsea el archivo/enlace, compara con Supabase y efectúa inserts/updates en lote.
 */
export async function syncCatalog({
  localId,
  metodo,
  archivo = null,
  urlOrigen = null,
  mapeoColumnas,
  camposActualizables = [],
  desactivarFaltantes = false,
  supabaseInstance
}) {
  const supabase = supabaseInstance;
  if (!supabase) throw new Error('La instancia de Supabase es requerida.');
  if (!mapeoColumnas || !mapeoColumnas.sku || !mapeoColumnas.nombre) {
    throw new Error('El mapeo de columnas debe incluir al menos SKU y Nombre.');
  }

  // 1. Obtener y parsear las filas de datos crudos
  const rawRows = await parseFileToRows(archivo, metodo, urlOrigen);

  // 2. Obtener el menú actual de Supabase
  const { data: menuActual, error: fetchError } = await supabase
    .from('menu')
    .select('*')
    .eq('local_id', localId);

  if (fetchError) {
    throw new Error('Error al obtener el menú actual de Wepi: ' + fetchError.message);
  }

  // Mapear menú actual por SKU (O(1))
  const menuActualPorSku = {};
  menuActual.forEach(item => {
    if (item.sku) {
      menuActualPorSku[item.sku.toString().trim().toLowerCase()] = item;
    }
  });

  const productosNuevos = [];
  const productosParaActualizar = [];
  const skusProcesadosEnArchivo = new Set();
  let productosConError = 0;

  // 3. Procesar y normalizar cada fila
  rawRows.forEach((row, index) => {
    try {
      const rawSku = row[mapeoColumnas.sku];
      const rawNombre = row[mapeoColumnas.nombre];

      if (rawSku === undefined || rawSku === null || rawSku === "" || 
          rawNombre === undefined || rawNombre === null || rawNombre === "") {
        return; // Saltear filas inválidas
      }

      const sku = rawSku.toString().trim();
      const nombre = rawNombre.toString().trim();
      const skuLower = sku.toLowerCase();

      if (skusProcesadosEnArchivo.has(skuLower)) return; // Evitar duplicados en el mismo archivo
      skusProcesadosEnArchivo.add(skuLower);

      // Obtener opcionales
      const rawPrecio = mapeoColumnas.precio ? row[mapeoColumnas.precio] : null;
      const rawStock = mapeoColumnas.stock ? row[mapeoColumnas.stock] : null;
      const rawCategoria = mapeoColumnas.categoria ? row[mapeoColumnas.categoria] : null;
      const rawCodigoBarras = mapeoColumnas.codigo_barras ? row[mapeoColumnas.codigo_barras] : null;

      // Sanitizar precio
      let precio = 0;
      if (rawPrecio !== null && rawPrecio !== undefined && rawPrecio !== "") {
        const cleaned = rawPrecio.toString().replace(/[^0-9.,-]/g, '').replace(',', '.');
        precio = parseFloat(cleaned) || 0;
      }

      // Sanitizar stock
      let stock = 0;
      let manejaStock = false;
      if (rawStock !== null && rawStock !== undefined && rawStock !== "") {
        const cleaned = rawStock.toString().replace(/[^0-9-]/g, '');
        const parsedStock = parseInt(cleaned, 10);
        if (!isNaN(parsedStock)) {
          stock = parsedStock;
          manejaStock = true;
        }
      }

      const categoria = rawCategoria ? rawCategoria.toString().trim() : 'General';
      const codigoBarras = rawCodigoBarras ? rawCodigoBarras.toString().trim() : null;

      const itemExistente = menuActualPorSku[skuLower];

      if (itemExistente) {
        // ACTUALIZAR PRODUCTO EXISTENTE
        const updates = { itemId: itemExistente.id };
        let hayCambios = false;

        if (camposActualizables.includes('nombre') && itemExistente.nombre !== nombre) {
          updates.nombre = nombre;
          hayCambios = true;
        }
        if (camposActualizables.includes('precio') && itemExistente.precio !== precio) {
          updates.precio = precio;
          hayCambios = true;
        }
        if (camposActualizables.includes('categoria') && itemExistente.categoria !== categoria) {
          updates.categoria = categoria;
          hayCambios = true;
        }
        if (camposActualizables.includes('stock')) {
          if (itemExistente.maneja_stock !== manejaStock || itemExistente.stock_actual !== stock) {
            updates.maneja_stock = manejaStock;
            updates.stock_actual = stock;
            updates.ultima_confirmacion_stock = new Date().toISOString();
            hayCambios = true;
          }
        }
        if (codigoBarras && itemExistente.codigo_barras !== codigoBarras) {
          updates.codigo_barras = codigoBarras;
          hayCambios = true;
        }
        if (itemExistente.sku !== sku) {
          updates.sku = sku;
          hayCambios = true;
        }

        if (hayCambios) {
          productosParaActualizar.push(updates);
        }
      } else {
        // INSERTAR NUEVO PRODUCTO
        productosNuevos.push({
          sku,
          nombre,
          precio,
          categoria,
          maneja_stock: manejaStock,
          stock_actual: stock,
          codigo_barras: codigoBarras,
          disponibilidad: true,
          descripcion: 'Sincronizado desde ERP',
          tamano: '',
          variantes: [],
          tiempo_preparacion: '30',
          imagen_url: ''
        });
      }
    } catch (err) {
      console.error('Error procesando fila index ' + index, err);
      productosConError++;
    }
  });

  // 4. Inserciones Masivas (Insert Batch)
  let productosCreadosCount = 0;
  if (productosNuevos.length > 0) {
    const batchInserts = productosNuevos.map((prod, index) => ({
      id: `MENU-${localId}-${Date.now()}-${index}`,
      local_id: localId,
      sku: prod.sku,
      nombre: prod.nombre,
      precio: prod.precio,
      categoria: prod.categoria,
      maneja_stock: prod.maneja_stock,
      stock_actual: prod.stock_actual,
      codigo_barras: prod.codigo_barras,
      disponibilidad: prod.disponibilidad,
      descripcion: prod.descripcion,
      tamano: prod.tamano,
      variantes: prod.variantes,
      tiempo_preparacion: prod.tiempo_preparacion,
      imagen_url: prod.imagen_url
    }));

    for (let i = 0; i < batchInserts.length; i += 100) {
      const chunk = batchInserts.slice(i, i + 100);
      const { error: insertError } = await supabase.from('menu').insert(chunk);
      if (insertError) {
        console.error('Error al insertar lote:', insertError);
        productosConError += chunk.length;
      } else {
        productosCreadosCount += chunk.length;
      }
    }
  }

  // 5. Actualizaciones Masivas (Updates en paralelo controlado)
  let productosActualizadosCount = 0;
  if (productosParaActualizar.length > 0) {
    const batchSize = 15;
    for (let i = 0; i < productosParaActualizar.length; i += batchSize) {
      const chunk = productosParaActualizar.slice(i, i + batchSize);
      const promises = chunk.map(async (prod) => {
        const updates = { ...prod };
        delete updates.itemId;
        
        const { error: updateError } = await supabase
          .from('menu')
          .update(updates)
          .eq('id', prod.itemId);
        
        if (updateError) {
          console.error(`Error actualizando item ${prod.itemId}:`, updateError);
          productosConError++;
        } else {
          productosActualizadosCount++;
        }
      });
      await Promise.all(promises);
    }
  }

  // 6. Desactivar Faltantes (Soft-Delete)
  let productosDesactivadosCount = 0;
  if (desactivarFaltantes) {
    const idsADesactivar = [];
    menuActual.forEach(item => {
      if (item.sku && item.disponibilidad) {
        const skuLower = item.sku.toString().trim().toLowerCase();
        if (!skusProcesadosEnArchivo.has(skuLower)) {
          idsADesactivar.push(item.id);
        }
      }
    });

    if (idsADesactivar.length > 0) {
      const { error: deleteError } = await supabase
        .from('menu')
        .update({ disponibilidad: false })
        .in('id', idsADesactivar);

      if (deleteError) {
        console.error('Error al desactivar productos:', deleteError);
      } else {
        productosDesactivadosCount = idsADesactivar.length;
      }
    }
  }

  return {
    creados: productosCreadosCount,
    actualizados: productosActualizadosCount,
    desactivados: productosDesactivadosCount,
    errores: productosConError
  };
}
