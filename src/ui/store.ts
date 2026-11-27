import { create } from 'zustand';
import type { Item } from '../types/data';
import type { Settings, SrsState } from '../types/engine';
import {
  loadData,
  loadProgress,
  loadSettings,
  loadSrs,
  saveProgress,
  saveSettings,
  saveSrs,
} from '../engine';

export type Screen =
  | 'home'
  | 'settings'
  | 'learn'
  | 'review'
  | 'test'
  | 'challenge'
  | 'leaderboard'
  | 'charts';

export interface Progress {
  unlockedStage: number;
  lessonsDone: string[];
}

interface AppState {
  screen: Screen;
  settings: Settings;
  items: Item[];
  loading: boolean;
  error: string | null;
  srs: SrsState;
  progress: Progress;
  go: (s: Screen) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  init: () => Promise<void>;
  setSrs: (s: SrsState) => void;
  setProgress: (p: Progress) => void;
}

export const useApp = create<AppState>((set, get) => ({
  screen: 'home',
  settings: loadSettings(),
  items: [],
  loading: true,
  error: null,
  srs: loadSrs(),
  progress: loadProgress(),
  go: (screen) => {
    set({ screen });
    window.scrollTo?.(0, 0);
  },
  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    saveSettings(settings);
    set({ settings });
  },
  init: async () => {
    set({ loading: true, error: null });
    try {
      const items = await loadData();
      if (!items.length) throw new Error('沒有字詞資料');
      set({ items, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
  setSrs: (srs) => {
    saveSrs(srs);
    set({ srs });
  },
  setProgress: (progress) => {
    saveProgress(progress);
    set({ progress });
  },
}));
