export type LayoutMode = 'auto' | 'columns' | 'rows' | 'focus';

export interface PanelConfig {
  id: string;
  name: string;
  url: string;
  color: string;
  zoom: number;
  muted: boolean;
}

export interface WorkspaceConfig {
  id: string;
  name: string;
  layout: LayoutMode;
  focusedPanelId?: string;
  panels: PanelConfig[];
}

export interface AppState {
  version: 1;
  activeWorkspaceId: string;
  workspaces: WorkspaceConfig[];
}

export interface PanelBounds {
  panelId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}
