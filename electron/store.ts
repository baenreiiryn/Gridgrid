import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AppState } from './types';

const DEFAULT_HUNTERA_URL = 'https://huntera.com.br/';

function defaultState(): AppState {
  const workspaceId = randomUUID();
  const panelId = randomUUID();

  return {
    version: 1,
    activeWorkspaceId: workspaceId,
    workspaces: [
      {
        id: workspaceId,
        name: 'Huntera',
        layout: 'auto',
        focusedPanelId: panelId,
        panels: [
          {
            id: panelId,
            name: 'Conta 1',
            url: DEFAULT_HUNTERA_URL,
            color: '#8b5cf6',
            zoom: 1,
            muted: false,
            presetId: 'huntera'
          }
        ]
      }
    ]
  };
}

function statePath(): string {
  return path.join(app.getPath('userData'), 'state.json');
}

function migrateState(parsed: AppState): AppState {
  for (const workspace of parsed.workspaces) {
    for (const panel of workspace.panels) {
      if (!panel.presetId) {
        panel.presetId = panel.url.includes('huntera.com.br') ? 'huntera' : 'custom';
      }
    }
  }
  return parsed;
}

export function loadState(): AppState {
  try {
    const raw = fs.readFileSync(statePath(), 'utf8');
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== 1 || !Array.isArray(parsed.workspaces)) throw new Error('Invalid state');
    return migrateState(parsed);
  } catch {
    const state = defaultState();
    saveState(state);
    return state;
  }
}

export function saveState(state: AppState): void {
  const file = statePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf8');
}
