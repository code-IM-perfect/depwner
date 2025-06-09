const { ipcRenderer } = require('electron/renderer')
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld("depwnerStatus", {
    getThreats: () => ipcRenderer.invoke("getThreats"),
    getStats: () => ipcRenderer.invoke("getStats"),
    getScanStatus: () => ipcRenderer.invoke("getScanStatus"),
})

// Consolidate electronAPI
contextBridge.exposeInMainWorld("electronAPI", {
    updateDefinitions: () => ipcRenderer.invoke('updateDefinitions'),
    // Remove redundant IPC handlers that are already in depwnerPreferences
});

contextBridge.exposeInMainWorld("depwnerPreferences", {
    get: () => ipcRenderer.invoke("getSettings"),
    set: (newSettings) => ipcRenderer.send("setSettings", newSettings),
    onUpdateProgress: (callback) => ipcRenderer.on('updateProgress', (_event, progress) => callback(progress)),
})

contextBridge.exposeInMainWorld("electronFilesystem", {
    getFile: () => ipcRenderer.invoke("selectFile"),
    getFolder: () => ipcRenderer.invoke("selectFolder"),
    manualScan: (path, type) => ipcRenderer.send("startManualScan", path, type),
    removeThreat: (threat) => ipcRenderer.invoke("removeThreat", threat),
    restoreThreat: (threat) => ipcRenderer.invoke("restoreThreat", threat),
})
