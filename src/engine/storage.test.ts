import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  addLeaderboard,
  addRecent,
  addTest,
  loadLeaderboard,
  loadRecent,
  loadProgress,
  loadSettings,
  loadSrs,
  loadTests,
  saveProgress,
  saveSettings,
  saveSrs,
} from './index';
import type { LeaderboardEntry, TestRecord } from './index';

class MemStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? (this.data.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}

const throwing = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

const rec = (i: number): TestRecord => ({
  date: i,
  level: 1,
  system: 'pinyin',
  total: 10,
  correct: 5,
  avgMs: 1000,
  hintsUsed: 0,
  grade: 'C',
  wrongIds: [],
});
const entry = (score: number, date = 0): LeaderboardEntry => ({
  name: 'x',
  score,
  level: 1,
  system: 'pinyin',
  stage: 1,
  date,
});

afterEach(() => vi.unstubAllGlobals());

describe('storage with working localStorage', () => {
  let mem: MemStorage;
  beforeEach(() => {
    mem = new MemStorage();
    vi.stubGlobal('localStorage', mem);
  });

  it('defaults when empty', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      system: 'pinyin',
      level: 1,
      hintsEnabled: true,
      script: 'trad',
      soundOn: true,
      ttsOn: true,
      testInstantFeedback: false,
      theme: 'auto',
    });
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(loadSrs()).toEqual({});
    expect(loadTests()).toEqual([]);
    expect(loadLeaderboard()).toEqual([]);
    expect(loadProgress()).toEqual({ unlockedStage: 1, lessonsDone: [] });
  });

  it('settings round-trip with ctf: prefix and merge over defaults', () => {
    saveSettings({ ...DEFAULT_SETTINGS, level: 3, theme: 'dark' });
    expect(mem.data.has('ctf:settings')).toBe(true);
    expect(loadSettings()).toMatchObject({ level: 3, theme: 'dark', script: 'trad' });
    mem.setItem('ctf:settings', JSON.stringify({ system: 'both' }));
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, system: 'both' });
  });

  it('corrupt / wrong-shaped data falls back', () => {
    mem.setItem('ctf:settings', '{not json');
    mem.setItem('ctf:srs', '[1,2]');
    mem.setItem('ctf:tests', '{"a":1}');
    mem.setItem('ctf:leaderboard', '"str"');
    mem.setItem('ctf:progress', 'null');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(loadSrs()).toEqual({});
    expect(loadTests()).toEqual([]);
    expect(loadLeaderboard()).toEqual([]);
    expect(loadProgress()).toEqual({ unlockedStage: 1, lessonsDone: [] });
    mem.setItem('ctf:progress', JSON.stringify({ unlockedStage: 'x', lessonsDone: 3 }));
    expect(loadProgress()).toEqual({ unlockedStage: 1, lessonsDone: [] });
  });

  it('srs and progress round-trip', () => {
    saveSrs({ a: { id: 'a', box: 2, due: 5 } });
    expect(loadSrs()).toEqual({ a: { id: 'a', box: 2, due: 5 } });
    saveProgress({ unlockedStage: 4, lessonsDone: ['1-0'] });
    expect(loadProgress()).toEqual({ unlockedStage: 4, lessonsDone: ['1-0'] });
  });

  it('tests keep last 50', () => {
    for (let i = 0; i < 55; i++) addTest(rec(i));
    const t = loadTests();
    expect(t).toHaveLength(50);
    expect(t[0].date).toBe(5);
    expect(t[49].date).toBe(54);
  });

  it('recent ids: dedupe, newest last, capped at 300', () => {
    expect(loadRecent()).toEqual([]);
    addRecent(['a', 'b']);
    expect(addRecent(['a', 'c'])).toEqual(['b', 'a', 'c']);
    addRecent(Array.from({ length: 400 }, (_, i) => `x${i}`));
    const r = loadRecent();
    expect(r).toHaveLength(300);
    expect(r[r.length - 1]).toBe('x399');
  });

  it('leaderboard keeps top 10 sorted', () => {
    let board: LeaderboardEntry[] = [];
    for (let i = 0; i < 12; i++) board = addLeaderboard(entry(i * 10, i));
    expect(board).toHaveLength(10);
    expect(board[0].score).toBe(110);
    expect(board[9].score).toBe(20);
    expect(loadLeaderboard()).toEqual(board);
    board = addLeaderboard(entry(110, 99));
    expect(board[0].date).toBe(11); // earlier date wins tie
    expect(board[1].date).toBe(99);
  });
});

describe('storage with throwing localStorage', () => {
  beforeEach(() => vi.stubGlobal('localStorage', throwing));
  it('never throws and returns defaults', () => {
    expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSrs({})).not.toThrow();
    expect(loadSrs()).toEqual({});
    expect(() => addTest(rec(1))).not.toThrow();
    expect(loadTests()).toEqual([]);
    expect(addLeaderboard(entry(5))).toEqual([entry(5)]);
    expect(() => saveProgress({ unlockedStage: 2, lessonsDone: [] })).not.toThrow();
    expect(loadProgress()).toEqual({ unlockedStage: 1, lessonsDone: [] });
  });
});

describe('storage without localStorage', () => {
  beforeEach(() => vi.stubGlobal('localStorage', undefined));
  it('returns defaults', () => {
    saveSettings({ ...DEFAULT_SETTINGS, level: 2 });
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
