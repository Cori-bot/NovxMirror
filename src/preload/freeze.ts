import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { VideoBounds } from '../main/types';

const freezeApi = {
  onImage: (cb: (imagePath: string) => void): void => {
    ipcRenderer.on('freeze-image', (_: IpcRendererEvent, imagePath: string) => cb(imagePath));
  },
  onLayout: (cb: (layout: VideoBounds) => void): void => {
    ipcRenderer.on('freeze-layout', (_: IpcRendererEvent, layout: VideoBounds) => cb(layout));
  },
  onToggleDraw: (cb: () => void): void => {
    ipcRenderer.on('toggle-draw', () => cb());
  },
  setInteractive: (interactive: boolean): void => {
    ipcRenderer.send('freeze-set-interactive', interactive);
  },
} as const;

export type FreezeApi = typeof freezeApi;

contextBridge.exposeInMainWorld('novxFreeze', freezeApi);
