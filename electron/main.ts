import { app, BrowserWindow, ipcMain, WebContentsView } from 'electron';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AppState, LayoutMode, PanelBounds, PanelConfig } from './types';
import { loadState, saveState } from './store';

const PANEL_COLORS = ['#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6'];
const DEFAULT_URL = 'https://huntera.com.br/';

let mainWindow: BrowserWindow | null = null;
let state: AppState;
const panelViews = new Map<string, WebContentsView>();

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return DEFAULT_URL;
  try {
    return new URL(trimmed).toString();
  } catch {
    return new URL(`https://${trimmed}`).toString();
  }
}

function getWorkspace(workspaceId: string) {
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
  view.webContents.setWindowOpenHandler(({ url }) => {
    void view.webContents.loadURL(url);
    return { action: 'deny' };
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
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
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

  const devUrl = process.env.GRIDGRID_DEV_URL;
  if (devUrl) void mainWindow.loadURL(devUrl);
  else void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  mainWindow.webContents.on('did-finish-load', () => syncViewsWithState());
  mainWindow.on('closed', () => {
    for (const panelId of [...panelViews.keys()]) destroyPanelView(panelId);
    mainWindow = null;
  });
}

function registerIpc(): void {
  ipcMain.handle('gridgrid:get-state', () => state);

  ipcMain.handle('gridgrid:set-active-workspace', (_event, workspaceId: string) => {
    if (getWorkspace(workspaceId)) state.activeWorkspaceId = workspaceId;
    return persistAndSync();
  });

  ipcMain.handle('gridgrid:add-workspace', (_event, name?: string) => {
    const id = randomUUID();
    state.workspaces.push({ id, name: name?.trim() || `Workspace ${state.workspaces.length + 1}`, layout: 'auto', panels: [] });
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
    if (workspace) workspace.layout = layout;
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
    const panel: PanelConfig = {
      id,
      name: partial?.name?.trim() || `Conta ${index + 1}`,
      url: normalizeUrl(partial?.url || DEFAULT_URL),
      color: partial?.color || PANEL_COLORS[index % PANEL_COLORS.length],
      zoom: Math.min(2, Math.max(0.35, partial?.zoom ?? 1)),
      muted: partial?.muted ?? false
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
    if (typeof patch.color === 'string') panel.color = patch.color;
    if (typeof patch.muted === 'boolean') panel.muted = patch.muted;
    if (typeof patch.zoom === 'number') panel.zoom = Math.min(2, Math.max(0.35, patch.zoom));

    const view = panelViews.get(panelId);
    if (view) {
      view.webContents.setAudioMuted(panel.muted);
      view.webContents.setZoomFactor(panel.zoom);
    }

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
    saveState(state);
    await view.webContents.loadURL(located.panel.url);
  });

  ipcMain.handle('gridgrid:open-devtools', (_event, panelId: string) => {
    panelViews.get(panelId)?.webContents.openDevTools({ mode: 'detach' });
  });

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

app.whenReady().then(() => {
  state = loadState();
  registerIpc();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
