import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  addTask,
  getTasks,
  markReviewed,
  unmarkReviewed,
  deleteTask,
  getStats,
  Task,
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3700;

const app = express();
app.use(cors());
app.use(express.json());

// Set of connected SSE clients for real-time live push
const sseClients = new Set<Response>();

function broadcastSSE(type: string, data: any) {
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// SSE Events stream endpoint
app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);

  sseClients.add(res);

  // Periodic heartbeat every 20 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// Internal notify endpoint used by MCP stdio server
app.post('/api/internal/notify', (req: Request, res: Response) => {
  const { type, task } = req.body;
  if (type === 'task_created' && task) {
    broadcastSSE('task_created', task);
  }
  res.json({ ok: true });
});

// GET /api/tasks
app.get('/api/tasks', (req: Request, res: Response) => {
  const { status, project, limit } = req.query;
  const tasks = getTasks({
    status: (status as any) || 'pending',
    project: project as string,
    limit: limit ? parseInt(limit as string, 10) : undefined,
  });
  res.json(tasks);
});

// POST /api/tasks (Manual task creation or testing)
app.post('/api/tasks', (req: Request, res: Response) => {
  const { project, title, details, files, branch } = req.body;
  if (!project || !title) {
    res.status(400).json({ error: 'Project and title are required.' });
    return;
  }

  const task = addTask({ project, title, details, files, branch });
  broadcastSSE('task_created', task);
  res.status(201).json(task);
});

// POST /api/tasks/:id/review
app.post('/api/tasks/:id/review', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const task = markReviewed(id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  broadcastSSE('task_updated', task);
  res.json(task);
});

// POST /api/tasks/:id/unreview
app.post('/api/tasks/:id/unreview', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const task = unmarkReviewed(id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  broadcastSSE('task_updated', task);
  res.json(task);
});

// DELETE /api/tasks/:id
app.delete('/api/tasks/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const ok = deleteTask(id);
  broadcastSSE('task_deleted', { id });
  res.json({ ok });
});

// GET /api/stats
app.get('/api/stats', (_req: Request, res: Response) => {
  const stats = getStats();
  res.json(stats);
});

// Serve frontend static build if present
const clientDistPath = path.resolve(__dirname, '../../dist/client');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Loopback Server] Listening on http://localhost:${PORT}`);
});
