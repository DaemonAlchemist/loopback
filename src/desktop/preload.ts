import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  isElectron: boolean;
  openInAntigravity: (project: string, file?: string) => Promise<{
    success: boolean;
    workspacePath?: string;
    filePath?: string;
    method?: string;
    message?: string;
    error?: string;
  }>;
  minimizeToTray: () => void;
  hideWindow: () => void;
  openInBrowser: (url?: string) => void;
  onTaskFocus: (callback: (taskId: string) => void) => () => void;
  onNewTask: (callback: (task: any) => void) => () => void;
  onRefreshed: (callback: () => void) => () => void;
}

const api: ElectronAPI = {
  isElectron: true,
  openInAntigravity: (project: string, file?: string) => {
    return ipcRenderer.invoke('antigravity:open', { project, file });
  },
  minimizeToTray: () => {
    ipcRenderer.send('window:minimize-to-tray');
  },
  hideWindow: () => {
    ipcRenderer.send('window:hide');
  },
  openInBrowser: (url?: string) => {
    ipcRenderer.send('window:open-browser', url);
  },
  onTaskFocus: (callback: (taskId: string) => void) => {
    const handler = (_event: any, taskId: string) => callback(taskId);
    ipcRenderer.on('task:focus', handler);
    return () => {
      ipcRenderer.removeListener('task:focus', handler);
    };
  },
  onNewTask: (callback: (task: any) => void) => {
    const handler = (_event: any, task: any) => callback(task);
    ipcRenderer.on('task:created', handler);
    return () => {
      ipcRenderer.removeListener('task:created', handler);
    };
  },
  onRefreshed: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('tasks:refreshed', handler);
    return () => {
      ipcRenderer.removeListener('tasks:refreshed', handler);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
