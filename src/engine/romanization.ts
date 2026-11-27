// Normalisation, syllable splitting, answer checking and numbered->diacritic conversion.

import type { Level } from '../types/data';
import type {
  CheckResult,
  ErrorType,
  Question,
  RomanSystem,
  SyllableResult,
} from '../types/engine';
import {
  JYUTPING_INITIALS,
  MAX_SYLLABLE_LENGTH,
  PINYIN_INITIALS,
  isLegalSyllable,
} from './syllables';

// ---------- small helpers ----------

/** Trailing tone digit of a syllable; "5" (neutral) when there is none. */
export function toneOf(s: string): string {
  const m = /([0-9])$/.exec(s.trim());
  return m ? m[1] : '5';
}

/** Trailing tone digit, or "" when none was typed. */
function explicitTone(s: string): string {
  const m = /([0-9])$/.exec(s);
  return m ? m[1] : '';
}

function stripTone(s: string): string {
  return s.replace(/[0-9]+$/, '');
}

/** Canonical pinyin spelling: j/q/x/y + v is written u ("jv" -> "ju"). */
function canonPinyin(body: string): string {
  return body.replace(/^([jqxy])v/, '$1u');
}

/** Canonicalise one normalized syllable (keeps the tone digit). */
export function canonicalSyllable(s: string, system: RomanSystem): string {
  const t = explicitTone(s);
  const body = stripTone(s.toLowerCase());
  return (system === 'pinyin' ? canonPinyin(body) : body) + t;
}

export function splitSyllable(
  s: string,
  system: RomanSystem,
): { initial: string; final: string; tone: string } {
  const raw = s.trim().toLowerCase();
  const tone = system === 'pinyin' ? toneOf(raw) : explicitTone(raw);
  let body = stripTone(raw);
  if (system === 'pinyin') body = canonPinyin(body);
  // syllabic nasals: m, n, ng
  if (body === 'm' || body === 'n' || body === 'ng') return { initial: '', final: body, tone };
  const initials: readonly string[] = system === 'pinyin' ? PINYIN_INITIALS : JYUTPING_INITIALS;
  for (const ini of initials) {
    if (body.startsWith(ini) && body.length > ini.length) {
      return { initial: ini, final: body.slice(ini.length), tone };
    }
  }
  return { initial: '', final: body, tone };
}

// ---------- normalisation & splitting ----------

const MARK_TONE: Record<string, string> = {
  '\u0304': '1', // macron
  '\u0301': '2', // acute
  '\u030c': '3', // caron
  '\u0300': '4', // grave
};

interface Segment {
  letters: string;
  marks: (string | null)[]; // diacritic tone per letter
  digit: string | null; // explicit tone digit closing the segment
}

function tokenize(raw: string, system: RomanSystem): Segment[] {
  const text = raw.trim().toLowerCase().normalize('NFD');
  const segs: Segment[] = [];
  let cur: Segment = { letters: '', marks: [], digit: null };
  const close = (digit: string | null) => {
    if (cur.letters || digit) segs.push({ ...cur, digit });
    cur = { letters: '', marks: [], digit: null };
  };
  for (const ch of text) {
    if (ch >= 'a' && ch <= 'z') {
      cur.letters += ch;
      cur.marks.push(null);
    } else if (ch >= '0' && ch <= '9') {
      close(ch);
    } else if (ch in MARK_TONE) {
      if (cur.marks.length) cur.marks[cur.marks.length - 1] = MARK_TONE[ch];
    } else if ((ch === '\u0308' || ch === ':') && cur.letters.endsWith('u')) {
      // ü (u + diaeresis) or u: -> v
      if (system === 'pinyin') cur.letters = cur.letters.slice(0, -1) + 'v';
    } else {
      close(null); // space, apostrophe, hyphen, punctuation: separator
    }
  }
  close(null);
  return segs;
}

/** Syllabic nasals are rare; avoid them when another split of equal length exists ("xian" -> xi an, not xia n). */
const WEAK = new Set(['m', 'n', 'ng', 'hm', 'hng']);
const weakCount = (syls: string[]) => syls.filter((x) => WEAK.has(x)).length;

/** All ways to split `letters` into legal syllables, first-found (longest-first) per count. */
function splitOptions(letters: string, system: RomanSystem): Map<number, string[]> {
  const max = MAX_SYLLABLE_LENGTH[system];
  const memo = new Map<number, Map<number, string[]>>();
  const rec = (i: number): Map<number, string[]> => {
    if (i === letters.length) return new Map([[0, []]]);
    const hit = memo.get(i);
    if (hit) return hit;
    const out = new Map<number, string[]>();
    for (let len = Math.min(max, letters.length - i); len >= 1; len--) {
      const syl = letters.slice(i, i + len);
      if (!isLegalSyllable(syl, system)) continue;
      for (const [n, rest] of rec(i + len)) {
        const cand = [syl, ...rest];
        const prev = out.get(n + 1);
        if (!prev || weakCount(cand) < weakCount(prev)) out.set(n + 1, cand);
      }
    }
    memo.set(i, out);
    return out;
  };
  const res = rec(0);
  // unsplittable: keep the whole chunk as one (wrong) syllable
  return res.size ? res : new Map([[1, [letters]]]);
}

function pickCount(counts: number[], expected?: number): number {
  const sorted = [...counts].sort((a, b) => a - b);
  if (expected === undefined) return sorted[0];
  let best = sorted[0];
  for (const c of sorted) {
    if (Math.abs(c - expected) < Math.abs(best - expected)) best = c;
  }
  return best;
}

/**
 * Normalize raw player input into syllables (numbered tones kept, toneless allowed).
 * `expectedCount` (optional) disambiguates unspaced input like "xian" vs "xi'an".
 */
export function normalizeInput(raw: string, system: RomanSystem, expectedCount?: number): string[] {
  const segs = tokenize(raw, system);
  const segOpts = segs.map((s) => (s.letters ? splitOptions(s.letters, system) : new Map([[0, []]])));

  // DP over segments: total count -> chosen count per segment
  let dp = new Map<number, number[]>([[0, []]]);
  for (const opts of segOpts) {
    const next = new Map<number, number[]>();
    for (const [total, choice] of dp) {
      for (const n of [...opts.keys()].sort((a, b) => a - b)) {
        if (!next.has(total + n)) next.set(total + n, [...choice, n]);
      }
    }
    dp = next;
  }
  const total = pickCount([...dp.keys()], expectedCount);
  const choice = dp.get(total) as number[];

  const out: string[] = [];
  segs.forEach((seg, si) => {
    const syls = segOpts[si].get(choice[si]) as string[];
    let pos = 0;
    syls.forEach((syl, k) => {
      const marks = seg.marks.slice(pos, pos + syl.length).filter((m): m is string => m !== null);
      pos += syl.length;
      let tone = marks.length ? marks[marks.length - 1] : '';
      if (k === syls.length - 1 && seg.digit) tone = seg.digit;
      out.push(syl + tone);
    });
    // a lone digit (e.g. "zhong 1") attaches to the previous toneless syllable
    if (!syls.length && seg.digit && out.length && !explicitTone(out[out.length - 1])) {
      out[out.length - 1] += seg.digit;
    }
  });
  return out.map((s) => canonicalSyllable(s, system));
}

// ---------- checking ----------

function tonesMatch(given: string, expected: string, system: RomanSystem): boolean {
  // Dictionary neutral tones (东西 xi5, 汉子 zi5) also accept the citation tone the learner may type.
  if (system === 'pinyin') return toneOf(expected) === '5' || toneOf(given) === toneOf(expected);
  return explicitTone(given) !== '' && explicitTone(given) === explicitTone(expected);
}

function compareSyllable(given: string, expected: string, system: RomanSystem): SyllableResult {
  const g = splitSyllable(given, system);
  const e = splitSyllable(expected, system);
  return {
    expected,
    given,
    initialOk: g.initial === e.initial,
    finalOk: g.final === e.final,
    toneOk: tonesMatch(given, expected, system),
  };
}

const score = (r: SyllableResult) => Number(r.initialOk) + Number(r.finalOk) + Number(r.toneOk);

/** Accepted readings for each syllable position of a question (primary first). */
export function acceptedReadings(q: Question): string[][] {
  const primary = q.answer.trim().split(/\s+/).filter(Boolean);
  return primary.map((p, i) => {
    const syl = q.item.syllables[i];
    const alts = (q.system === 'pinyin' ? syl?.pinyinAlt : syl?.jyutpingAlt) ?? [];
    return [p, ...alts].map((r) => canonicalSyllable(r, q.system));
  });
}

export function checkAnswer(raw: string, q: Question, level: Level): CheckResult {
  const readings = acceptedReadings(q);
  const given = normalizeInput(raw, q.system, readings.length);
  const errors = new Set<ErrorType>();
  const syllables: SyllableResult[] = readings.map((accepted, i) => {
    const g = given[i];
    if (g === undefined) {
      errors.add('missing');
      return { expected: accepted[0], given: '', initialOk: false, finalOk: false, toneOk: false };
    }
    let best = compareSyllable(g, accepted[0], q.system);
    for (const alt of accepted.slice(1)) {
      const r = compareSyllable(g, alt, q.system);
      if (score(r) > score(best)) best = r;
    }
    if (!best.initialOk) errors.add('initial');
    if (!best.finalOk) errors.add('final');
    if (!best.toneOk) errors.add('tone');
    return best;
  });
  if (given.length > readings.length) errors.add('extra');

  const countOk = given.length === readings.length;
  const segOk = syllables.every((s) => s.initialOk && s.finalOk);
  const toneOk = syllables.every((s) => s.toneOk);
  const perfect = countOk && segOk && toneOk;
  const correct = countOk && segOk && (level === 1 || toneOk);
  const order: ErrorType[] = ['initial', 'final', 'tone', 'missing', 'extra'];
  return { correct, perfect, syllables, errorTypes: order.filter((e) => errors.has(e)) };
}

// ---------- diacritics ----------

const TONE_MARK: Record<string, string> = { '1': '\u0304', '2': '\u0301', '3': '\u030c', '4': '\u0300' };

function syllableToDiacritic(numbered: string): string {
  const tone = explicitTone(numbered);
  const body = stripTone(numbered.toLowerCase()).replace(/v/g, 'ü').replace(/u:/g, 'ü');
  const mark = TONE_MARK[tone];
  if (!mark) return body;
  let idx: number;
  if (body.includes('a')) idx = body.indexOf('a');
  else if (body.includes('e')) idx = body.indexOf('e');
  else if (body.includes('ou')) idx = body.indexOf('o');
  else {
    idx = -1;
    for (let i = body.length - 1; i >= 0; i--) {
      if ('aeiouü'.includes(body[i])) {
        idx = i;
        break;
      }
    }
    if (idx < 0) idx = 0; // syllabic m / n / ng
  }
  return (body.slice(0, idx + 1) + mark + body.slice(idx + 1)).normalize('NFC');
}

/** "zhong1 guo2" -> "zhōng guó"; "lv4" -> "lǜ"; tone 5 -> no mark. Pinyin only. */
export function toDiacritic(numbered: string): string {
  return numbered.trim().split(/\s+/).filter(Boolean).map(syllableToDiacritic).join(' ');
}
