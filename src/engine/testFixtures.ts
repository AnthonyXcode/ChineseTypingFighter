// Test-only helpers (excluded from coverage). Not exported from index.ts.

import type { Item, Level, Syllable } from '../types/data';
import type { Question, RomanSystem } from '../types/engine';

let n = 0;

/** mkItem('中国', 'zhong1 guo2', 'zung1 gwok3') */
export function mkItem(
  text: string,
  pinyin: string,
  jyutping: string,
  extra: Partial<Item> & { alts?: Partial<Syllable>[] } = {},
): Item {
  const py = pinyin.split(' ');
  const jp = jyutping.split(' ');
  const chars = [...text];
  const syllables: Syllable[] = chars.map((c, i) => ({
    hanzi: c,
    hanziTrad: c,
    pinyin: py[i],
    jyutping: jp[i],
    polyphonic: false,
    ...(extra.alts?.[i] ?? {}),
  }));
  const len = chars.length;
  const kind: Item['kind'] = len === 1 ? 'char' : len <= 4 ? 'word' : 'phrase';
  const level: Level = len === 1 ? 1 : len === 2 ? 2 : 3;
  const { alts: _alts, ...rest } = extra;
  void _alts;
  return {
    id: `t-${++n}`,
    kind,
    text,
    textTrad: text,
    syllables,
    level,
    freq: 1,
    chapter: 1,
    ...rest,
  };
}

export function mkQ(item: Item, system: RomanSystem = 'pinyin'): Question {
  return {
    item,
    system,
    answer: item.syllables.map((s) => s[system]).join(' '),
    timeLimitMs: null,
  };
}
