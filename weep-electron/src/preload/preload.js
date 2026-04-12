const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.send('save-settings', settings),
    getPrinters: () => ipcRenderer.invoke('get-printers'),
    onUpdateLastOrder: (callback) => ipcRenderer.on('update-last-order', (event, value) => callback(value)),
    sendNewOrder: (order) => ipcRenderer.send('new-order', order)
});
