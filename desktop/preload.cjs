const { contextBridge, ipcRenderer } = require('electron');

const apiArgument = process.argv.find((argument) => argument.startsWith('--digit-api-base-url='));
const apiBaseUrl = apiArgument ? apiArgument.replace('--digit-api-base-url=', '') : 'http://127.0.0.1:5500/api';

contextBridge.exposeInMainWorld('digitDesktop', {
  isDesktop: true,
  platform: process.platform,
  apiBaseUrl,
  getStatus: () => ipcRenderer.invoke('desktop:get-status'),
  restartBackend: () => ipcRenderer.invoke('desktop:restart-backend'),
  openApp: () => ipcRenderer.invoke('desktop:open-app'),
  openDataFolder: () => ipcRenderer.invoke('desktop:open-data-folder')
});
