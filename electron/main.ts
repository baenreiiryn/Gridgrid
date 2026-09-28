import { app, BrowserWindow, dialog, ipcMain, WebContentsView, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  AppState,
  FileOperationResult,
  GamePresetId,
  LayoutMode,
  PanelBounds,
  PanelConfig,
  WorkspaceConfig
} from './types';
import { loadState, saveState } from './store';
import { checkForUpdates, getUpdateStatus, installDownloadedUpdate, setupAutoUpdater } from './updater';

const PANEL_COLORS = ['#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6'];
const DEFAULT_URL = 'https://huntera.com.br/';
const VALID_LAYOUTS = new Set<LayoutMode>(['auto', 'columns', 'rows', 'focus']);

let mainWindow: BrowserWindow | null = null;
let state: AppState;
const panelViews = new Map<string, WebContentsView>();

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return DEFAULT_URL;
  try {
    return new URL(trimmed).toString();
  } catch {
    return new URL(`https://${trimmed}`).toString();
  }
}

function normalizeColor(input: unknown, fallback = '#8b5cf6'): string {
  return typeof input === 'string' && /^#[0-9a-f]{6}$/i.test(input) ? input : fallback;
}

function normalizePreset(input: unknown, url: string): GamePresetId {
  if (input === 'huntera' || input === 'custom') return input;
  return url.includes('huntera.com.br') ? 'huntera' : 'custom';
}

function normalizeLayout(input: unknown): LayoutMode {
  return typeof input === 'string' && VALID_LAYOUTS.has(input as LayoutMode) ? input as LayoutMode : 'auto';
}

function getWorkspace(workspaceId: string): WorkspaceConfig | undefined {
  return state.workspaces.find((workspace) => workspace.id === workspaceId);
}

function getPanel(panelId: string): { workspaceId: string; panel: PanelConfig } | undefined {
  for (const workspace of state.workspaces) {
    const panel = workspace.panels.find((item) => item.id === panelId);
    if (panel) return { workspaceId: workspace.id, panel };
  }
  return undefined;
}

function persistAndSync(): AppState {
  saveState(state);
  syncViewsWithState();
  return state;
}

function createPanelView(panel: PanelConfig): WebContentsView {
  const view = new WebContentsView({
    webPreferences: {
      partition: `persist:gridgrid-${panel.id}`,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  view.setBackgroundColor('#0b0f17');
  view.webContents.setAudioMuted(panel.muted);
  view.webContents.setZoomFactor(panel.zoom);

  // OAuth providers such as Google Identity Services rely on a real popup that
  // keeps its relationship with the opener. Loading the popup URL in the panel
  // itself breaks the callback flow.
  view.webContents.setWindowOpenHandler(({ url }) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { action: 'deny' };
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { action: 'deny' };
    }

    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 520,
        height: 700,
        autoHideMenuBar: true,
        backgroundColor: '#ffffff'
      }
    };
  });

  view.webContents.on('did-navigate', (_event, url) => {
    const located = getPanel(panel.id);
    if (!located) return;
    located.panel.url = url;
    saveState(state);
  });

  void view.webContents.loadURL(normalizeUrl(panel.url));
  return view;
}

function destroyPanelView(panelId: string): void {
  const view = panelViews.get(panelId);
  if (!view) return;
  try {
    mainWindow?.contentView.removeChildView(view);
  } catch {
    // already detached
  }
  if (!view.webContents.isDestroyed()) view.webContents.close();
  panelViews.delete(panelId);
}

function syncViewsWithState(): void {
  if (!mainWindow) return;
  const desiredIds = new Set(state.workspaces.flatMap((workspace) => workspace.panels.map((panel) => panel.id)));

  for (const panelId of panelViews.keys()) {
    if (!desiredIds.has(panelId)) destroyPanelView(panelId);
  }

  for (const workspace of state.workspaces) {
    for (const panel of workspace.panels) {
      let view = panelViews.get(panel.id);
      if (!view) {
        view = createPanelView(panel);
        panelViews.set(panel.id, view);
        mainWindow.contentView.addChildView(view);
      }
      view.webContents.setAudioMuted(panel.muted);
      if (Math.abs(view.webContents.getZoomFactor() - panel.zoom) > 0.001) {
        view.webContents.setZoomFactor(panel.zoom);
      }
    }
  }

  for (const [panelId, view] of panelViews) {
    const located = getPanel(panelId);
    const active = located?.workspaceId === state.activeWorkspaceId;
    view.setVisible(Boolean(active));
  }
}

function createMainWindow(): void {
  const savedBounds = state.windowBounds;
  mainWindow = new BrowserWindow({
    x: savedBounds?.x,
    y: savedBounds?.y,
    width: savedBounds?.width ?? 1440,
    height: savedBounds?.height ?? 900,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: '#080b11',
    title: 'Gridgrid',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.setMenuBarVisibility(false);
  if (savedBounds?.maximized) mainWindow.maximize();

  const devUrl = process.env.GRIDGRID_DEV_URL;
  if (devUrl) void mainWindow.loadURL(devUrl);
  else void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  mainWindow.webContents.on('did-finish-load', () => syncViewsWithState());

  mainWindow.on('close', () => {
    if (!mainWindow) return;
    const bounds = mainWindow.getNormalBounds();
    state.windowBounds = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      maximized: mainWindow.isMaximized()
    };
    saveState(state);
  });

  mainWindow.on('closed', () => {
    for (const panelId of [...panelViews.keys()]) destroyPanelView(panelId);
    mainWindow = null;
  });
}

function exportableWorkspace(workspace: WorkspaceConfig) {
  return {
    name: workspace.name,
    layout: workspace.layout,
    panels: workspace.panels.map(({ id: _id, ...panel }) => panel)
  };
}

async function exportWorkspace(workspaceId: string): Promise<FileOperationResult> {
  const workspace = getWorkspace(workspaceId);
  if (!workspace) return { ok: false, message: 'Workspace não encontrado.' };

  const options: SaveDialogOptions = {
    title: 'Exportar workspace',
    defaultPath: `${workspace.name.replace(/[\\/:*?"<>|]/g, '_')}.gridgrid.json`,
    filters: [
      { name: 'Gridgrid Workspace', extensions: ['json'] }
    ]
  };

  const result = mainWindow
    ? await dialog.showSaveDialog(mainWindow, options)
    : await dialog.showSaveDialog(options);

  if (result.canceled || !result.filePath) return { ok: false, canceled: true };

  const payload = {
    format: 'gridgrid-workspace',
    version: 1,
    exportedAt: new Date().toISOString(),
    note: 'Session cookies and authentication data are intentionally not included.',
    workspace: exportableWorkspace(workspace)
  };

  fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2), 'utf8');
  return { ok: true, path: result.filePath };
}

async function importWorkspace(): Promise<FileOperationResult> {
  const options: OpenDialogOptions = {
    title: 'Importar workspace',
    properties: ['openFile'],
    filters: [
      { name: 'Gridgrid Workspace', extensions: ['json'] }
    ]
  };

  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };

  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf8');
    const parsed = JSON.parse(raw) as {
      format?: string;
      version?: number;
      workspace?: {
        name?: unknown;
        layout?: unknown;
        panels?: unknown;
      };
    };

    if (parsed.format !== 'gridgrid-workspace' || parsed.version !== 1 || !parsed.workspace) {
      return { ok: false, message: 'Este arquivo não é um workspace Gridgrid válido.' };
    }

    const sourcePanels = Array.isArray(parsed.workspace.panels) ? parsed.workspace.panels : [];
    const workspaceId = randomUUID();
    const panels: PanelConfig[] = sourcePanels
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item, index) => {
        const url = normalizeUrl(typeof item.url === 'string' ? item.url : DEFAULT_URL);
        return {
          id: randomUUID(),
          name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : `Conta ${index + 1}`,
          url,
          color: normalizeColor(item.color, PANEL_COLORS[index % PANEL_COLORS.length]),
          zoom: typeof item.zoom === 'number' ? Math.min(2, Math.max(0.35, item.zoom)) : 1,
          muted: Boolean(item.muted),
          presetId: normalizePreset(item.presetId, url)
        };
      });

    const workspace: WorkspaceConfig = {
      id: workspaceId,
      name: typeof parsed.workspace.name === 'string' && parsed.workspace.name.trim()
        ? `${parsed.workspace.name.trim()} (importado)`
        : 'Workspace importado',
      layout: normalizeLayout(parsed.workspace.layout),
      focusedPanelId: panels[0]?.id,
      panels
    };

    state.workspaces.push(workspace);
    state.activeWorkspaceId = workspaceId;
    persistAndSync();

    return { ok: true, path: result.filePaths[0], state };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Não foi possível importar o workspace.'
    };
  }
}

function registerIpc(): void {
  ipcMain.handle('gridgrid:get-state', () => state);
  ipcMain.handle('gridgrid:get-app-version', () => app.getVersion());
  ipcMain.handle('gridgrid:get-update-status', () => getUpdateStatus());
  ipcMain.handle('gridgrid:check-for-updates', () => checkForUpdates());
  ipcMain.handle('gridgrid:install-update', () => installDownloadedUpdate());

  ipcMain.handle('gridgrid:set-active-workspace', (_event, workspaceId: string) => {
    if (getWorkspace(workspaceId)) state.activeWorkspaceId = workspaceId;
    return persistAndSync();
  });

  ipcMain.handle('gridgrid:add-workspace', (_event, name?: string) => {
    const id = randomUUID();
    state.workspaces.push({
      id,
      name: name?.trim() || `Workspace ${state.workspaces.length + 1}`,
      layout: 'auto',
      panels: []
    });
    state.activeWorkspaceId = id;
    return persistAndSync();
  });

  ipcMain.handle('gridgrid:rename-workspace', (_event, workspaceId: string, name: string) => {
    const workspace = getWorkspace(workspaceId);
    if (workspace && name.trim()) workspace.name = name.trim();
    return persistAndSync();
  });

  ipcMain.handle('gridgrid:remove-workspace', (_event, workspaceId: string) => {
    if (state.workspaces.length <= 1) return state;
    state.workspaces = state.workspaces.filter((workspace) => workspace.id !== workspaceId);
    if (!getWorkspace(state.activeWorkspaceId)) state.activeWorkspaceId = state.workspaces[0].id;
    return persistAndSync();
  });

  ipcMain.handle('gridgrid:set-layout', (_event, workspaceId: string, layout: LayoutMode) => {
    const workspace = getWorkspace(workspaceId);
    if (workspace && VALID_LAYOUTS.has(layout)) workspace.layout = layout;
    return persistAndSync();
  });

  ipcMain.handle('gridgrid:focus-panel', (_event, workspaceId: string, panelId: string) => {
    const workspace = getWorkspace(workspaceId);
    if (workspace?.panels.some((panel) => panel.id === panelId)) workspace.focusedPanelId = panelId;
    return persistAndSync();
  });

  ipcMain.handle('gridgrid:add-panel', (_event, workspaceId: string, partial?: Partial<PanelConfig>) => {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) return state;
    const id = randomUUID();
    const index = workspace.panels.length;
    const url = normalizeUrl(partial?.url || DEFAULT_URL);
    const panel: PanelConfig = {
      id,
      name: partial?.name?.trim() || `Conta ${index + 1}`,
      url,
      color: normalizeColor(partial?.color, PANEL_COLORS[index % PANEL_COLORS.length]),
      zoom: Math.min(2, Math.max(0.35, partial?.zoom ?? 1)),
      muted: partial?.muted ?? false,
      presetId: normalizePreset(partial?.presetId, url)
    };
    workspace.panels.push(panel);
    workspace.focusedPanelId = id;
    return persistAndSync();
  });

  ipcMain.handle('gridgrid:update-panel', (_event, workspaceId: string, panelId: string, patch: Partial<PanelConfig>) => {
    const workspace = getWorkspace(workspaceId);
    const panel = workspace?.panels.find((item) => item.id === panelId);
    if (!panel) return state;

    if (typeof patch.name === 'string' && patch.name.trim()) panel.name = patch.name.trim();
    if (typeof patch.url === 'string' && patch.url.trim()) panel.url = normalizeUrl(patch.url);
    if (typeof patch.color === 'string') panel.color = normalizeColor(patch.color, panel.color);
    if (typeof patch.muted === 'boolean') panel.muted = patch.muted;
    if (typeof patch.zoom === 'number') panel.zoom = Math.min(2, Math.max(0.35, patch.zoom));
    if (patch.presetId === 'huntera' || patch.presetId === 'custom') panel.presetId = patch.presetId;

    const view = panelViews.get(panelId);
    if (view) {
      view.webContents.setAudioMuted(panel.muted);
      view.webContents.setZoomFactor(panel.zoom);
    }

    return persistAndSync();
  });

  ipcMain.handle('gridgrid:reorder-panels', (_event, workspaceId: string, orderedPanelIds: string[]) => {
    const workspace = getWorkspace(workspaceId);
    if (!workspace || !Array.isArray(orderedPanelIds)) return state;

    const currentIds = new Set(workspace.panels.map((panel) => panel.id));
    const requestedIds = new Set(orderedPanelIds);
    if (currentIds.size !== requestedIds.size || [...currentIds].some((id) => !requestedIds.has(id))) return state;

    const byId = new Map(workspace.panels.map((panel) => [panel.id, panel]));
    workspace.panels = orderedPanelIds.map((id) => byId.get(id)).filter((panel): panel is PanelConfig => Boolean(panel));
    return persistAndSync();
  });

  ipcMain.handle('gridgrid:remove-panel', (_event, workspaceId: string, panelId: string) => {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) return state;
    workspace.panels = workspace.panels.filter((panel) => panel.id !== panelId);
    if (workspace.focusedPanelId === panelId) workspace.focusedPanelId = workspace.panels[0]?.id;
    destroyPanelView(panelId);
    return persistAndSync();
  });

  ipcMain.handle('gridgrid:reload-panel', (_event, panelId: string) => {
    panelViews.get(panelId)?.webContents.reload();
  });

  ipcMain.handle('gridgrid:navigate-panel', async (_event, panelId: string, url: string) => {
    const located = getPanel(panelId);
    const view = panelViews.get(panelId);
    if (!located || !view) return;
    located.panel.url = normalizeUrl(url);
    if (!located.panel.url.includes('huntera.com.br')) located.panel.presetId = 'custom';
    saveState(state);
    await view.webContents.loadURL(located.panel.url);
  });

  ipcMain.handle('gridgrid:open-devtools', (_event, panelId: string) => {
    panelViews.get(panelId)?.webContents.openDevTools({ mode: 'detach' });
  });

  ipcMain.handle('gridgrid:export-workspace', (_event, workspaceId: string) => exportWorkspace(workspaceId));
  ipcMain.handle('gridgrid:import-workspace', () => importWorkspace());

  ipcMain.handle('gridgrid:runtime-stats', async () => {
    const metrics = app.getAppMetrics();
    return [...panelViews.entries()].map(([panelId, view]) => {
      const pid = view.webContents.getOSProcessId();
      const metric = metrics.find((entry) => entry.pid === pid);
      const memoryKB = metric?.memory?.workingSetSize ?? 0;
      return { panelId, pid, memoryMB: Math.round(memoryKB / 1024) };
    });
  });

  ipcMain.on('gridgrid:set-panel-bounds', (_event, bounds: PanelBounds[]) => {
    const active = getWorkspace(state.activeWorkspaceId);
    const activeIds = new Set(active?.panels.map((panel) => panel.id) ?? []);
    const visibleIds = new Set(bounds.filter((item) => item.visible).map((item) => item.panelId));

    for (const [panelId, view] of panelViews) {
      if (!activeIds.has(panelId)) {
        view.setVisible(false);
        continue;
      }

      const bound = bounds.find((item) => item.panelId === panelId);
      if (!bound || !bound.visible) {
        view.setVisible(false);
        continue;
      }

      view.setBounds({
        x: Math.max(0, Math.round(bound.x)),
        y: Math.max(0, Math.round(bound.y)),
        width: Math.max(1, Math.round(bound.width)),
        height: Math.max(1, Math.round(bound.height))
      });
      view.setVisible(visibleIds.has(panelId));
    }
  });
}

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    state = loadState();
    registerIpc();
    createMainWindow();
    setupAutoUpdater();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
