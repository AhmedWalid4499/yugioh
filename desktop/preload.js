/* Exposes a small, safe API to the web page as window.duelVault. */
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('duelVault', {
  getInfo: () => ipcRenderer.invoke('dv:info'),
  checkForUpdate: () => ipcRenderer.invoke('dv:check'),
  installUpdate: () => ipcRenderer.invoke('dv:install'),
  openExternal: (url) => ipcRenderer.invoke('dv:open', url),
  onProgress: (fn) => {
    const handler = (e, p) => fn(p);
    ipcRenderer.on('dv:progress', handler);
    return () => ipcRenderer.removeListener('dv:progress', handler);
  },
  onMenuCheck: (fn) => ipcRenderer.on('dv:menu-check', () => fn())
});
