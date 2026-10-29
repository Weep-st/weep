// escposBuilder.js - Generador de comandos ESC/POS universales para comandas Wepi

const ESC = 0x1B;
const GS = 0x1D;

const CMD = {
    INIT: Buffer.from([ESC, 0x40]),                     // ESC @
    ALIGN_LEFT: Buffer.from([ESC, 0x61, 0x00]),          // ESC a 0
    ALIGN_CENTER: Buffer.from([ESC, 0x61, 0x01]),        // ESC a 1
    ALIGN_RIGHT: Buffer.from([ESC, 0x61, 0x02]),         // ESC a 2
    BOLD_ON: Buffer.from([ESC, 0x45, 0x01]),             // ESC E 1
    BOLD_OFF: Buffer.from([ESC, 0x45, 0x00]),            // ESC E 0
    DOUBLE_SIZE: Buffer.from([GS, 0x21, 0x11]),          // GS ! 17 (Doble alto y ancho)
    DOUBLE_HEIGHT: Buffer.from([GS, 0x21, 0x01]),        // GS ! 1
    DOUBLE_WIDTH: Buffer.from([GS, 0x21, 0x10]),         // GS ! 16
    NORMAL_SIZE: Buffer.from([GS, 0x21, 0x00]),          // GS ! 0
    FEED_5: Buffer.from([ESC, 0x64, 0x05]),              // ESC d 5 (Avanza 5 lineas)
    CUT: Buffer.from([GS, 0x56, 0x00]),                  // GS V 0 (Corte de papel completo)
    CUT_FEED: Buffer.from([GS, 0x56, 0x41, 0x03]),       // GS V 65 3 (Avanza y corta)
    BEEP: Buffer.from([ESC, 0x42, 0x02, 0x02])           // ESC B 2 2 (2 beeps)
};

/**
 * Normaliza caracteres para evitar caracteres corruptos en impresoras térmicas
 */
function sanitizeText(str) {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Quita acentos (á->a, é->e, etc.)
        .replace(/[^\x20-\x7E\r\n]/g, ''); // Deja solo ASCII imprimible estándar
}

/**
 * Justifica a izquierda y derecha en una linea fija de longitud `width`
 */
function justifyRow(left, right, width) {
    const l = sanitizeText(left);
    const r = sanitizeText(right);
    const spaceNeeded = width - l.length - r.length;

    if (spaceNeeded >= 1) {
        return l + ' '.repeat(spaceNeeded) + r + '\n';
    }

    const maxLeft = width - r.length - 1;
    if (maxLeft > 5) {
        const truncatedLeft = l.substring(0, maxLeft);
        return truncatedLeft + ' ' + r + '\n' + '  ' + l.substring(maxLeft) + '\n';
    }

    return l + '\n' + ' '.repeat(Math.max(0, width - r.length)) + r + '\n';
}

/**
 * Centra un texto dentro del ancho de papel
 */
function centerLine(text, width) {
    const clean = sanitizeText(text);
    if (clean.length >= width) return clean + '\n';
    const pad = Math.floor((width - clean.length) / 2);
    return ' '.repeat(pad) + clean + '\n';
}

/**
 * Genera el Buffer ESC/POS listo para enviar a la comandera
 */
function buildEscposTicket(order, copyType = 'control', options = {}) {
    const paperWidth = options.paperWidth || '80mm';
    const cols = (paperWidth === '58mm') ? 32 : 48;
    const separatorDashed = '-'.repeat(cols) + '\n';
    const separatorDouble = '='.repeat(cols) + '\n';

    const buffers = [];

    function pushCmd(cmd) {
        buffers.push(cmd);
    }

    function pushRaw(rawString) {
        buffers.push(Buffer.from(rawString, 'ascii'));
    }

    // Inicializar impresora
    pushCmd(CMD.INIT);

    // Encabezado
    pushCmd(CMD.ALIGN_CENTER);
    pushCmd(CMD.BOLD_ON);
    pushRaw(separatorDouble);
    pushRaw(centerLine('W E P I', cols));
    pushRaw(centerLine('PEDIDOS Y DELIVERY', cols));
    pushRaw(separatorDouble);

    // Tipo de Copia (Control, Cliente o Copia Única)
    const isControl = copyType === 'control';
    let labelCopy = '*** COMANDA DE PEDIDO ***';
    if (copyType === 'control') {
        labelCopy = '*** DUPLICADO - CONTROL LOCAL ***';
    } else if (copyType === 'client') {
        labelCopy = '*** ORIGINAL - CLIENTE ***';
    }
    pushRaw(centerLine(labelCopy, cols));
    pushRaw('\n');

    // Número de Pedido destacado (Doble tamaño)
    pushCmd(CMD.DOUBLE_SIZE);
    pushRaw(centerLine('#' + order.id, Math.floor(cols / 2)));
    pushCmd(CMD.NORMAL_SIZE);
    pushCmd(CMD.BOLD_OFF);

    // Fecha
    let formattedDate = '';
    try {
        const dateObj = new Date(order.fecha);
        formattedDate = dateObj.toLocaleString('es-AR', {
            day: '2-digit',
            month: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }).replace(/\./g, '');
    } catch {
        formattedDate = sanitizeText(String(order.fecha || ''));
    }
    pushRaw(centerLine(formattedDate, cols));
    pushRaw('\n');

    // Datos del Cliente
    pushCmd(CMD.ALIGN_LEFT);
    pushCmd(CMD.BOLD_ON);
    pushRaw('CLIENTE:\n');
    pushCmd(CMD.BOLD_OFF);
    if (order.cliente) {
        if (order.cliente.nombre) pushRaw(' ' + order.cliente.nombre + '\n');
        if (order.cliente.direccion) pushRaw(' ' + order.cliente.direccion + '\n');
        if (order.cliente.telefono) pushRaw(' Tel: ' + order.cliente.telefono + '\n');
    }

    // Separador antes de ítems
    pushRaw(separatorDashed);

    // Ítems
    pushCmd(CMD.BOLD_ON);
    pushRaw(justifyRow('CANT / DESCRIPCION', 'PRECIO', cols));
    pushCmd(CMD.BOLD_OFF);

    if (Array.isArray(order.items)) {
        order.items.forEach(item => {
            const cant = item.cantidad || 1;
            const nombre = item.nombre || item.nombre_item || 'Item';
            const precioTotal = (cant * (Number(item.precio) || 0)).toFixed(2);
            const desc = `${cant} x ${nombre}`;

            pushRaw(justifyRow(desc, '$' + precioTotal, cols));

            if (item.observaciones) {
                pushRaw('  - ' + item.observaciones + '\n');
            }
        });
    }

    pushRaw(separatorDashed);

    // Método de Pago y Observaciones Generales
    pushCmd(CMD.BOLD_ON);
    const metodoPago = String(order.metodo_pago || 'No especificado').toUpperCase();
    pushRaw('PAGO: ' + metodoPago + '\n');
    pushCmd(CMD.BOLD_OFF);

    if (order.observaciones) {
        pushCmd(CMD.BOLD_ON);
        pushRaw('OBS Gral: ');
        pushCmd(CMD.BOLD_OFF);
        pushRaw(order.observaciones + '\n');
    }

    // Totales
    pushRaw(separatorDashed);
    const subtotal = Number(order.total) || 0;
    const envio = Number(order.precio_envio) || 0;
    const grandTotal = subtotal + envio;

    if (!isControl && envio > 0) {
        pushRaw(justifyRow('Subtotal:', '$' + subtotal.toFixed(2), cols));
        pushRaw(justifyRow('Envio:', '$' + envio.toFixed(2), cols));
    }

    // Total final en negrita y doble altura
    pushCmd(CMD.ALIGN_RIGHT);
    pushCmd(CMD.BOLD_ON);
    pushCmd(CMD.DOUBLE_HEIGHT);
    const totalLine = 'TOTAL: $' + (isControl ? subtotal.toFixed(2) : grandTotal.toFixed(2));
    pushRaw(totalLine + '\n');
    pushCmd(CMD.NORMAL_SIZE);
    pushCmd(CMD.BOLD_OFF);

    // Pie de comanda
    pushCmd(CMD.ALIGN_CENTER);
    pushRaw('\n');
    pushRaw(centerLine('¡Gracias por su compra!', cols));
    pushCmd(CMD.BOLD_ON);
    pushRaw(centerLine('Wepi - Pedidos y Delivery', cols));
    pushCmd(CMD.BOLD_OFF);
    pushRaw(separatorDouble);

    // Avance de papel y corte
    pushCmd(CMD.FEED_5);
    pushCmd(CMD.CUT);

    if (options.beep) {
        pushCmd(CMD.BEEP);
    }

    return Buffer.concat(buffers);
}

module.exports = {
    buildEscposTicket,
    CMD
};
