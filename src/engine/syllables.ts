// Legal syllable tables for Hanyu Pinyin and Cantonese Jyutping (toneless).
// Generated programmatically from initials x finals with an explicit allow-list.

import type { RomanSystem } from '../types/engine';

// ---------- Pinyin ----------

/** Pinyin initials, longest first so prefix matching picks zh/ch/sh before z/c/s. */
export const PINYIN_INITIALS = [
  'zh', 'ch', 'sh',
  'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h',
  'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w',
] as const;

/**
 * Allow-list: final -> initials (space separated) it combines with.
 * Zero-initial / y- / w- syllables are listed separately below.
 */
const PINYIN_FINAL_INITIALS: Record<string, string> = {
  a: 'b p m f d t n l g k h zh ch sh z c s',
  ai: 'b p m d t n l g k h zh ch sh z c s',
  an: 'b p m f d t n l g k h zh ch sh r z c s',
  ang: 'b p m f d t n l g k h zh ch sh r z c s',
  ao: 'b p m d t n l g k h zh ch sh r z c s',
  e: 'm d t n l g k h zh ch sh r z c s',
  ei: 'b p m f d n l g k h zh sh z',
  en: 'b p m f d n g k h zh ch sh r z c s',
  eng: 'b p m f d t n l g k h zh ch sh r z c s',
  o: 'b p m f l',
  ong: 'd t n l g k h zh ch r z c s',
  ou: 'p m f d t n l g k h zh ch sh r z c s',
  u: 'b p m f d t n l g k h zh ch sh r z c s j q x',
  ua: 'g k h zh ch sh r',
  uai: 'g k h zh ch sh',
  uan: 'd t n l g k h zh ch sh r z c s j q x',
  uang: 'g k h zh ch sh',
  ue: 'n l j q x',
  ui: 'd t g k h zh ch sh r z c s',
  un: 'd t n l g k h zh ch sh r z c s j q x',
  uo: 'd t n l g k h zh ch sh r z c s',
  i: 'b p m d t n l j q x zh ch sh r z c s',
  ia: 'd l j q x',
  ian: 'b p m d t n l j q x',
  iang: 'n l j q x',
  iao: 'b p m d t n l j q x',
  ie: 'b p m d t n l j q x',
  in: 'b p m n l j q x',
  ing: 'b p m d t n l j q x',
  iong: 'j q x',
  iu: 'm d n l j q x',
  // ü written as v
  v: 'n l j q x',
  ve: 'n l j q x',
  van: 'j q x',
  vn: 'j q x',
};

const PINYIN_STANDALONE = [
  // zero initial
  'a', 'ai', 'an', 'ang', 'ao', 'e', 'ei', 'en', 'eng', 'er', 'o', 'ou',
  // y-
  'yi', 'ya', 'yan', 'yang', 'yao', 'ye', 'yin', 'ying', 'yo', 'yong', 'you',
  'yu', 'yuan', 'yue', 'yun', 'yv', 'yvan', 'yve', 'yvn',
  // w-
  'wu', 'wa', 'wai', 'wan', 'wang', 'wei', 'wen', 'weng', 'wo',
  // rare / interjections
  'zhei', 'shei', 'kei', 'nou', 'dia', 'm', 'n', 'ng', 'hm', 'hng',
];

function buildPinyin(): Set<string> {
  const set = new Set<string>(PINYIN_STANDALONE);
  for (const [final, initials] of Object.entries(PINYIN_FINAL_INITIALS)) {
    for (const ini of initials.split(' ')) set.add(ini + final);
  }
  return set;
}

// ---------- Jyutping ----------

/** Jyutping initials, longest first (gw/kw/ng before g/k/n). */
export const JYUTPING_INITIALS = [
  'gw', 'kw', 'ng',
  'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'w', 'z', 'c', 's', 'j',
] as const;

export const JYUTPING_FINALS = (
  'aa aai aau aam aan aang aap aat aak ai au am an ang ap at ak ' +
  'e ei eu em eng ep ek i iu im in ing ip it ik o oi ou on ong ot ok ' +
  'u ui un ung ut uk oe oeng oek eoi eon eot yu yun yut'
).split(' ');

/** Permissive: every initial (incl. none) x every final, plus syllabic m / ng. */
function buildJyutping(): Set<string> {
  const set = new Set<string>(['m', 'ng']);
  for (const fin of JYUTPING_FINALS) {
    set.add(fin);
    for (const ini of JYUTPING_INITIALS) set.add(ini + fin);
  }
  return set;
}

export const PINYIN_SYLLABLES: ReadonlySet<string> = buildPinyin();
export const JYUTPING_SYLLABLES: ReadonlySet<string> = buildJyutping();

export const MAX_SYLLABLE_LENGTH: Record<RomanSystem, number> = {
  pinyin: Math.max(...[...PINYIN_SYLLABLES].map((s) => s.length)),
  jyutping: Math.max(...[...JYUTPING_SYLLABLES].map((s) => s.length)),
};

export function isLegalSyllable(s: string, system: RomanSystem): boolean {
  return (system === 'pinyin' ? PINYIN_SYLLABLES : JYUTPING_SYLLABLES).has(s);
}
