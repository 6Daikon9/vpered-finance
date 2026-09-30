const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktopStorage', {
  get: key => ipcRenderer.invoke('storage-read', key),
  set: (key, value) => ipcRenderer.invoke('storage-write', key, value),
  export: (contents, name) => ipcRenderer.invoke('budget-export', contents, name)
});
