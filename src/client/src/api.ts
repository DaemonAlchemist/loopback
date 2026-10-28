import { Task, Stats, CreateTaskInput } from './types';

const API_BASE = '/api';

export async function fetchTasks(status: 'pending' | 'reviewed' | 'all' = 'pending', project?: string): Promise<Task[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (project && project !== 'all') params.set('project', project);

  const res = await fetch(`${API_BASE}/tasks?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json();
}

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function markTaskReviewed(id: string): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${id}/review`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to mark task reviewed');
  return res.json();
}

export async function unmarkTaskReviewed(id: string): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${id}/unreview`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to unmark task');
  return res.json();
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete task');
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to create task');
  return res.json();
}

// Subscribe to real-time events via Server-Sent Events
export function subscribeToEvents(onEvent: (event: { type: string; payload: any }) => void): () => void {
  let eventSource: EventSource | null = null;
  let isClosed = false;

  function connect() {
    if (isClosed) return;
    eventSource = new EventSource(`${API_BASE}/events`);

    eventSource.addEventListener('task_created', (e: MessageEvent) => {
      try {
        const task = JSON.parse(e.data);
        onEvent({ type: 'task_created', payload: task });
      } catch (err) {
        console.error('Failed to parse SSE task_created:', err);
      }
    });

    eventSource.addEventListener('task_updated', (e: MessageEvent) => {
      try {
        const task = JSON.parse(e.data);
        onEvent({ type: 'task_updated', payload: task });
      } catch (err) {
        console.error('Failed to parse SSE task_updated:', err);
      }
    });

    eventSource.addEventListener('task_deleted', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        onEvent({ type: 'task_deleted', payload: data });
      } catch (err) {
        console.error('Failed to parse SSE task_deleted:', err);
      }
    });

    eventSource.onerror = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (!isClosed) {
        // Reconnect after 3 seconds
        setTimeout(connect, 3000);
      }
    };
  }

  connect();

  return () => {
    isClosed = true;
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}

// Gentle audio notification synthesized via Web Audio API
export function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.28); // D6

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.18, now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.25);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.5);

    setTimeout(() => {
      ctx.close();
    }, 600);
  } catch (err) {
    // Audio context may be blocked by autoplay policies until user interacts
  }
}

// Open or switch to Antigravity IDE instance (works in both Electron and Web)
export async function openInAntigravity(project: string, file?: string): Promise<{
  success: boolean;
  workspacePath?: string;
  filePath?: string;
  message?: string;
  error?: string;
}> {
  if (window.electronAPI) {
    return window.electronAPI.openInAntigravity(project, file);
  }

  const res = await fetch(`${API_BASE}/antigravity/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, file }),
  });
  if (!res.ok) throw new Error('Failed to open Antigravity');
  return res.json();
}
