import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

// Anchor database location to loopback's installation directory so any agent calling MCP connects to the same DB
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../../');
const DATA_DIR = path.join(ROOT_DIR, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'loopback.db');
export const db = new DatabaseSync(DB_PATH);

// Enable WAL mode for concurrent multi-agent read/write performance
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project TEXT NOT NULL,
    title TEXT NOT NULL,
    details TEXT,
    files TEXT,
    branch TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    reviewed_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project);
  CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
`);

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

export interface CreateTaskInput {
  project: string;
  title: string;
  details?: string;
  files?: string[];
  branch?: string;
}

export function addTask(input: CreateTaskInput): Task {
  const id = crypto.randomUUID();
  const now = Date.now();
  const filesJson = JSON.stringify(input.files || []);

  const stmt = db.prepare(`
    INSERT INTO tasks (id, project, title, details, files, branch, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `);

  stmt.run(
    id,
    input.project.trim(),
    input.title.trim(),
    input.details?.trim() || null,
    filesJson,
    input.branch?.trim() || null,
    now
  );

  return {
    id,
    project: input.project.trim(),
    title: input.title.trim(),
    details: input.details?.trim() || null,
    files: input.files || [],
    branch: input.branch?.trim() || null,
    status: 'pending',
    created_at: now,
    reviewed_at: null,
  };
}

export function getTasks(options: { status?: 'pending' | 'reviewed' | 'all'; project?: string; limit?: number } = {}): Task[] {
  let query = 'SELECT * FROM tasks';
  const conditions: string[] = [];
  const params: any[] = [];

  if (options.status && options.status !== 'all') {
    conditions.push('status = ?');
    params.push(options.status);
  }

  if (options.project && options.project !== 'all') {
    conditions.push('project = ?');
    params.push(options.project);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY created_at DESC';

  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as any[];

  return rows.map((row) => ({
    ...row,
    files: row.files ? JSON.parse(row.files) : [],
  }));
}

export function markReviewed(id: string): Task | null {
  const now = Date.now();
  const stmt = db.prepare(`
    UPDATE tasks
    SET status = 'reviewed', reviewed_at = ?
    WHERE id = ?
  `);
  stmt.run(now, id);

  return getTaskById(id);
}

export function unmarkReviewed(id: string): Task | null {
  const stmt = db.prepare(`
    UPDATE tasks
    SET status = 'pending', reviewed_at = NULL
    WHERE id = ?
  `);
  stmt.run(id);

  return getTaskById(id);
}

export function deleteTask(id: string): boolean {
  const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
  stmt.run(id);
  return true;
}

export function getTaskById(id: string): Task | null {
  const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;
  return {
    ...row,
    files: row.files ? JSON.parse(row.files) : [],
  };
}

export function getStats() {
  const pendingStmt = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'pending'");
  const reviewedStmt = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'reviewed'");
  const projectsStmt = db.prepare(`
    SELECT project, 
           COUNT(*) as total,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM tasks
    GROUP BY project
    ORDER BY total DESC
  `);

  const pending = (pendingStmt.get() as any)?.count || 0;
  const reviewed = (reviewedStmt.get() as any)?.count || 0;
  const projects = projectsStmt.all() as any[];

  return {
    pending,
    reviewed,
    projects,
  };
}
