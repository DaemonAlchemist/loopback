import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  ipcMain,
  shell,
  screen,
  nativeImage,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { spawn, ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createTrayIconWithBadge, getBaseAppIcon } from './badge.js';
import {
  openInAntigravity,
  resolveWorkspacePath,
} from '../shared/antigravity.js';
import { getStats, getTasks, markReviewed } from '../server/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tray: Tray | null = null;
let flyoutWindow: BrowserWindow | null = null;
let isQuitting = false;
let pendingCount = 0;
let sseReq: http.ClientRequest | null = null;
let serverChild: ChildProcess | null = null;

async function isServerRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:3700/api/stats', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureServerRunning() {
  const running = await isServerRunning();
  if (running) return;

  const serverJs = path.resolve(process.cwd(), 'dist', 'server', 'server.js');
  if (fs.existsSync(serverJs)) {
    serverChild = spawn('node', [serverJs], {
      stdio: 'ignore',
      detached: false,
      shell: true,
      env: { ...process.env, PORT: '3700' },
    });
  }
}

// Set Application ID on Windows for crisp Action Center toast notifications
if (process.platform === 'win32') {
  app.setAppUserModelId('Google.Antigravity.Loopback');
}

/**
 * Update the system tray icon, badge counter, and context menu
 */
function updateTray() {
  if (!tray) return;

  try {
    const stats = getStats();
    pendingCount = stats.pending;

    // 1. Update dynamic tray icon with badge counter overlay
    const icon = createTrayIconWithBadge(pendingCount);
    tray.setImage(icon);

    // 2. Update tooltip
    const tooltip =
      pendingCount === 0
        ? 'Loopback | All tasks verified'
        : `Loopback: ${pendingCount} unreviewed task${pendingCount === 1 ? '' : 's'}`;
    tray.setToolTip(tooltip);

    // 3. Build context menu with quick pending task list
    const pendingTasks = getTasks({ status: 'pending', limit: 5 });

    const taskMenuItems: Electron.MenuItemConstructorOptions[] = pendingTasks.map((t) => ({
      label: `[${t.project}] ${t.title.length > 36 ? t.title.slice(0, 36) + '...' : t.title}`,
      click: () => {
        showFlyoutWindow(t.id);
      },
    }));

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Loopback - Agent Task Inbox',
        enabled: false,
      },
      {
        label:
          pendingCount === 0
            ? '✓ All caught up (0 pending)'
            : `🔔 ${pendingCount} task${pendingCount === 1 ? '' : 's'} to verify`,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Open Task Flyout',
        click: () => toggleFlyoutWindow(),
      },
      {
        label: 'Open Web Dashboard (Browser)',
        click: () => {
          shell.openExternal('http://localhost:3700');
        },
      },
      ...(taskMenuItems.length > 0
        ? [
            { type: 'separator' } as Electron.MenuItemConstructorOptions,
            { label: 'Pending Tasks:', enabled: false },
            ...taskMenuItems,
          ]
        : []),
      { type: 'separator' },
      {
        label: 'Mark All as Verified',
        enabled: pendingCount > 0,
        click: () => {
          const tasks = getTasks({ status: 'pending' });
          for (const t of tasks) {
            markReviewed(t.id);
          }
          updateTray();
          if (flyoutWindow && !flyoutWindow.isDestroyed()) {
            flyoutWindow.webContents.send('tasks:refreshed');
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit Loopback Tray',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);
  } catch (err) {
    console.error('[Loopback Tray] Error updating tray:', err);
  }
}

/**
 * Calculate flyout window coordinates near the Windows system tray
 */
function positionWindowNearTray(win: BrowserWindow) {
  if (!tray) {
    win.center();
    return;
  }

  const trayBounds = tray.getBounds();
  const [winWidth, winHeight] = win.getSize();
  const display =
    screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y }) ||
    screen.getPrimaryDisplay();
  const { x: areaX, y: areaY, width: areaWidth, height: areaHeight } = display.workArea;

  // Horizontal positioning: align with tray icon and clamp inside work area
  let x: number;
  if (winWidth >= areaWidth) {
    x = areaX;
  } else {
    x = Math.round(trayBounds.x + trayBounds.width / 2 - winWidth / 2);
    if (x + winWidth > areaX + areaWidth - 12) {
      x = areaX + areaWidth - winWidth - 12;
    }
    if (x < areaX + 12) {
      x = areaX + 12;
    }
  }

  // Vertical positioning: default above bottom tray or below top tray
  let y = Math.round(trayBounds.y - winHeight - 12);
  if (trayBounds.y < areaY + areaHeight / 2) {
    // If tray is at the top of screen
    y = trayBounds.y + trayBounds.height + 12;
  } else if (y < areaY + 12) {
    y = areaY + 12;
  }

  if (y + winHeight > areaY + areaHeight - 12) {
    y = Math.max(areaY + 12, areaY + areaHeight - winHeight - 12);
  }

  win.setPosition(x, y);
}

/**
 * Show and position the flyout window, optionally focusing a specific task
 */
function showFlyoutWindow(focusTaskId?: string) {
  if (!flyoutWindow || flyoutWindow.isDestroyed()) {
    createFlyoutWindow();
  }

  if (flyoutWindow) {
    positionWindowNearTray(flyoutWindow);
    flyoutWindow.setSkipTaskbar(false);
    flyoutWindow.show();
    flyoutWindow.focus();

    if (focusTaskId) {
      flyoutWindow.webContents.send('task:focus', focusTaskId);
    }
  }
}

/**
 * Toggle flyout window visibility on tray click
 */
function toggleFlyoutWindow() {
  if (!flyoutWindow || flyoutWindow.isDestroyed()) {
    showFlyoutWindow();
    return;
  }

  if (flyoutWindow.isVisible()) {
    flyoutWindow.hide();
    flyoutWindow.setSkipTaskbar(true);
  } else {
    showFlyoutWindow();
  }
}

/**
 * Trigger native Windows Toast Notification
 */
function sendNativeToast(task: { id: string; project: string; title: string; details?: string | null; files?: string[] }) {
  if (!Notification.isSupported()) return;

  const title = `Agent finished: [${task.project}] ${task.title}`;

  let body = '';
  if (task.details) {
    // Strip markdown formatting for toast body
    body = task.details.replace(/[#*`_~>[\]]/g, '').slice(0, 140).trim();
  } else if (task.files && task.files.length > 0) {
    body = `Modified ${task.files.length} file${task.files.length === 1 ? '' : 's'}: ${task.files.slice(0, 2).join(', ')}`;
  } else {
    body = 'Ready for review and verification.';
  }

  const icon = getBaseAppIcon();

  const notification = new Notification({
    title,
    body,
    icon,
    silent: false, // Plays native Windows notification chime
    urgency: 'normal',
  });

  notification.on('click', () => {
    showFlyoutWindow(task.id);
  });

  notification.show();
}

/**
 * Create the compact flyout desktop window
 */
function createFlyoutWindow() {
  const preloadPath = path.resolve(__dirname, 'preload.cjs');
  const fallbackPreloadPath = path.resolve(__dirname, 'preload.js');

  const activePreload = fs.existsSync(preloadPath) ? preloadPath : fallbackPreloadPath;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const defaultWidth = Math.min(1024, screenWidth);
  const defaultHeight = Math.min(760, screenHeight - 60);

  flyoutWindow = new BrowserWindow({
    width: defaultWidth,
    height: defaultHeight,
    minWidth: 480,
    minHeight: 500,
    show: false,
    frame: false, // Frameless modern flyout with custom draggable header
    resizable: true,
    skipTaskbar: true,
    alwaysOnTop: false,
    backgroundColor: '#0a0d14',
    icon: getBaseAppIcon(),
    webPreferences: {
      preload: activePreload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Load URL: try Vite dev server (5173), Express server (3700), or built index.html
  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
  const targetUrl = isDev
    ? 'http://localhost:5173?mode=flyout'
    : 'http://localhost:3700?mode=flyout';

  flyoutWindow.loadURL(targetUrl).catch(() => {
    // Fallback: check static build in dist/client/index.html
    const localDist = path.resolve(__dirname, '../client/index.html');
    if (fs.existsSync(localDist)) {
      flyoutWindow?.loadFile(localDist, { query: { mode: 'flyout' } });
    }
  });

  // Hide on close instead of destroying
  flyoutWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      flyoutWindow?.hide();
      flyoutWindow?.setSkipTaskbar(true);
    }
  });

  // Hide if clicked outside (optional blur behavior)
  flyoutWindow.on('blur', () => {
    // If not pinned, can auto-hide or keep open; let user close or minimize
  });
}

/**
 * Real-time SSE subscriber to localhost:3700/api/events
 */
function connectToEventStream() {
  const req = http.get('http://127.0.0.1:3700/api/events', (res) => {
    let buffer = '';

    res.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = 'message';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            handleServerEvent(currentEvent, data);
          } catch {
            // Ignore parse errors on heartbeats
          }
        }
      }
    });

    res.on('end', () => {
      // Reconnect after 3 seconds
      setTimeout(connectToEventStream, 3000);
    });
  });

  req.on('error', () => {
    // Server might be starting up; retry silently
    setTimeout(connectToEventStream, 4000);
  });

  sseReq = req;
}

/**
 * Handle incoming server push events
 */
function handleServerEvent(event: string, payload: any) {
  if (event === 'task_created') {
    // 1. Trigger native Windows Toast notification
    sendNativeToast(payload);

    // 2. Update system tray badge counter
    updateTray();

    // 3. Notify renderer if window is open
    if (flyoutWindow && !flyoutWindow.isDestroyed()) {
      flyoutWindow.webContents.send('task:created', payload);
    }
  } else if (event === 'task_updated' || event === 'task_deleted') {
    updateTray();
    if (flyoutWindow && !flyoutWindow.isDestroyed()) {
      flyoutWindow.webContents.send('tasks:refreshed');
    }
  }
}

/**
 * Setup IPC Handlers
 */
function setupIPC() {
  // Switch / Go to Antigravity instance
  ipcMain.handle('antigravity:open', async (_event, { project, file }) => {
    // Hide the flyout window so that the target Antigravity window takes full foreground focus
    if (flyoutWindow && !flyoutWindow.isDestroyed() && flyoutWindow.isVisible()) {
      flyoutWindow.hide();
      flyoutWindow.setSkipTaskbar(true);
    }
    return await openInAntigravity(project, file);
  });

  // Window control
  ipcMain.on('window:minimize-to-tray', () => {
    if (flyoutWindow) {
      flyoutWindow.hide();
      flyoutWindow.setSkipTaskbar(true);
    }
  });

  ipcMain.on('window:hide', () => {
    if (flyoutWindow) {
      flyoutWindow.hide();
      flyoutWindow.setSkipTaskbar(true);
    }
  });

  ipcMain.on('window:open-browser', (_event, url) => {
    shell.openExternal(url || 'http://localhost:3700');
  });
}

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone launched a second instance; reveal the flyout window
    showFlyoutWindow();
  });

  app.whenReady().then(async () => {
    setupIPC();

    // Ensure Loopback API/SSE server is running for autonomous agents
    await ensureServerRunning();

    // Setup System Tray
    tray = new Tray(createTrayIconWithBadge(0));
    tray.on('click', () => {
      toggleFlyoutWindow();
    });
    tray.on('double-click', () => {
      showFlyoutWindow();
    });

    createFlyoutWindow();
    updateTray();

    // Start listening to real-time events from Loopback server
    connectToEventStream();

    // Periodic check every 30 seconds to keep tray badge synchronized
    setInterval(() => {
      updateTray();
    }, 30000);
  });

  app.on('before-quit', () => {
    isQuitting = true;
    if (serverChild) {
      try {
        serverChild.kill();
      } catch {}
    }
  });

  app.on('window-all-closed', () => {
    // Do NOT quit when all windows are closed; app lives quietly in Windows tray
  });
}
