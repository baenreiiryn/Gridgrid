import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { UpdateStatus } from './types';

let currentStatus: UpdateStatus = { state: 'idle' };

function broadcast(status: UpdateStatus): void {
  currentStatus = status;
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('gridgrid:update-status', status);
  }
}

export function getUpdateStatus(): UpdateStatus {
  if (!app.isPackaged) {
    return {
      state: 'disabled',
      message: 'Atualizações automáticas ficam ativas no aplicativo instalado.'
    };
  }
  return currentStatus;
}

export function setupAutoUpdater(): void {
  if (!app.isPackaged) {
    broadcast({
      state: 'disabled',
      message: 'Atualizações automáticas ficam ativas no aplicativo instalado.'
    });
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    broadcast({ state: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    broadcast({
      state: 'available',
      version: info.version,
      percent: 0
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    broadcast({
      state: 'not-available',
      version: info.version
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    broadcast({
      state: 'downloading',
      percent: Math.max(0, Math.min(100, progress.percent))
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    broadcast({
      state: 'downloaded',
      version: info.version,
      percent: 100
    });
  });

  autoUpdater.on('error', (error) => {
    broadcast({
      state: 'error',
      message: error instanceof Error ? error.message : String(error)
    });
  });

  window.setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((error) => {
      broadcast({
        state: 'error',
        message: error instanceof Error ? error.message : String(error)
      });
    });
  }, 5000);

  window.setInterval(() => {
    void autoUpdater.checkForUpdates().catch(() => {
      // Event handler reports updater errors to the renderer.
    });
  }, 6 * 60 * 60 * 1000);
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  if (!app.isPackaged) return getUpdateStatus();

  broadcast({ state: 'checking' });
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    broadcast({
      state: 'error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
  return currentStatus;
}

export function installDownloadedUpdate(): boolean {
  if (!app.isPackaged || currentStatus.state !== 'downloaded') return false;

  autoUpdater.quitAndInstall(false, true);
  return true;
}
