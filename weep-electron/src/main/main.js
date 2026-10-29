const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { buildEscposTicket } = require('./printer/escposBuilder');
const { printWindowsRaw, printTcp } = require('./printer/rawPrinter');

const store = new Store();
let mainWindow;
let printerWindow;
let printQueue = [];
let isPrinting = false;
let lastProcessedOrderId = null;

// Lógica de Auto-configuración por nombre de archivo (soporta Weep_ y Wepi_)
const fileName = path.basename(process.execPath);
const match = fileName.match(/(?:Weep|Wepi)_(LOC-[\w-]+)/i);
if (match && match[1] && !store.get('localId')) {
    store.set('localId', match[1]);
}

function sendLogToUI(message, type = 'info') {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('print-log', { message, type, time: new Date().toLocaleTimeString() });
    }
}

function createWindows() {
    // Ventana Principal
    mainWindow = new BrowserWindow({
        width: 1060,
        height: 740,
        minWidth: 850,
        minHeight: 620,
        icon: path.join(__dirname, '../../assets/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    // mainWindow.webContents.openDevTools(); // Descomentar para debug

    // Ventana de Impresión Gráfica HTML (Oculta)
    printerWindow = new BrowserWindow({
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    printerWindow.loadFile(path.join(__dirname, '../print/ticket.html'));

    mainWindow.on('closed', () => {
        app.quit();
    });
}

// Gestión de la Cola de Impresión Universal
async function processQueue() {
    if (isPrinting || printQueue.length === 0) return;

    isPrinting = true;
    const task = printQueue.shift();
    let copyLabel = 'UNICA';
    if (task.copyType === 'control') copyLabel = 'DUPLICADO';
    else if (task.copyType === 'client') copyLabel = 'ORIGINAL';

    const connectionType = store.get('connectionType', 'windows'); // 'windows' | 'tcp'
    const printMode = store.get('printMode', 'graphic');           // 'graphic' | 'escpos'
    const paperWidth = store.get('paperWidth', '80mm');

    console.log(`[Impresión] Procesando pedido #${task.id} (${copyLabel}) - Modo: ${connectionType}/${printMode}`);

    // MODO 1: RED ETHERNET / WI-FI (TCP SOCKET DIRECTO)
    if (connectionType === 'tcp') {
        const tcpHost = store.get('tcpHost', '').trim();
        const tcpPort = parseInt(store.get('tcpPort', 9100), 10) || 9100;

        if (!tcpHost) {
            sendLogToUI(`Error: No hay IP configurada para la comandera de red.`, 'error');
            isPrinting = false;
            return processQueue();
        }

        try {
            sendLogToUI(`Enviando comanda #${task.id} (${copyLabel}) a ${tcpHost}:${tcpPort}...`);
            const buffer = buildEscposTicket(task, task.copyType, { paperWidth });
            await printTcp(tcpHost, tcpPort, buffer);
            sendLogToUI(`Comanda #${task.id} (${copyLabel}) impresa en red con éxito.`, 'success');
        } catch (err) {
            console.error('Error imprimiendo por TCP:', err);
            sendLogToUI(`Error comandera red (${tcpHost}:${tcpPort}): ${err.message}`, 'error');
        }

        setTimeout(() => {
            isPrinting = false;
            processQueue();
        }, 1000);
        return;
    }

    // MODO 2: WINDOWS RAW ESC/POS (DIRECTO AL SPOOLER)
    if (connectionType === 'windows' && printMode === 'escpos') {
        const printerName = store.get('printerName', '').trim();

        if (!printerName) {
            sendLogToUI(`Error: Seleccione una impresora térmica de Windows para ESC/POS.`, 'error');
            isPrinting = false;
            return processQueue();
        }

        try {
            sendLogToUI(`Enviando comanda RAW ESC/POS #${task.id} (${copyLabel}) a "${printerName}"...`);
            const buffer = buildEscposTicket(task, task.copyType, { paperWidth });
            await printWindowsRaw(printerName, buffer);
            sendLogToUI(`Comanda #${task.id} (${copyLabel}) enviada a "${printerName}" con corte OK.`, 'success');
        } catch (err) {
            console.error('Error imprimiendo RAW Windows:', err);
            sendLogToUI(`Error RAW en "${printerName}": ${err.message}`, 'error');
        }

        setTimeout(() => {
            isPrinting = false;
            processQueue();
        }, 1000);
        return;
    }

    // MODO 3: WINDOWS GRÁFICO HTML (COMPATIBILIDAD 100% ESTÁNDAR)
    let timeoutId = null;

    const handleTicketReady = async () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }

        const printerName = store.get('printerName', '');
        sendLogToUI(`Imprimiendo copia gráfica (${copyLabel}) en "${printerName || 'Predeterminada'}"...`);

        printerWindow.webContents.print({
            silent: true,
            printBackground: true,
            deviceName: printerName
        }, (success, errorType) => {
            if (!success) {
                console.error('Error de impresión gráfica:', errorType);
                sendLogToUI(`Error al imprimir en Windows: ${errorType}`, 'error');
            } else {
                sendLogToUI(`Comanda #${task.id} (${copyLabel}) impresa correctamente.`, 'success');
            }

            // Pausa entre impresiones para que la comandera procese y corte el papel
            setTimeout(() => {
                isPrinting = false;
                processQueue();
            }, 1200);
        });
    };

    ipcMain.once('ticket-ready', handleTicketReady);

    timeoutId = setTimeout(() => {
        console.warn('Timeout esperando "ticket-ready" para pedido:', task.id);
        sendLogToUI(`Timeout esperando render de comanda #${task.id}`, 'error');
        ipcMain.off('ticket-ready', handleTicketReady);
        isPrinting = false;
        processQueue();
    }, 4000);

    try {
        printerWindow.webContents.send('render-ticket', task, task.copyType);
    } catch (err) {
        console.error('Error enviando ticket a render:', err);
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        ipcMain.off('ticket-ready', handleTicketReady);
        isPrinting = false;
        processQueue();
    }
}

// Eventos IPC
ipcMain.handle('get-printers', async () => {
    return await mainWindow.webContents.getPrintersAsync();
});

ipcMain.handle('get-settings', () => {
    return {
        wsUrl: store.get('wsUrl', 'Supabase Realtime'),
        localId: store.get('localId', ''),
        autoPrint: store.get('autoPrint', true),
        printerName: store.get('printerName', ''),
        connectionType: store.get('connectionType', 'windows'),
        printMode: store.get('printMode', 'graphic'),
        tcpHost: store.get('tcpHost', '192.168.1.100'),
        tcpPort: store.get('tcpPort', 9100),
        paperWidth: store.get('paperWidth', '80mm'),
        copiesMode: store.get('copiesMode', 'duplicate')
    };
});

ipcMain.on('save-settings', (event, settings) => {
    store.set('wsUrl', settings.wsUrl);
    store.set('localId', settings.localId);
    store.set('autoPrint', settings.autoPrint);
    store.set('printerName', settings.printerName || '');
    store.set('connectionType', settings.connectionType || 'windows');
    store.set('printMode', settings.printMode || 'graphic');
    store.set('tcpHost', settings.tcpHost || '');
    store.set('tcpPort', settings.tcpPort || 9100);
    store.set('paperWidth', settings.paperWidth || '80mm');
    store.set('copiesMode', settings.copiesMode || 'duplicate');
    console.log('Configuración guardada:', settings);
});

ipcMain.on('new-order', (event, order) => {
    const uniqueId = order.db_id || order.id;
    if (uniqueId === lastProcessedOrderId) return;
    lastProcessedOrderId = uniqueId;

    console.log('Nuevo pedido recibido:', order.id);

    // Notificar a la UI
    mainWindow.webContents.send('update-last-order', order);

    // Agregar a cola si la auto-impresión está activa
    if (store.get('autoPrint', true)) {
        const copiesMode = store.get('copiesMode', 'duplicate');
        if (copiesMode === 'single') {
            printQueue.push({ ...order, copyType: 'single' });
        } else {
            printQueue.push({ ...order, copyType: 'control' });
            printQueue.push({ ...order, copyType: 'client' });
        }
        processQueue();
    }
});

// Auto-arranque (Solo Windows)
if (process.platform === 'win32') {
    app.setLoginItemSettings({
        openAtLogin: true,
        path: app.getPath('exe')
    });
}

app.whenReady().then(createWindows);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
