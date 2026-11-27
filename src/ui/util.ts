import type { Item, Level } from '../types/data';
import type { PracticeSystem, Question, RomanSystem, ScriptPref } from '../types/engine';

export const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三'];

export function chapterName(n: number): string {
  return `第${CN_NUM[n] ?? n}章`;
}

export const LEVEL_NAME: Record<Level, string> = { 1: '初級', 2: '中級', 3: '高級' };
export const LEVEL_RULE: Record<Level, string> = {
  1: '單字・聲調可不打・每題 12 秒・5 心・分數 ×1',
  2: '二字詞・必須打聲調・每題 8 秒・3 心・分數 ×1.5',
  3: '成語短句・聲調多音字全中・5 秒＋每字 1 秒・1 心・×2',
};
export const SYSTEM_NAME: Record<PracticeSystem, string> = { pinyin: '拼音', jyutping: '粵拼', both: '雙拼' };
export const ROMAN_NAME: Record<RomanSystem, string> = { pinyin: '普通話拼音', jyutping: '粵語拼音' };
export const HEARTS: Record<Level, number> = { 1: 5, 2: 3, 3: 1 };

export function systemsFor(p: PracticeSystem): RomanSystem[] {
  return p === 'both' ? ['pinyin', 'jyutping'] : [p];
}

export function itemText(item: Item, script: ScriptPref): string {
  return script === 'trad' ? item.textTrad || item.text : item.text;
}
export function itemContext(item: Item, script: ScriptPref): string | undefined {
  return script === 'trad' ? item.contextTrad ?? item.context : item.context;
}
export function charsOf(item: Item, script: ScriptPref): string[] {
  if (item.syllables.length) return item.syllables.map((s) => (script === 'trad' ? s.hanziTrad || s.hanzi : s.hanzi));
  return Array.from(itemText(item, script));
}

export function answerFor(item: Item, system: RomanSystem): string {
  return item.syllables.map((s) => s[system]).join(' ');
}

/** Build untimed questions for an explicit list of items (learn / review flows). */
export function questionsFor(items: Item[], practice: PracticeSystem): Question[] {
  const out: Question[] = [];
  for (const item of items) {
    for (const system of systemsFor(practice)) {
      out.push({ item, system, answer: answerFor(item, system), timeLimitMs: null });
    }
  }
  return out;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtSec(ms: number): string {
  return `${(ms / 1000).toFixed(1)} 秒`;
}

export function chaptersPresent(items: Item[]): number[] {
  const set = new Set(items.map((i) => i.chapter));
  return Array.from({ length: 13 }, (_, i) => i + 1).filter((c) => set.has(c));
}

export function toneClass(system: RomanSystem, tone: string): string {
  return system === 'jyutping' ? `tone jp-t${tone}` : `tone py-t${tone}`;
}

export const ENEMY_NAME = {
  bandit: '山賊',
  saber: '刀客',
  sword: '劍客',
  shadow: '黑衣人',
  boss: '頭目',
} as const;
