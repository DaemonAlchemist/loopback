# Loopback

> **A minimal task verification inbox and coupled MCP server for background AI agents.**

When you run multiple autonomous agents across projects, they frequently complete tasks while you are away from your keyboard. Instead of scrolling through lengthy chat transcripts, agents report their completion details to **Loopback** via MCP. You get a consolidated inbox to review what was done, inspect modified files, and mark tasks as verified before prompting them again.

---

## Architecture Overview

```
                      ┌──────────────────────┐
                      │    AI Agents         │
                      │  (Multiple projects) │
                      └──────────┬───────────┘
                                 │ MCP stdio
                                 ▼
                      ┌──────────────────────┐
                      │   Loopback MCP SDK   │
                      │  (report_task tool)  │
                      └──────────┬───────────┘
                                 │
           ┌─────────────────────┴─────────────────────┐
           ▼                                           ▼
 ┌───────────────────┐                       ┌───────────────────┐
 │   Shared SQLite   │                       │  Express API /    │
 │ (WAL Concurrency) │◄──────────────────────│   SSE Stream      │
 └───────────────────┘                       └─────────┬─────────┘
                                                       │ Live push
                                                       ▼
                                             ┌───────────────────┐
                                             │ Vite / React App  │
                                             │ (http://localhost:│
                                             │       3700)       │
                                             └───────────────────┘
```

- **Shared Concurrency**: All MCP agent sessions write directly to a shared SQLite database (`data/loopback.db` with WAL mode enabled). Tasks are never lost even if the web dashboard is closed.
- **Real-Time Push**: When the Express server is running, new task completions are broadcast over Server-Sent Events (SSE) with an optional audio chime and live visual pulse.
- **Simple Two-State Workflow**: Purely **"To Verify"** vs. **"Reviewed"**.

---

## 1. Quick Start

### Start the Dashboard Server
```bash
# In p:\Utilities\loopback
yarn build
yarn start
```
The dashboard will be available at: **`http://localhost:3700`**

### Development Mode (Concurrent Vite HMR + Server Watch)
```bash
yarn dev
```

---

## 2. Configuring Agents to Use Loopback MCP

Add Loopback to your global or project-level MCP configuration (e.g., in Antigravity IDE, Claude Desktop, or Cursor):

### Configuration (`mcp_config.json` or client config):
```json
{
  "mcpServers": {
    "loopback": {
      "command": "node",
      "args": [
        "P:/Utilities/loopback/dist/server/mcp.js"
      ]
    }
  }
}
```

---

## 3. MCP Tools Available to Agents

### `report_task`
Call this when completing a milestone or task for user verification.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | string | Yes | Name of the project or repo (e.g. `poser-hair-maker`, `current-site-2026/api`) |
| `title` | string | Yes | Short, clear summary of what was completed |
| `details` | string | No | Markdown-formatted completion notes, test results, verification steps |
| `files` | string[] | No | Array of modified or newly created file paths |
| `branch` | string | No | Git branch name if applicable |

#### Example Agent Tool Call:
```json
{
  "name": "report_task",
  "arguments": {
    "project": "poser-hair-maker",
    "title": "Implemented hair strand geometry exporter",
    "details": "### Summary\n- Converted hair curves into quad ribbon meshes\n- Fixed normal orientation\n- Tests passing with 100% coverage",
    "files": [
      "dist/hair_strands.obj",
      "src/exporter/geometry.ts"
    ],
    "branch": "feature/geometry-exporter"
  }
}
```

### `get_pending_tasks`
Allows an agent to check if it or other agents have pending unreviewed tasks.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project` | string | No | Filter pending tasks by project name |

---

## 4. Dashboard Features

- **Live SSE updates**: New tasks immediately slide into the feed without page reloads.
- **Audio chime**: Gentle notification tone when an agent reports a new completion (toggleable).
- **One-click "Verify & Done"**: Instantly mark tasks as verified.
- **Copy File Paths**: Click any modified file pill to copy its path.
- **Project Filter & Search**: Filter by project or search across titles, files, and markdown notes.
- **Reviewed History**: Access past verified tasks with one-click "Reopen" if needed.
