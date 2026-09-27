import { contextBridge, ipcRenderer } from 'electron';
import type { AppState, LayoutMode, PanelBounds, PanelConfig } from './types';

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke('gridgrid:get-state'),
  setActiveWorkspace: (workspaceId: string): Promise<AppState> =>
    ipcRenderer.invoke('gridgrid:set-active-workspace', workspaceId),
  addWorkspace: (name?: string): Promise<AppState> => ipcRenderer.invoke('gridgrid:add-workspace', name),
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
  removePanel: (workspaceId: string, panelId: string): Promise<AppState> =>
    ipcRenderer.invoke('gridgrid:remove-panel', workspaceId, panelId),
  reloadPanel: (panelId: string): Promise<void> => ipcRenderer.invoke('gridgrid:reload-panel', panelId),
  navigatePanel: (panelId: string, url: string): Promise<void> =>
    ipcRenderer.invoke('gridgrid:navigate-panel', panelId, url),
  setPanelBounds: (bounds: PanelBounds[]): void => ipcRenderer.send('gridgrid:set-panel-bounds', bounds),
  openDevTools: (panelId: string): Promise<void> => ipcRenderer.invoke('gridgrid:open-devtools', panelId),
  getRuntimeStats: (): Promise<Array<{ panelId: string; pid: number; memoryMB: number }>> =>
    ipcRenderer.invoke('gridgrid:runtime-stats')
};

contextBridge.exposeInMainWorld('gridgrid', api);

export type GridgridApi = typeof api;
