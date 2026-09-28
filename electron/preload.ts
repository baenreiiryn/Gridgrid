import { contextBridge, ipcRenderer } from 'electron';
import type { AppState, FileOperationResult, LayoutMode, PanelBounds, PanelConfig, UpdateStatus } from './types';

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke('gridgrid:get-state'),
  setActiveWorkspace: (workspaceId: string): Promise<AppState> =>
    ipcRenderer.invoke('gridgrid:set-active-workspace', workspaceId),
  addWorkspace: (name?: string): Promise<AppState> =>
    ipcRenderer.invoke('gridgrid:add-workspace', name),
  renameWorkspace: (workspaceId: string, name: string): Promise<AppState> =>
    ipcRenderer.invoke('gridgrid:rename-workspace', workspaceId, name),
  removeWorkspace: (workspaceId: string): Promise<AppState> =>
    ipcRenderer.invoke('gridgrid:remove-workspace', workspaceId),
  setLayout: (workspaceId: string, layout: LayoutMode): Promise<AppState> =>
    ipcRenderer.invoke('gridgrid:set-layout', workspaceId, layout),
  focusPanel: (workspaceId: string, panelId: string): Promise<AppState> =>
    ipcRenderer.invoke('gridgrid:focus-panel', workspaceId, panelId),
  addPanel: (workspaceId: string, partial?: Partial<PanelConfig>): Promise<AppState> =>
    ipcRenderer.invoke('gridgrid:add-panel', workspaceId, partial),
  updatePanel: (workspaceId: string, panelId: string, patch: Partial<PanelConfig>): Promise<AppState> =>
    ipcRenderer.invoke('gridgrid:update-panel', workspaceId, panelId, patch),
  reorderPanels: (workspaceId: string, panelIds: string[]): Promise<AppState> =>
    ipcRenderer.invoke('gridgrid:reorder-panels', workspaceId, panelIds),
  removePanel: (workspaceId: string, panelId: string): Promise<AppState> =>
    ipcRenderer.invoke('gridgrid:remove-panel', workspaceId, panelId),
  reloadPanel: (panelId: string): Promise<void> =>
    ipcRenderer.invoke('gridgrid:reload-panel', panelId),
  navigatePanel: (panelId: string, url: string): Promise<void> =>
    ipcRenderer.invoke('gridgrid:navigate-panel', panelId, url),
  exportWorkspace: (workspaceId: string): Promise<FileOperationResult> =>
    ipcRenderer.invoke('gridgrid:export-workspace', workspaceId),
  importWorkspace: (): Promise<FileOperationResult> =>
    ipcRenderer.invoke('gridgrid:import-workspace'),
  setPanelBounds: (bounds: PanelBounds[]): void =>
    ipcRenderer.send('gridgrid:set-panel-bounds', bounds),
  openDevTools: (panelId: string): Promise<void> =>
    ipcRenderer.invoke('gridgrid:open-devtools', panelId),
  getRuntimeStats: (): Promise<Array<{ panelId: string; pid: number; memoryMB: number }>> =>
    ipcRenderer.invoke('gridgrid:runtime-stats'),
  getAppVersion: (): Promise<string> =>
    ipcRenderer.invoke('gridgrid:get-app-version'),
  getUpdateStatus: (): Promise<UpdateStatus> =>
    ipcRenderer.invoke('gridgrid:get-update-status'),
  checkForUpdates: (): Promise<UpdateStatus> =>
    ipcRenderer.invoke('gridgrid:check-for-updates'),
  installUpdate: (): Promise<boolean> =>
    ipcRenderer.invoke('gridgrid:install-update'),
  onUpdateStatus: (callback: (status: UpdateStatus) => void): void => {
    ipcRenderer.removeAllListeners('gridgrid:update-status');
    ipcRenderer.on('gridgrid:update-status', (_event, status: UpdateStatus) => callback(status));
  }
};

contextBridge.exposeInMainWorld('gridgrid', api);

export type GridgridApi = typeof api;
