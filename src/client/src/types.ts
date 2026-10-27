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
