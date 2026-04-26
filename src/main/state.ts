import type { BrowserWindow, Tray } from 'electron';
import type { Locale, Theme, VideoAspect } from './types';

interface AppState {
  mainWindow: BrowserWindow | null;
  freezeWindow: BrowserWindow | null;
  tray: Tray | null;
  gstPid: number | null;
  gstWindowTitle: string;
  isFrozen: boolean;
  lastFreezeImage: string | null;
  currentDeviceName: string;
  currentTheme: Theme;
  currentLocale: Locale;
  nativeFollowTimer: ReturnType<typeof setInterval> | null;
  videoIsPinned: boolean;
  streamAspect: VideoAspect | null;
  streamIsLandscape: boolean;
  streamResizeTimer: ReturnType<typeof setInterval> | null;
  isQuitting: boolean;
}

export const state: AppState = {
  mainWindow: null,
  freezeWindow: null,
  tray: null,
  gstPid: null,
  gstWindowTitle: 'NovX Mirror',
  isFrozen: false,
  lastFreezeImage: null,
  currentDeviceName: '',
  currentTheme: 'dark',
  currentLocale: 'fr',
  nativeFollowTimer: null,
  videoIsPinned: false,
  streamAspect: null,
  streamIsLandscape: false,
  streamResizeTimer: null,
  isQuitting: false,
};

export const VIDEO_MARGIN = 40;
export const DEFAULT_VIDEO_ASPECT: VideoAspect = { width: 9, height: 19.5 };
export const MAX_PORTRAIT_RATIO = 0.5;
export const PORTRAIT_HORIZONTAL_OVERSCAN_PX = 6;
export const PORTRAIT_VERTICAL_OVERSCAN_PX = 0;
export const GST_SHOW_RETRY_DELAY = 120;
export const GST_SHOW_MAX_ATTEMPTS = 12;
