import { create } from 'zustand';
import type { SettingsPayload, Settings } from '../types';

interface SettingsState {
  settings: SettingsPayload | null;
  setSettings: (settings: SettingsPayload) => void;
  patchSettings: (patch: Partial<Settings>) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  setSettings: (settings) => set({ settings }),
  patchSettings: (patch) =>
    set((state) => (state.settings ? { settings: { ...state.settings, ...patch } } : state)),
}));
