import { create } from 'zustand';
import type { Locale, ReceiverStatus, StatusUpdate, StreamStats, Theme } from '../types';

interface AppState {
  status: ReceiverStatus;
  statusData: StatusUpdate;
  streamStats: StreamStats;
  locale: Locale;
  theme: Theme;
  activePanel: 'home' | 'settings';
  toast: string | null;
  errorMessage: string | null;
  errorDetails: string | null;
  bonjourMissing: boolean;
  langPickerOpen: boolean;
  pageOverlay: 'about' | 'terms' | 'opensource' | 'security' | null;
  version: string;
  setStatus: (data: StatusUpdate) => void;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
  setActivePanel: (panel: 'home' | 'settings') => void;
  showToast: (message: string) => void;
  hideToast: () => void;
  showError: (message: string, details?: string) => void;
  hideError: () => void;
  setBonjourMissing: (missing: boolean) => void;
  setLangPickerOpen: (open: boolean) => void;
  setPageOverlay: (page: AppState['pageOverlay']) => void;
  setVersion: (v: string) => void;
  setStreamStats: (stats: StreamStats) => void;
}

export const useAppStore = create<AppState>((set) => ({
  status: 'stopped',
  statusData: { status: 'stopped' },
  streamStats: {
    resolution: null,
    fps: null,
    codec: null,
    audio: true,
    bytesReceived: null,
    latencyMs: null,
    packetLoss: null,
  },
  locale: 'fr',
  theme: 'dark',
  activePanel: 'home',
  toast: null,
  errorMessage: null,
  errorDetails: null,
  bonjourMissing: false,
  langPickerOpen: false,
  pageOverlay: null,
  version: '1.0.0',
  setStatus: (data) => set({ status: data.status, statusData: data }),
  setLocale: (locale) => set({ locale }),
  setTheme: (theme) => {
    document.documentElement.dataset['theme'] = theme;
    document.body.dataset['theme'] = theme;
    set({ theme });
  },
  setActivePanel: (panel) => set({ activePanel: panel }),
  showToast: (message) => set({ toast: message }),
  hideToast: () => set({ toast: null }),
  showError: (message, details) => set({ errorMessage: message, errorDetails: details ?? null }),
  hideError: () => set({ errorMessage: null, errorDetails: null }),
  setBonjourMissing: (missing) => set({ bonjourMissing: missing }),
  setLangPickerOpen: (open) => set({ langPickerOpen: open }),
  setPageOverlay: (page) => set({ pageOverlay: page }),
  setVersion: (v) => set({ version: v }),
  setStreamStats: (streamStats) => set({ streamStats }),
}));
