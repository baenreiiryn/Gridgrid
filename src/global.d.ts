import type { GridgridApi } from '../electron/preload';

declare global {
  interface Window {
    gridgrid: GridgridApi;
  }
}

export {};
