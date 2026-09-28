export type LayoutMode = 'auto' | 'columns' | 'rows' | 'focus';
export type GamePresetId = 'huntera' | 'custom';

export interface PanelConfig {
  id: string;
  name: string;
  url: string;
  color: string;
  zoom: number;
  muted: boolean;
  presetId?: GamePresetId;
}

export interface WorkspaceConfig {
  id: string;
  name: string;
  layout: LayoutMode;
  focusedPanelId?: string;
  panels: PanelConfig[];
}

export interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized?: boolean;
}

export interface AppState {
  version: 1;
  activeWorkspaceId: string;
  workspaces: WorkspaceConfig[];
  windowBounds?: WindowBounds;
}

export interface PanelBounds {
  panelId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

export interface FileOperationResult {
  ok: boolean;
  canceled?: boolean;
  path?: string;
  message?: string;
  state?: AppState;
}

export type UpdateState =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'error';

export interface UpdateStatus {
  state: UpdateState;
  version?: string;
  percent?: number;
  message?: string;
}
