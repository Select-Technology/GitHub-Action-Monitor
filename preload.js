const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  gitPull: (folderPath) => ipcRenderer.invoke('git-pull', folderPath)
});
