export interface Task {
  id: string;
  project: string;
  title: string;
  details: string | null;
  files: string[];
  branch: string | null;
  status: 'pending' | 'reviewed';
  created_at: number;
  reviewed_at: number | null;
}

export interface Stats {
  pending: number;
  reviewed: number;
  projects: {
    project: string;
    total: number;
    pending: number;
  }[];
}

export interface CreateTaskInput {
  project: string;
  title: string;
  details?: string;
  files?: string[];
  branch?: string;
}

export interface AntigravityOpenResult {
  success: boolean;
  workspacePath?: string;
  filePath?: string;
  method?: string;
  message?: string;
  error?: string;
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      openInAntigravity: (project: string, file?: string) => Promise<AntigravityOpenResult>;
      minimizeToTray: () => void;
      hideWindow: () => void;
      openInBrowser: (url?: string) => void;
      onTaskFocus: (callback: (taskId: string) => void) => () => void;
      onNewTask: (callback: (task: any) => void) => () => void;
      onRefreshed: (callback: () => void) => () => void;
    };
  }
}
