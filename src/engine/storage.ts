// localStorage wrapper. Never throws; falls back to defaults.

import type { LeaderboardEntry, Settings, SrsState, TestRecord } from '../types/engine';

export const STORAGE_PREFIX = 'ctf:';
const KEYS = {
  settings: STORAGE_PREFIX + 'settings',
  srs: STORAGE_PREFIX + 'srs',
  tests: STORAGE_PREFIX + 'tests',
  leaderboard: STORAGE_PREFIX + 'leaderboard',
  progress: STORAGE_PREFIX + 'progress',
};

export const DEFAULT_SETTINGS: Settings = {
  system: 'pinyin',
  level: 1,
  hintsEnabled: true,
  script: 'trad',
  soundOn: true,
  ttsOn: true,
  testInstantFeedback: false,
  theme: 'auto',
};

export interface Progress {
  unlockedStage: number;
  lessonsDone: string[];
}
export const DEFAULT_PROGRESS: Progress = { unlockedStage: 1, lessonsDone: [] };

const MAX_TESTS = 50;
const MAX_LEADERBOARD = 10;

function read<T>(key: string): T | undefined {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw == null) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode / unavailable: ignore */
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function loadSettings(): Settings {
  const s = read<unknown>(KEYS.settings);
  return isObject(s) ? { ...DEFAULT_SETTINGS, ...(s as Partial<Settings>) } : { ...DEFAULT_SETTINGS };
}
export function saveSettings(s: Settings): void {
  write(KEYS.settings, s);
}

export function loadSrs(): SrsState {
  const s = read<unknown>(KEYS.srs);
  return isObject(s) ? (s as SrsState) : {};
}
export function saveSrs(s: SrsState): void {
  write(KEYS.srs, s);
}

export function loadTests(): TestRecord[] {
  const t = read<unknown>(KEYS.tests);
  return Array.isArray(t) ? (t as TestRecord[]) : [];
}
export function addTest(r: TestRecord): void {
  write(KEYS.tests, [...loadTests(), r].slice(-MAX_TESTS));
}

export function loadLeaderboard(): LeaderboardEntry[] {
  const l = read<unknown>(KEYS.leaderboard);
  return Array.isArray(l) ? (l as LeaderboardEntry[]) : [];
}
/** Inserts, sorts by score desc (earlier date wins ties), keeps top 10, returns the new board. */
export function addLeaderboard(e: LeaderboardEntry): LeaderboardEntry[] {
  const board = [...loadLeaderboard(), e]
    .sort((a, b) => b.score - a.score || a.date - b.date)
    .slice(0, MAX_LEADERBOARD);
  write(KEYS.leaderboard, board);
  return board;
}

export function loadProgress(): Progress {
  const p = read<unknown>(KEYS.progress);
  if (!isObject(p)) return { ...DEFAULT_PROGRESS, lessonsDone: [] };
  return {
    unlockedStage: typeof p.unlockedStage === 'number' ? p.unlockedStage : DEFAULT_PROGRESS.unlockedStage,
    lessonsDone: Array.isArray(p.lessonsDone) ? (p.lessonsDone as string[]) : [],
  };
}
export function saveProgress(p: Progress): void {
  write(KEYS.progress, p);
}
