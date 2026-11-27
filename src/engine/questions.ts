// Data loading, question selection and lesson slicing.

import type { DataFile, Item, Level } from '../types/data';
import type { Question, QuestionOptions, RomanSystem } from '../types/engine';
import { dueIds } from './srs';

// ---------- loading ----------

function baseUrl(): string {
  try {
    const b: unknown = import.meta.env?.BASE_URL;
    if (typeof b === 'string' && b) return b.endsWith('/') ? b : b + '/';
  } catch {
    /* no import.meta.env */
  }
  return '/';
}

async function fetchItems(url: string): Promise<Item[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const json = (await res.json()) as Partial<DataFile>;
  if (!Array.isArray(json.items)) throw new Error(`no items in ${url}`);
  return json.items;
}

let cache: Promise<Item[]> | null = null;

/** Test helper: forget the cached data. */
export function resetDataCache(): void {
  cache = null;
}

export function loadData(): Promise<Item[]> {
  if (cache) return cache;
  cache = (async () => {
    const base = baseUrl();
    const files = ['chars.json', 'words.json', 'phrases.json'];
    const settled = await Promise.allSettled(files.map((f) => fetchItems(`${base}data/${f}`)));
    const seen = new Set<string>();
    const items: Item[] = [];
    for (const r of settled) {
      if (r.status !== 'fulfilled') continue;
      for (const it of r.value) {
        if (!seen.has(it.id)) {
          seen.add(it.id);
          items.push(it);
        }
      }
    }
    if (items.length) return items;
    try {
      return await fetchItems(`${base}data/sample.json`);
    } catch {
      return [];
    }
  })();
  return cache;
}

// ---------- level classification ----------

/** Level an item belongs to by kind/length (PLAN §3); falls back to item.level. */
export function itemLevel(item: Item): Level {
  const n = item.syllables.length;
  if (item.kind === 'char') return item.level; // only top-frequency chars are level 1
  if (item.kind === 'word' && n === 2) return 2;
  if (item.kind === 'word' && (n === 3 || n === 4)) return 3;
  if (item.kind === 'phrase' && n <= 8) return 3;
  return item.level;
}

function neighbourOrder(level: Level): Level[] {
  if (level === 1) return [1, 2, 3];
  if (level === 2) return [2, 1, 3];
  return [3, 2, 1];
}

function weightFor(item: Item, level: Level): number {
  if (level === 1) return 1 + Math.log1p(Math.max(0, item.freq)); // prefer frequent chars
  if (level === 3) return 1 + item.syllables.filter((s) => s.polyphonic).length; // weight polyphonic
  return 1;
}

/** Weighted shuffle without replacement (Efraimidis–Spirakis), deterministic for a given rng. */
function weightedShuffle(items: Item[], level: Level, rng: () => number): Item[] {
  return items
    .map((it) => {
      const u = Math.min(Math.max(rng(), 1e-12), 1);
      return { it, key: Math.pow(u, 1 / weightFor(it, level)) };
    })
    .sort((a, b) => b.key - a.key)
    .map((x) => x.it);
}

export function timeLimitFor(mode: QuestionOptions['mode'], level: Level, item: Item): number | null {
  if (mode !== 'challenge') return null;
  if (level === 1) return 12000;
  if (level === 2) return 8000;
  return 5000 + 1000 * item.syllables.length;
}

function hasReading(item: Item, sys: RomanSystem): boolean {
  return item.syllables.length > 0 && item.syllables.every((s) => !!s[sys]);
}

export function makeQuestion(item: Item, system: RomanSystem, timeLimitMs: number | null): Question {
  return { item, system, answer: item.syllables.map((s) => s[system].trim()).join(' '), timeLimitMs };
}

// ---------- building ----------

export function buildQuestions(items: Item[], opts: QuestionOptions): Question[] {
  const rng = opts.rng ?? Math.random;
  const systems: RomanSystem[] = opts.system === 'both' ? ['pinyin', 'jyutping'] : [opts.system];
  const exclude = new Set(opts.excludeIds ?? []);
  const chapters = opts.chapters ? new Set(opts.chapters) : null;
  const seen = new Set<string>();
  const pool = items.filter((it) => {
    if (seen.has(it.id) || exclude.has(it.id)) return false;
    if (chapters && !chapters.has(it.chapter)) return false;
    if (!systems.every((s) => hasReading(it, s))) return false;
    seen.add(it.id);
    return true;
  });

  const due = opts.srs ? dueIds(opts.srs) : [];
  const dueRank = new Map(due.map((id, i) => [id, i]));
  const chosen: Item[] = [];
  for (const lvl of neighbourOrder(opts.level)) {
    if (chosen.length >= opts.count) break;
    const tier = pool.filter((it) => itemLevel(it) === lvl);
    const dueTier = tier
      .filter((it) => dueRank.has(it.id))
      .sort((a, b) => (dueRank.get(a.id) as number) - (dueRank.get(b.id) as number));
    const rest = weightedShuffle(tier.filter((it) => !dueRank.has(it.id)), lvl, rng);
    for (const it of [...dueTier, ...rest]) {
      if (chosen.length >= opts.count) break;
      chosen.push(it);
    }
  }

  const out: Question[] = [];
  for (const it of chosen) {
    const t = timeLimitFor(opts.mode, opts.level, it);
    for (const s of systems) out.push(makeQuestion(it, s, t));
  }
  return out;
}

/** Chapter items sorted by level asc, freq desc; slice for lesson `lessonIndex` (0-based). */
export function lessonItems(items: Item[], chapter: number, lessonIndex: number, size = 20, level?: Level): Item[] {
  return items
    .filter((it) => it.chapter === chapter && (level === undefined || itemLevel(it) === level))
    .sort((a, b) => a.level - b.level || b.freq - a.freq || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(lessonIndex * size, lessonIndex * size + size);
}

