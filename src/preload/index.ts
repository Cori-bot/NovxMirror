import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  AppErrorPayload,
  AppSuccessPayload,
  LogEntry,
  Settings,
  SettingsPayload,
  StatusUpdate,
  StreamStats,
} from '../main/types';

type Unsubscribe = () => void;

function subscribe<T>(channel: string, cb: (data: T) => void): Unsubscribe {
  const handler = (_: IpcRendererEvent, data: T): void => cb(data);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const api = {
  getStatus: (): Promise<unknown> => ipcRenderer.invoke('get-status'),
  start: (): Promise<boolean> => ipcRenderer.invoke('start') as Promise<boolean>,
  stop: (): Promise<void> => ipcRenderer.invoke('stop') as Promise<void>,

  getSettings: (): Promise<SettingsPayload> =>
    ipcRenderer.invoke('get-settings') as Promise<SettingsPayload>,
  saveSettings: (settings: Settings): Promise<boolean> =>
    ipcRenderer.invoke('save-settings', settings) as Promise<boolean>,
  applySettings: (settings: Settings): Promise<boolean> =>
    ipcRenderer.invoke('apply-settings', settings) as Promise<boolean>,
  chooseScreenshotDirectory: (currentPath: string | null): Promise<string | null> =>
    ipcRenderer.invoke('choose-screenshot-directory', currentPath) as Promise<string | null>,

  getLogs: (): Promise<LogEntry[]> => ipcRenderer.invoke('get-logs') as Promise<LogEntry[]>,
  getStreamStats: (): Promise<StreamStats> =>
    ipcRenderer.invoke('get-stream-stats') as Promise<StreamStats>,

  onStatus: (cb: (data: StatusUpdate) => void): Unsubscribe => subscribe('status-update', cb),
  onStreamStats: (cb: (stats: StreamStats) => void): Unsubscribe => subscribe('stream-stats', cb),
  onLog: (cb: (entry: LogEntry) => void): Unsubscribe => subscribe('log-entry', cb),
  onError: (cb: (msg: AppErrorPayload | string) => void): Unsubscribe => subscribe('app-error', cb),
  onSuccess: (cb: (msg: AppSuccessPayload) => void): Unsubscribe => subscribe('app-success', cb),
  onBonjourMissing: (cb: () => void): Unsubscribe => {
    const handler = (): void => cb();
    ipcRenderer.on('bonjour-missing', handler);
    return () => {
      ipcRenderer.removeListener('bonjour-missing', handler);
    };
  },
  onThemeChanged: (cb: (theme: string) => void): Unsubscribe => subscribe('theme-changed', cb),
  onLocaleChanged: (cb: (locale: string) => void): Unsubscribe => subscribe('locale-changed', cb),

  openExternal: (url: string): Promise<boolean> =>
    ipcRenderer.invoke('open-external', url) as Promise<boolean>,
  openBonjourPage: (): Promise<boolean> =>
    ipcRenderer.invoke('open-bonjour-page') as Promise<boolean>,
  installBonjour: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('install-bonjour') as Promise<{ success: boolean }>,
  checkBonjour: (): Promise<{ running: boolean }> =>
    ipcRenderer.invoke('check-bonjour') as Promise<{ running: boolean }>,
  restartApp: (): Promise<void> => ipcRenderer.invoke('restart-app') as Promise<void>,
  getVersion: (): Promise<string> => ipcRenderer.invoke('get-version') as Promise<string>,

  minimizeWindow: (): void => ipcRenderer.send('window-minimize'),
  maximizeWindow: (): void => ipcRenderer.send('window-maximize'),
  closeWindow: (): void => ipcRenderer.send('window-close'),

  reset: (): void => ipcRenderer.send('tools-reset'),
  screenshot: (): void => ipcRenderer.send('tools-screenshot'),
} as const;

export type AirmirrorApi = typeof api;

contextBridge.exposeInMainWorld('airmirror', api);
