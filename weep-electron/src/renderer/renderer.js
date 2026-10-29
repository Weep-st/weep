// Elementos DOM
const localIdInput = document.getElementById('local-id');
const connectionTypeSelect = document.getElementById('connection-type-select');
const windowsConfigSection = document.getElementById('windows-config-section');
const printerSelect = document.getElementById('printer-select');
const printModeSelect = document.getElementById('print-mode-select');
const modeHint = document.getElementById('mode-hint');
const tcpConfigSection = document.getElementById('tcp-config-section');
const tcpHostInput = document.getElementById('tcp-host');
const tcpPortSelect = document.getElementById('tcp-port-select');
const tcpCustomPort = document.getElementById('tcp-custom-port');
const copiesModeSelect = document.getElementById('copies-mode-select');
const paperWidthSelect = document.getElementById('paper-width-select');
const autoPrintCheck = document.getElementById('auto-print');

const saveBtn = document.getElementById('save-btn');
const testBtn = document.getElementById('test-btn');
const previewBtn = document.getElementById('preview-btn');

const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const lastOrderCard = document.getElementById('last-order-card');
const logList = document.getElementById('log-list');

// Modal Elements
const previewModal = document.getElementById('preview-modal');
const closePreview = document.getElementById('close-preview');
const ticketPreviewContainer = document.getElementById('ticket-preview-container');

// Configuración de Supabase
const SUPABASE_URL = 'https://jskxfescamdjesdrcnkf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza3hmZXNjYW1kamVzZHJjbmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDgwNjIsImV4cCI6MjA4ODkyNDA2Mn0.jd5OH4aUXRDfCPeQTKhO6cQvEFo-MCuwiYW4CLK4-3I';

let supabaseClient = null;
let channel = null;
let cloudConfig = null;

// Manejo de visibilidad según tipo de conexión
function updateConnectionUI() {
    const isTcp = connectionTypeSelect.value === 'tcp';
    windowsConfigSection.style.display = isTcp ? 'none' : 'block';
    tcpConfigSection.style.display = isTcp ? 'block' : 'none';
}

function updateModeHint() {
    if (printModeSelect.value === 'escpos') {
        modeHint.innerText = 'Envía comandos ESC/POS nativos directamente a la comandera (ideal para impresoras térmicas en modo texto).';
        modeHint.style.color = '#fbbf24';
    } else {
        modeHint.innerText = 'Modo estándar gráfico para impresoras térmicas con controlador de Windows (100% retrocompatible).';
        modeHint.style.color = '#9ca3af';
    }
}

// Manejo del selector de puerto
tcpPortSelect.addEventListener('change', () => {
    if (tcpPortSelect.value === 'custom') {
        tcpCustomPort.style.display = 'block';
        tcpCustomPort.focus();
    } else {
        tcpCustomPort.style.display = 'none';
    }
});

// Solo permitir números en el campo de puerto personalizado
tcpCustomPort.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
});

connectionTypeSelect.addEventListener('change', updateConnectionUI);
printModeSelect.addEventListener('change', updateModeHint);

async function init() {
    const settings = await window.electronAPI.getSettings();

    localIdInput.value = settings.localId || '';
    connectionTypeSelect.value = settings.connectionType || 'windows';
    printModeSelect.value = settings.printMode || 'graphic';
    tcpHostInput.value = settings.tcpHost || '';
    
    // Configuración del puerto
    const savedPort = settings.tcpPort ? String(settings.tcpPort) : '9100';
    if (savedPort === '9100' || !savedPort) {
        tcpPortSelect.value = '9100';
        tcpCustomPort.style.display = 'none';
        tcpCustomPort.value = '9100';
    } else {
        tcpPortSelect.value = 'custom';
        tcpCustomPort.style.display = 'block';
        tcpCustomPort.value = savedPort;
    }

    copiesModeSelect.value = settings.copiesMode || 'duplicate';
    paperWidthSelect.value = settings.paperWidth || '80mm';
    autoPrintCheck.checked = settings.autoPrint !== false;

    updateConnectionUI();
    updateModeHint();

    await loadPrinters(settings.printerName);

    // Escuchar logs provenientes del proceso principal
    if (window.electronAPI.onPrintLog) {
        window.electronAPI.onPrintLog((log) => {
            addLog(log.message, log.type);
        });
    }

    if (settings.localId) {
        connectToSupabase(settings.localId);
        await refreshCloudConfig();
    } else {
        addLog('Esperando ID de Local para conectar...', 'info');
    }
}

async function refreshCloudConfig() {
    try {
        if (!supabaseClient) return;
        const { data, error } = await supabaseClient
            .from('app_config')
            .select('value')
            .eq('key', 'ticket_design')
            .single();
        
        if (error) throw error;
        cloudConfig = data.value;
        addLog('Diseño de ticket actualizado desde la nube');
    } catch (e) {
        addLog('Aviso: Usando diseño local por defecto');
    }
}

async function loadPrinters(selectedPrinter) {
    try {
        const printers = await window.electronAPI.getPrinters();
        printerSelect.innerHTML = '<option value="">(Impresora predeterminada de Windows)</option>';
        
        printers.forEach(p => {
            const option = document.createElement('option');
            option.value = p.name;
            option.innerText = p.name + (p.isDefault ? ' (Por defecto)' : '');
            if (p.name === selectedPrinter) option.selected = true;
            printerSelect.appendChild(option);
        });
    } catch (err) {
        console.error('Error cargando impresoras:', err);
    }
}

function connectToSupabase(localId) {
    if (channel) channel.unsubscribe();
    updateStatus(false);
    addLog(`Conectando suscripción para local: ${localId}`, 'info');
    
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    channel = supabaseClient
        .channel('pedidos_locales_realtime')
        .on(
            'postgres_changes',
            { 
                event: '*', 
                schema: 'public', 
                table: 'pedidos_locales',
                filter: `local_id=eq.${localId}`
            },
            (payload) => {
                const order = payload.new;
                if (!order) return;
                
                const printableStates = ['Confirmado'];
                if (printableStates.includes(order.estado)) {
                    if (!window.printedOrdersSet) window.printedOrdersSet = new Set();
                    if (window.printedOrdersSet.has(order.pedido_id)) return;
                    window.printedOrdersSet.add(order.pedido_id);

                    addLog(`¡Pedido Confirmado! Iniciando comanda #${order.pedido_id.slice(-6)}...`, 'success');
                    fetchOrderDetails(order);
                } else {
                    const shortId = order.pedido_id ? order.pedido_id.substring(order.pedido_id.length - 6) : '???';
                    addLog(`Pedido #${shortId} en estado: ${order.estado} (Espera Confirmado)`);
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                updateStatus(true);
                addLog('Suscrito a pedidos en tiempo real', 'success');
            } else {
                updateStatus(false);
                addLog('Estado de conexión Supabase: ' + status);
            }
        });
}

async function fetchOrderDetails(pedidoLocal) {
    try {
        const { data: general, error: errGen } = await supabaseClient
            .from('pedidos_general')
            .select('*')
            .eq('id', pedidoLocal.pedido_id)
            .single();

        if (errGen) throw errGen;

        const { data: items, error: errItems } = await supabaseClient
            .from('pedidos_items')
            .select('*')
            .eq('pedido_id', pedidoLocal.pedido_id)
            .eq('local_id', pedidoLocal.local_id);

        if (errItems) throw errItems;

        const { data: localData } = await supabaseClient
            .from('locales')
            .select('foto_url')
            .eq('id', pedidoLocal.local_id)
            .single();

        const localLogo = localData?.foto_url || 'https://jskxfescamdjesdrcnkf.supabase.co/storage/v1/object/public/locales/default-logo.png';

        const fullOrder = {
            id: general.num_confirmacion || general.id.substring(0, 8),
            db_id: general.id,
            total: pedidoLocal.total,
            precio_envio: Number(general.precio_envio) || 0,
            fecha: general.created_at,
            local_logo: localLogo,
            cliente: {
                nombre: general.nombre_cliente,
                direccion: general.direccion,
                telefono: general.telefono || 'N/A'
            },
            items: items.map(i => ({
                cantidad: i.cantidad,
                nombre: i.nombre || i.nombre_item,
                precio: i.precio_unitario,
                observaciones: i.observaciones
            })),
            metodo_pago: general.metodo_pago,
            observaciones: general.observaciones
        };

        processNewOrder(fullOrder);
    } catch (error) {
        addLog('Error al obtener detalles: ' + error.message, 'error');
    }
}

function processNewOrder(order) {
    addLog(`Procesando pedido comanda #${order.id}`);

    window.electronAPI.sendNewOrder({
        ...order,
        config: cloudConfig
    });
}

function renderTicketToElement(order, targetElement) {
    const dateObj = new Date(order.fecha);
    const formattedDate = dateObj.toLocaleString('es-AR', {
        day: '2-digit',
        month: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    }).replace(/\./g, '');

    let itemsHtml = order.items.map(item => `
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>${item.cantidad} x ${item.nombre}</span>
            <span>$${(item.cantidad * item.precio).toFixed(2)}</span>
        </div>
        ${item.observaciones ? `<div style="font-size: 11px; font-style: italic; margin-left: 10px;">- ${item.observaciones}</div>` : ''}
    `).join('');

    const subtotal = Number(order.total) || 0;
    const envio = Number(order.precio_envio) || 0;
    const grandTotal = subtotal + envio;

    let totalSectionHtml = '';
    if (envio > 0) {
        totalSectionHtml = `
            <div style="text-align: right; font-size: 12px; margin-top: 5px; border-top: 1px solid #000; padding-top: 2px;">
                Subtotal: $${subtotal.toFixed(2)}
            </div>
            <div style="text-align: right; font-size: 12px;">
                Envío: $${envio.toFixed(2)}
            </div>
            <div style="text-align: right; font-size: 18px; font-weight: bold;">TOTAL: $${grandTotal.toFixed(2)}</div>
        `;
    } else {
        totalSectionHtml = `
            <div style="text-align: right; font-size: 18px; font-weight: bold; margin-top: 5px; border-top: 1px solid #000; padding-top: 2px;">TOTAL: $${subtotal.toFixed(2)}</div>
        `;
    }

    targetElement.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-bottom: 5px;">
            <img src="${order.local_logo}" onerror="this.style.display='none'" style="max-width: 25mm; max-height: 20mm; object-fit: contain;">
            <div style="font-size: 26px; line-height: 1; color: #000;">|</div>
            <img src="https://i.postimg.cc/YG09sFTR/wepi.png" onerror="this.style.display='none'" style="max-width: 35mm; max-height: 25mm; object-fit: contain;">
        </div>
        <div style="border-top: 2px solid black; margin: 5px 0;"></div>
        <div style="text-align: center; font-size: 11px; font-weight: bold;">*** COMANDA DE PEDIDO ***</div>
        <div style="text-align: center; font-size: 22px; font-weight: bold; margin: 4px 0;">#${order.id}</div>
        <div style="text-align: center; font-size: 11px; margin-bottom: 10px;">${formattedDate}</div>
        
        <div style="margin: 8px 0; font-size: 13px;">
            <strong>CLIENTE:</strong><br>
            ${order.cliente.nombre}<br>
            ${order.cliente.direccion}<br>
            Tel: ${order.cliente.telefono}
        </div>

        <div style="border-top: 1px dashed black; margin: 8px 0;"></div>
        <div>${itemsHtml}</div>
        <div style="border-top: 1px dashed black; margin: 8px 0;"></div>

        <div><strong>PAGO:</strong> ${order.metodo_pago.toUpperCase()}</div>
        ${order.observaciones ? `<div><strong>OBS Gral:</strong> ${order.observaciones}</div>` : ''}

        ${totalSectionHtml}
        
        <div style="text-align: center; margin-top: 15px; font-size: 11px; line-height: 1.4;">
            ¡Gracias por su compra!<br>
            <strong>Wepi - Pedidos y Delivery</strong>
        </div>
    `;
}

function updateStatus(connected) {
    if (connected) {
        statusIndicator.className = 'status-badge connected';
        statusText.innerText = 'Conectado a Wepi';
    } else {
        statusIndicator.className = 'status-badge disconnected';
        statusText.innerText = 'Desconectado';
    }
}

function addLog(text, type = '') {
    const li = document.createElement('li');
    li.innerText = `[${new Date().toLocaleTimeString()}] ${text}`;
    if (type === 'success') li.className = 'log-success';
    if (type === 'error') li.className = 'log-error';
    if (type === 'info') li.className = 'log-info';

    logList.prepend(li);
    if (logList.children.length > 30) logList.lastElementChild.remove();
}

window.electronAPI.onUpdateLastOrder((order) => {
    lastOrderCard.className = 'order-card animate-pop';
    lastOrderCard.innerHTML = `
        <div class="central-header" style="display: flex; justify-content: center; align-items: center; gap: 15px; background: white; padding: 10px; border-radius: 8px; margin-bottom: 10px;">
            <img src="${order.local_logo}" onerror="this.style.display='none'" style="max-width: 24mm; max-height: 18mm; object-fit: contain;">
            <div style="font-size: 26px; line-height: 1; color: #000;">|</div>
            <img src="https://i.postimg.cc/YG09sFTR/wepi.png" onerror="this.style.display='none'" style="max-width: 35mm; max-height: 25mm; object-fit: contain;">
        </div>
        <div class="order-header">
            <span class="order-number">Pedido #${order.id}</span>
            <span class="order-time">${new Date().toLocaleTimeString()}</span>
        </div>
        <div class="order-body">
            <p><strong>Cliente:</strong> ${order.cliente?.nombre || 'N/A'}</p>
            <p><strong>Dirección:</strong> ${order.cliente?.direccion || 'N/A'}</p>
            <p><strong>Total:</strong> $${order.total}</p>
            
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button id="view-ticket-btn" class="secondary-btn" style="padding: 8px; width: auto; flex: 1;">👁️ Ver Ticket</button>
                <div style="flex: 2; padding: 8px; background: rgba(16, 185, 129, 0.1); color: #10b981; border-radius: 8px; text-align: center; font-weight: bold; font-size: 13px;">
                    ✓ Enviado a Impresión
                </div>
            </div>
        </div>
    `;

    const btn = document.getElementById('view-ticket-btn');
    if (btn) {
        btn.addEventListener('click', () => {
            renderTicketToElement(order, ticketPreviewContainer);
            previewModal.style.display = 'flex';
        });
    }
});

saveBtn.addEventListener('click', () => {
    const localId = localIdInput.value.trim();
    if (!localId) return alert('Por favor, ingresá el ID del Local');

    // Determinar el puerto: 9100 si es estándar, o el valor personalizado
    let finalPort = 9100;
    if (tcpPortSelect.value === 'custom') {
        const parsed = parseInt(tcpCustomPort.value.trim(), 10);
        finalPort = (!isNaN(parsed) && parsed > 0 && parsed <= 65535) ? parsed : 9100;
    } else {
        finalPort = 9100;
    }

    const settings = {
        wsUrl: 'Supabase Realtime',
        localId,
        autoPrint: autoPrintCheck.checked,
        connectionType: connectionTypeSelect.value,
        printerName: printerSelect.value,
        printMode: printModeSelect.value,
        tcpHost: tcpHostInput.value.trim(),
        tcpPort: finalPort,
        paperWidth: paperWidthSelect.value,
        copiesMode: copiesModeSelect.value
    };

    window.electronAPI.saveSettings(settings);
    connectToSupabase(localId);
    refreshCloudConfig();
    addLog('Configuración guardada correctamente.', 'success');
});

testBtn.addEventListener('click', () => {
    const mockOrder = getMockOrder();
    addLog('Generando pedido de prueba...', 'info');
    processNewOrder(mockOrder);
});

previewBtn.addEventListener('click', () => {
    const mockOrder = getMockOrder();
    renderTicketToElement(mockOrder, ticketPreviewContainer);
    previewModal.style.display = 'flex';
});

closePreview.addEventListener('click', () => {
    previewModal.style.display = 'none';
});

function getMockOrder() {
    return {
        id: Math.floor(1000 + Math.random() * 9000).toString(),
        total: 1350.00,
        precio_envio: 190.50,
        fecha: new Date().toISOString(),
        local_logo: 'https://jskxfescamdjesdrcnkf.supabase.co/storage/v1/object/public/locales/default-logo.png',
        cliente: {
            nombre: 'Juan Carlos Prueba',
            direccion: 'Av. Corrientes 1234, 5to B',
            telefono: '11 4444-5555'
        },
        items: [
            { cantidad: 2, nombre: 'Hamb. con Queso Dble', precio: 500, observaciones: 'Sin cebolla por favor' },
            { cantidad: 1, nombre: 'Papas Fritas Medianas', precio: 350 },
            { cantidad: 1, nombre: 'Gaseosa 500ml', precio: 190.50 }
        ],
        metodo_pago: 'Mercado Pago',
        observaciones: 'Tocar timbre que no anda bien.'
    };
}

init();
