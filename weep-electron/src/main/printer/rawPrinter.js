// rawPrinter.js - Impresión directa RAW para Windows Spooler y TCP Sockets de red

const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { execFile } = require('child_process');

let app = null;
try {
    const electron = require('electron');
    if (electron && electron.app) {
        app = electron.app;
    }
} catch {
    // Si se ejecuta en tests o scripts Node puros
    app = null;
}

/**
 * Localiza la ruta del binario rawprint.exe compilado
 */
function getRawPrintExePath() {
    const candidates = [];

    // Rutas en aplicación empaquetada (Production)
    if (process.resourcesPath) {
        candidates.push(path.join(process.resourcesPath, 'bin', 'rawprint.exe'));
        candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'bin', 'rawprint.exe'));
    }

    // Rutas en desarrollo y fallbacks
    candidates.push(path.join(__dirname, '../../../bin/rawprint.exe'));
    candidates.push(path.join(__dirname, '../../bin/rawprint.exe'));
    candidates.push(path.join(process.cwd(), 'bin', 'rawprint.exe'));
    candidates.push(path.join(process.cwd(), 'weep-electron', 'bin', 'rawprint.exe'));

    if (app && typeof app.getAppPath === 'function') {
        candidates.push(path.join(app.getAppPath(), 'bin', 'rawprint.exe'));
    }

    for (const p of candidates) {
        if (fs.existsSync(p)) {
            return p;
        }
    }

    throw new Error(`No se encontró el ejecutable rawprint.exe. Se buscaron las siguientes rutas:\n${candidates.join('\n')}`);
}

/**
 * Envía un buffer en modo RAW directamente al Spooler de Windows usando rawprint.exe
 * @param {string} printerName Nombre exacto de la impresora en Windows
 * @param {Buffer} buffer Bytes ESC/POS a imprimir
 */
function printWindowsRaw(printerName, buffer) {
    return new Promise((resolve, reject) => {
        if (!printerName) {
            return reject(new Error('Debe especificar un nombre de impresora para imprimir.'));
        }

        let exePath;
        try {
            exePath = getRawPrintExePath();
        } catch (err) {
            return reject(err);
        }

        const tmpFile = path.join(os.tmpdir(), `wepi_raw_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.bin`);

        fs.writeFile(tmpFile, buffer, (writeErr) => {
            if (writeErr) {
                return reject(new Error(`Error creando archivo temporal para impresión: ${writeErr.message}`));
            }

            execFile(exePath, [printerName, tmpFile], { windowsHide: true }, (execErr, stdout, stderr) => {
                // Limpieza del archivo temporal
                fs.unlink(tmpFile, () => {});

                if (execErr) {
                    console.error('Error ejecutando rawprint.exe:', execErr, stderr);
                    return reject(new Error(`Fallo de impresión RAW: ${stderr || execErr.message}`));
                }

                console.log('rawprint salida:', stdout.trim());
                resolve({ success: true, message: stdout.trim() });
            });
        });
    });
}

/**
 * Envía un buffer ESC/POS directamente a una impresora de red vía TCP Socket (puerto 9100 por defecto)
 * @param {string} host Dirección IP o hostname de la comandera de red (ej: "192.168.1.150")
 * @param {number} port Puerto RAW JetDirect (por defecto 9100)
 * @param {Buffer} buffer Bytes ESC/POS a imprimir
 * @param {number} timeoutMs Tiempo de espera máximo en ms (default 5000)
 */
function printTcp(host, port = 9100, buffer, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        if (!host) {
            return reject(new Error('Debe especificar la dirección IP de la impresora de red.'));
        }

        const socket = new net.Socket();
        let isResolved = false;

        socket.setTimeout(timeoutMs);

        socket.connect(port, host, () => {
            socket.write(buffer, () => {
                socket.end();
            });
        });

        socket.on('close', (hadError) => {
            if (!isResolved) {
                isResolved = true;
                if (!hadError) {
                    resolve({ success: true });
                }
            }
        });

        socket.on('timeout', () => {
            socket.destroy();
            if (!isResolved) {
                isResolved = true;
                reject(new Error(`Tiempo de espera agotado al conectar a ${host}:${port}`));
            }
        });

        socket.on('error', (err) => {
            socket.destroy();
            if (!isResolved) {
                isResolved = true;
                reject(new Error(`Error de conexión TCP con la impresora (${host}:${port}): ${err.message}`));
            }
        });
    });
}

module.exports = {
    printWindowsRaw,
    printTcp,
    getRawPrintExePath
};
