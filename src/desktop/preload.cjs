const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openInAntigravity: (project, file) => {
    return ipcRenderer.invoke('antigravity:open', { project, file });
  },
  minimizeToTray: () => {
    ipcRenderer.send('window:minimize-to-tray');
  },
  hideWindow: () => {
    ipcRenderer.send('window:hide');
  },
  openInBrowser: (url) => {
    ipcRenderer.send('window:open-browser', url);
  },
  onTaskFocus: (callback) => {
    const handler = (_event, taskId) => callback(taskId);
    ipcRenderer.on('task:focus', handler);
    return () => {
      ipcRenderer.removeListener('task:focus', handler);
    };
  },
  onNewTask: (callback) => {
    const handler = (_event, task) => callback(task);
    ipcRenderer.on('task:created', handler);
    return () => {
      ipcRenderer.removeListener('task:created', handler);
    };
  },
  onRefreshed: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('tasks:refreshed', handler);
    return () => {
      ipcRenderer.removeListener('tasks:refreshed', handler);
    };
  },
});
