import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import http from 'node:http';
import { addTask, getTasks, Task } from './db.js';

// Try to notify the live web dashboard if running on port 3700
function notifyDashboard(task: Task) {
  try {
    const data = JSON.stringify({ type: 'task_created', task });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3700,
      path: '/api/internal/notify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 350,
    });
    req.on('error', () => {
      // Silently ignore if web dashboard is closed; DB already has the task
    });
    req.write(data);
    req.end();
  } catch {
    // Non-blocking
  }
}

const server = new McpServer({
  name: 'loopback-mcp',
  version: '1.0.0',
});

// Tool: report_task
server.tool(
  'report_task',
  'Report a completed task or milestone to Loopback for user verification and review before starting new prompts.',
  {
    project: z.string().describe("Project or repository name (e.g. 'current-site-2026/api', 'poser-hair-maker')"),
    title: z.string().describe("Clear, concise headline of what was completed (e.g. 'Added hair geometry exporter')"),
    details: z.string().optional().describe("Markdown details: what was done, testing results, or instructions to verify"),
    files: z.array(z.string()).optional().describe("List of file paths that were created or modified"),
    branch: z.string().optional().describe("Git branch if applicable"),
  },
  async ({ project, title, details, files, branch }) => {
    try {
      const task = addTask({
        project,
        title,
        details,
        files,
        branch,
      });

      notifyDashboard(task);

      return {
        content: [
          {
            type: 'text',
            text: `[Loopback] Task "${title}" recorded under project "${project}" (ID: ${task.id}). User review is pending.`,
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Failed to record task: ${err.message}`,
          },
        ],
      };
    }
  }
);

// Tool: get_pending_tasks
server.tool(
  'get_pending_tasks',
  'List tasks currently pending user review in Loopback.',
  {
    project: z.string().optional().describe('Optional project name to filter by'),
  },
  async ({ project }) => {
    try {
      const tasks = getTasks({ status: 'pending', project });
      const summary = tasks.map((t) => ({
        id: t.id,
        project: t.project,
        title: t.title,
        created_at: new Date(t.created_at).toISOString(),
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Failed to fetch tasks: ${err.message}`,
          },
        ],
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Loopback MCP] Stdio transport active and listening.');
}

main().catch((err) => {
  console.error('[Loopback MCP] Fatal error:', err);
  process.exit(1);
});
