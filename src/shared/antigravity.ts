import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to Antigravity IDE executable and CLI shim
const ANTIGRAVITY_EXE = 'C:\\Users\\andy\\AppData\\Local\\Programs\\Antigravity IDE\\Antigravity IDE.exe';
const ANTIGRAVITY_CMD = 'C:\\Users\\andy\\AppData\\Local\\Programs\\Antigravity IDE\\bin\\antigravity-ide.cmd';
const STORAGE_PATH = 'C:\\Users\\andy\\AppData\\Roaming\\Antigravity IDE\\User\\globalStorage\\storage.json';
const MAPPINGS_FILE = path.resolve(process.cwd(), 'data', 'workspace-mappings.json');
const POWERSHELL_EXE = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';

export interface WorkspaceInfo {
  name: string;
  path: string;
  isOpen: boolean;
}

export interface OpenAntigravityResult {
  success: boolean;
  workspacePath?: string;
  filePath?: string;
  method?: string;
  message?: string;
  error?: string;
}

/**
 * Retrieve custom user-configured project -> workspace mappings
 */
export function getCustomMappings(): Record<string, string> {
  try {
    if (fs.existsSync(MAPPINGS_FILE)) {
      return JSON.parse(fs.readFileSync(MAPPINGS_FILE, 'utf8'));
    }
  } catch {
    // Ignore corrupt or unreadable mappings
  }
  return {};
}

/**
 * Save custom project -> workspace mapping
 */
export function saveCustomMapping(project: string, workspacePath: string): void {
  try {
    const dir = path.dirname(MAPPINGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const mappings = getCustomMappings();
    mappings[project.toLowerCase().trim()] = path.normalize(workspacePath.trim());
    fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(mappings, null, 2), 'utf8');
  } catch (err) {
    console.error('[Antigravity] Failed to save custom mapping:', err);
  }
}

/**
 * Read currently opened and recently opened workspaces from Antigravity IDE's storage.json
 */
export function getOpenedWorkspaces(): string[] {
  if (!fs.existsSync(STORAGE_PATH)) return [];
  try {
    const raw = fs.readFileSync(STORAGE_PATH, 'utf8');
    const data = JSON.parse(raw);
    const opened = data.windowsState?.openedWindows || [];

    return opened
      .map((entry: any) => {
        if (!entry || !entry.folder) return null;
        try {
          const u = new URL(entry.folder);
          let decoded = decodeURIComponent(u.pathname);
          // Windows path: remove leading slash before drive letter (/p:/ -> p:/)
          if (decoded.startsWith('/') && decoded.length > 2 && decoded[2] === ':') {
            decoded = decoded.slice(1);
          }
          return path.normalize(decoded);
        } catch {
          return null;
        }
      })
      .filter((p: string | null): p is string => Boolean(p && fs.existsSync(p)));
  } catch (err) {
    console.error('[Antigravity] Error reading opened workspaces:', err);
    return [];
  }
}

/**
 * Known common parent directories on Windows drives
 */
const COMMON_PARENT_DIRS = [
  'P:\\Utilities',
  'P:\\Darkwynd',
  'P:\\WebApp Projects',
  'P:\\AI',
  'P:\\Games',
  'P:\\Libraries',
  'P:\\Experiments',
  'O:\\Anime',
  'C:\\Users\\andy\\source\\repos',
];

/**
 * Resolves a project name (e.g. 'current-site-2026/api', 'poser-hair-maker', 'atc/typescript')
 * to an absolute filesystem workspace path.
 */
export function resolveWorkspacePath(project: string): string | null {
  if (!project) return null;

  const normalizedProj = project.replace(/\\/g, '/').toLowerCase().trim();
  const projParts = normalizedProj.split('/').filter(Boolean);
  const mainProjName = projParts[0];

  // 1. Check custom saved mappings first
  const customMappings = getCustomMappings();
  if (customMappings[normalizedProj] && fs.existsSync(customMappings[normalizedProj])) {
    return customMappings[normalizedProj];
  }
  if (customMappings[mainProjName] && fs.existsSync(customMappings[mainProjName])) {
    return customMappings[mainProjName];
  }

  // 2. Check opened workspaces in Antigravity IDE
  const openedWorkspaces = getOpenedWorkspaces();

  // 2a. Match opened workspace ending with full project string (e.g. .../poser-hair-maker)
  for (const ws of openedWorkspaces) {
    const wsNorm = ws.replace(/\\/g, '/').toLowerCase();
    if (wsNorm.endsWith('/' + normalizedProj) || wsNorm === normalizedProj) {
      return ws;
    }
  }

  // 2b. Match primary project name against open workspaces (e.g. 'atc' from 'atc/typescript')
  // We MUST return the open workspace root so Antigravity focuses that active window!
  for (const ws of openedWorkspaces) {
    const wsNorm = ws.replace(/\\/g, '/').toLowerCase();
    const wsBase = path.basename(ws).toLowerCase();
    if (wsBase === mainProjName || wsNorm.endsWith('/' + mainProjName)) {
      return ws;
    }
  }

  // 3. Check common parent directories
  for (const parent of COMMON_PARENT_DIRS) {
    const candidateMain = path.join(parent, mainProjName);
    if (fs.existsSync(candidateMain)) {
      return candidateMain;
    }

    const candidateFull = path.join(parent, ...projParts);
    if (fs.existsSync(candidateFull)) {
      return candidateFull;
    }
  }

  // 4. Check if project is directly an absolute path
  if (path.isAbsolute(project) && fs.existsSync(project)) {
    return path.normalize(project);
  }

  return null;
}

/**
 * Resolves a file path against a resolved workspace path and project context
 */
export function resolveFilePath(workspacePath: string | null, file?: string, project?: string): string | null {
  if (!file) return null;

  // If already absolute and exists
  if (path.isAbsolute(file) && fs.existsSync(file)) {
    return path.normalize(file);
  }

  if (workspacePath) {
    // 1. Direct join with workspace
    const direct = path.join(workspacePath, file);
    if (fs.existsSync(direct)) {
      return path.normalize(direct);
    }

    // 2. If project contains subdirectories (e.g. 'atc/typescript', check 'P:\Libraries\atc\typescript\...')
    if (project) {
      const parts = project.replace(/\\/g, '/').split('/').filter(Boolean);
      if (parts.length > 1) {
        const sub = path.join(workspacePath, ...parts.slice(1), file);
        if (fs.existsSync(sub)) {
          return path.normalize(sub);
        }
      }
    }

    return path.normalize(direct);
  }

  return null;
}

/**
 * Activate the Antigravity IDE window using the native PowerShell helper
 */
function activateAntigravityWindow(workspaceName: string, targetFile?: string) {
  try {
    const localScript = path.resolve(__dirname, 'focus-window.ps1');
    const srcScript = path.resolve(process.cwd(), 'src', 'shared', 'focus-window.ps1');
    const scriptPath = fs.existsSync(localScript) ? localScript : srcScript;
    const psExe = fs.existsSync(POWERSHELL_EXE) ? POWERSHELL_EXE : 'powershell.exe';

    const args = [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      '-WorkspaceName',
      workspaceName,
      '-TargetFile',
      targetFile || '',
    ];

    // Fire immediately to raise the window
    execFile(psExe, args, () => {});

    // Re-trigger after 350ms to ensure focus sticks after Antigravity finishes IPC processing
    setTimeout(() => {
      execFile(psExe, args, () => {});
    }, 350);
  } catch (err) {
    console.error('[Antigravity] Error activating window:', err);
  }
}

/**
 * Open or switch to the relevant Antigravity instance for a project / workspace
 */
export async function openInAntigravity(project: string, file?: string): Promise<OpenAntigravityResult> {
  try {
    const workspacePath = resolveWorkspacePath(project);
    const resolvedFile = resolveFilePath(workspacePath, file, project);

    const targetPath = resolvedFile || workspacePath;

    if (!targetPath && !workspacePath) {
      return {
        success: false,
        error: `Could not locate workspace for project "${project}".`,
      };
    }

    const finalPath = resolvedFile || workspacePath!;
    const workspaceName = workspacePath ? path.basename(workspacePath) : project.split('/')[0];

    // Construct arguments: DO NOT pass -r so Antigravity targets the existing matching workspace window
    let exeArgs: string[];
    if (resolvedFile) {
      // Go to specific file
      exeArgs = ['-g', finalPath];
    } else {
      // Open / switch to workspace folder
      exeArgs = [finalPath];
    }

    let method = 'none';

    // 1. Launch / signal Antigravity IDE directly via executable
    if (fs.existsSync(ANTIGRAVITY_EXE)) {
      method = 'executable';
      const child = spawn(ANTIGRAVITY_EXE, exeArgs, {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    } else if (fs.existsSync(ANTIGRAVITY_CMD)) {
      method = 'cli';
      const child = spawn('cmd.exe', ['/c', ANTIGRAVITY_CMD, ...exeArgs], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    } else {
      method = 'explorer';
      const child = spawn('explorer.exe', [finalPath], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    }

    // 2. Force Windows to bring the Antigravity window to the foreground
    activateAntigravityWindow(workspaceName, resolvedFile || undefined);

    return {
      success: true,
      workspacePath: workspacePath || undefined,
      filePath: resolvedFile || undefined,
      method,
      message: resolvedFile
        ? `Focused "${path.basename(resolvedFile)}" in Antigravity [${workspaceName}].`
        : `Switched to Antigravity workspace [${workspaceName}].`,
    };
  } catch (err: any) {
    console.error('[Antigravity] Failed to open workspace:', err);
    return {
      success: false,
      error: err.message || 'Unknown error opening Antigravity',
    };
  }
}
