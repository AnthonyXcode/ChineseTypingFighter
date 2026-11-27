import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildQuestions, itemLevel, lessonItems, loadData, resetDataCache, timeLimitFor } from './index';
import type { DataFile, Item } from '../types/data';
import type { QuestionOptions } from './index';
import { mkItem } from './testFixtures';

import sampleRaw from '../../public/data/sample.json?raw';

const sample = JSON.parse(sampleRaw) as DataFile;
const items = sample.items;

/** Deterministic LCG */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const opts = (o: Partial<QuestionOptions> = {}): QuestionOptions => ({
  mode: 'test',
  level: 1,
  system: 'pinyin',
  count: 5,
  rng: seeded(1),
  ...o,
});

describe('itemLevel', () => {
  it('classifies by kind and length', () => {
    expect(itemLevel(mkItem('中', 'zhong1', 'zung1'))).toBe(1);
    expect(itemLevel(mkItem('中国', 'zhong1 guo2', 'zung1 gwok3'))).toBe(2);
    expect(itemLevel(mkItem('中国人', 'zhong1 guo2 ren2', 'zung1 gwok3 jan4'))).toBe(3);
    const phrase = mkItem('一二三四五', 'yi1 er4 san1 si4 wu3', 'jat1 ji6 saam1 sei3 ng5');
    expect(phrase.kind).toBe('phrase');
    expect(itemLevel(phrase)).toBe(3);
    const longWord = { ...phrase, kind: 'word' as const, level: 2 as const };
    expect(itemLevel(longWord)).toBe(2);
  });
});

describe('buildQuestions', () => {
  it('filters by level and builds answers', () => {
    const qs = buildQuestions(items, opts({ count: 10 }));
    expect(qs).toHaveLength(10);
    for (const q of qs) {
      expect(q.item.kind).toBe('char');
      expect(q.system).toBe('pinyin');
      expect(q.answer).toBe(q.item.syllables.map((s) => s.pinyin).join(' '));
      expect(q.timeLimitMs).toBeNull();
    }
    const l2 = buildQuestions(items, opts({ level: 2, count: 5 }));
    expect(l2.every((q) => q.item.syllables.length === 2)).toBe(true);
    const l3 = buildQuestions(items, opts({ level: 3, count: 5 }));
    expect(l3.every((q) => q.item.syllables.length >= 3)).toBe(true);
  });

  it('deterministic given rng, no duplicates', () => {
    const a = buildQuestions(items, opts({ count: 16, rng: seeded(7) })).map((q) => q.item.id);
    const b = buildQuestions(items, opts({ count: 16, rng: seeded(7) })).map((q) => q.item.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
    const dupItems = [...items, ...items];
    const c = buildQuestions(dupItems, opts({ count: 100 })).map((q) => q.item.id);
    expect(new Set(c).size).toBe(c.length);
    expect(c).toHaveLength(items.length);
  });

  it('fills from neighbouring levels when short', () => {
    const qs = buildQuestions(items, opts({ level: 3, count: 25 }));
    expect(qs).toHaveLength(25);
    const levels = qs.map((q) => itemLevel(q.item));
    const n3 = items.filter((i) => itemLevel(i) === 3).length;
    expect(levels.slice(0, n3).every((l) => l === 3)).toBe(true);
    expect(levels.slice(n3).every((l) => l === 2 || l === 1)).toBe(true);
    // L3 -> L2 before L1
    const firstFill = levels[n3];
    expect(firstFill).toBe(2);
    const l2 = buildQuestions(items, opts({ level: 2, count: 20 })).map((q) => itemLevel(q.item));
    expect(l2.slice(12).every((l) => l === 1)).toBe(true);
  });

  it('SRS-due items first', () => {
    const now = Date.now();
    const target = items.filter((i) => i.kind === 'char').slice(-2);
    const srs = {
      [target[0].id]: { id: target[0].id, box: 1 as const, due: now - 1000 },
      [target[1].id]: { id: target[1].id, box: 1 as const, due: now - 5000 },
      [items[0].id]: { id: items[0].id, box: 3 as const, due: now + 1e9 },
    };
    const qs = buildQuestions(items, opts({ srs, count: 4 }));
    expect(qs[0].item.id).toBe(target[1].id);
    expect(qs[1].item.id).toBe(target[0].id);
  });

  it('chapters and excludeIds', () => {
    const multi: Item[] = [
      mkItem('一', 'yi1', 'jat1', { chapter: 1 }),
      mkItem('二', 'er4', 'ji6', { chapter: 2 }),
      mkItem('三', 'san1', 'saam1', { chapter: 2 }),
    ];
    const qs = buildQuestions(multi, opts({ chapters: [2], excludeIds: [multi[2].id] }));
    expect(qs.map((q) => q.item.id)).toEqual([multi[1].id]);
  });

  it("system 'both' emits pinyin then jyutping per item", () => {
    const qs = buildQuestions(items, opts({ system: 'both', count: 3 }));
    expect(qs).toHaveLength(6);
    for (let i = 0; i < 6; i += 2) {
      expect(qs[i].item).toBe(qs[i + 1].item);
      expect(qs[i].system).toBe('pinyin');
      expect(qs[i + 1].system).toBe('jyutping');
      expect(qs[i + 1].answer).toBe(qs[i].item.syllables.map((s) => s.jyutping).join(' '));
    }
  });

  it('skips items lacking the required romanization', () => {
    const bad = mkItem('甲', 'jia3', '');
    const good = mkItem('乙', 'yi3', 'jyut3');
    expect(buildQuestions([bad, good], opts({ system: 'jyutping' })).map((q) => q.item.id)).toEqual([good.id]);
    expect(buildQuestions([bad, good], opts({ system: 'pinyin' }))).toHaveLength(2);
  });

  it('challenge time limits', () => {
    const c1 = buildQuestions(items, opts({ mode: 'challenge', level: 1, count: 2 }));
    expect(c1.every((q) => q.timeLimitMs === 12000)).toBe(true);
    const c2 = buildQuestions(items, opts({ mode: 'challenge', level: 2, count: 2 }));
    expect(c2.every((q) => q.timeLimitMs === 8000)).toBe(true);
    const c3 = buildQuestions(items, opts({ mode: 'challenge', level: 3, count: 2 }));
    for (const q of c3) expect(q.timeLimitMs).toBe(5000 + 1000 * q.item.syllables.length);
    const four = mkItem('一二三四', 'yi1 er4 san1 si4', 'jat1 ji6 saam1 sei3');
    expect(timeLimitFor('challenge', 3, four)).toBe(9000);
    expect(timeLimitFor('learn', 3, four)).toBeNull();
  });

  it('uses Math.random when rng omitted', () => {
    const qs = buildQuestions(items, { mode: 'learn', level: 1, system: 'jyutping', count: 3 });
    expect(qs).toHaveLength(3);
  });
});

describe('lessonItems', () => {
  it('sorts by level asc then freq desc and slices', () => {
    const list: Item[] = [
      mkItem('中国', 'zhong1 guo2', 'zung1 gwok3', { freq: 50 }),
      mkItem('天', 'tian1', 'tin1', { freq: 3 }),
      mkItem('人', 'ren2', 'jan4', { freq: 9 }),
      mkItem('大', 'da4', 'daai6', { freq: 9 }),
      mkItem('他', 'ta1', 'taa1', { freq: 1, chapter: 2 }),
    ];
    const l0 = lessonItems(list, 1, 0, 2);
    expect(l0.map((i) => i.text)).toEqual(['人', '大']);
    expect(lessonItems(list, 1, 1, 2).map((i) => i.text)).toEqual(['天', '中国']);
    expect(lessonItems(list, 1, 2, 2)).toEqual([]);
    expect(lessonItems(list, 2, 0).map((i) => i.text)).toEqual(['他']);
    expect(lessonItems(items, 1, 0)).toHaveLength(20);
  });
});

describe('loadData', () => {
  const okJson = (data: unknown) => ({ ok: true, status: 200, json: async () => data });
  const fail = { ok: false, status: 404, json: async () => ({}) };
  beforeEach(() => resetDataCache());
  afterEach(() => vi.unstubAllGlobals());

  it('merges chars/words/phrases, skips failures, dedupes, caches', async () => {
    const a = mkItem('一', 'yi1', 'jat1');
    const b = mkItem('二', 'er4', 'ji6');
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('chars.json')) return okJson({ items: [a, b] });
      if (url.endsWith('words.json')) return okJson({ items: [b] });
      if (url.endsWith('phrases.json')) throw new Error('network');
      return fail;
    });
    vi.stubGlobal('fetch', fetchMock);
    const data = await loadData();
    expect(data.map((i) => i.id)).toEqual([a.id, b.id]);
    expect(fetchMock).toHaveBeenCalledWith('/data/chars.json');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await loadData();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('falls back to sample.json', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('sample.json')) return okJson(sample);
      if (url.endsWith('words.json')) return okJson({ nope: true });
      return fail;
    });
    vi.stubGlobal('fetch', fetchMock);
    const data = await loadData();
    expect(data).toHaveLength(items.length);
    expect(fetchMock).toHaveBeenCalledWith('/data/sample.json');
  });

  it('returns [] when everything fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fail));
    expect(await loadData()).toEqual([]);
  });

  it('respects BASE_URL', async () => {
    vi.stubEnv('BASE_URL', '/ctf');
    const fetchMock = vi.fn(async () => fail);
    vi.stubGlobal('fetch', fetchMock);
    await loadData();
    expect(fetchMock).toHaveBeenCalledWith('/ctf/data/chars.json');
    vi.unstubAllEnvs();
  });
});
