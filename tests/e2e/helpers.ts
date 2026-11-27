import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page } from '@playwright/test';

interface Syl {
  hanzi: string;
  hanziTrad: string;
  pinyin: string;
  jyutping: string;
}
export interface Item {
  id: string;
  kind: string;
  text: string;
  textTrad: string;
  syllables: Syl[];
  level: number;
  freq: number;
  chapter: number;
}

const dataDir = fileURLToPath(new URL('../../public/data/', import.meta.url));
export const ITEMS: Item[] = ['chars', 'words', 'phrases'].flatMap(
  (f) => (JSON.parse(readFileSync(`${dataDir}${f}.json`, 'utf8')) as { items: Item[] }).items,
);
const byText = new Map<string, Item>();
for (const it of ITEMS) {
  byText.set(it.text, it);
  byText.set(it.textTrad, it);
}

export type Sys = 'pinyin' | 'jyutping';

export function lookup(text: string): Item {
  const it = byText.get(text);
  if (!it) throw new Error(`prompt "${text}" not found in data`);
  return it;
}

export function answerOf(text: string, sys: Sys): string {
  return lookup(text)
    .syllables.map((s) => s[sys])
    .join('');
}

/** A syntactically valid but wrong answer for the given system. */
export function wrongAnswerOf(text: string, sys: Sys): string {
  const n = lookup(text).syllables.length;
  const syl = sys === 'pinyin' ? 'xx' : 'qq';
  const right = answerOf(text, sys);
  const w = Array.from({ length: n }, () => `${syl}1`).join('');
  return w === right ? 'zzz' : w;
}

/** Container holding the current question (learn/test panel or challenge bubble). */
function promptBox(page: Page): Locator {
  return page.locator('.qpanel, .word-bubble').first();
}

export async function currentPrompt(page: Page): Promise<{ text: string; sys: Sys }> {
  const box = promptBox(page);
  const text = (await box.locator('.hanzi-card').first().getAttribute('aria-label')) ?? '';
  const tag = (await box.locator('.sys-tag').first().textContent()) ?? '';
  return { text, sys: tag.includes('粵') ? 'jyutping' : 'pinyin' };
}

export async function answerInput(page: Page): Promise<Locator> {
  return page.getByRole('textbox', { name: /輸入(拼音|粵拼)/ });
}

/** Type the answer for the visible prompt and press Enter. Returns the prompt answered. */
export async function answerCurrent(page: Page, correct: boolean) {
  const p = await currentPrompt(page);
  const input = await answerInput(page);
  await expect(input).toBeEnabled();
  await input.fill(correct ? answerOf(p.text, p.sys) : wrongAnswerOf(p.text, p.sys));
  await input.press('Enter');
  return p;
}

export interface Seed {
  settings?: Record<string, unknown>;
  progress?: Record<string, unknown>;
}

const DEFAULTS = {
  system: 'pinyin',
  level: 1,
  hintsEnabled: true,
  script: 'trad',
  soundOn: false,
  ttsOn: false,
  testInstantFeedback: false,
  theme: 'light',
};

/** Seed localStorage once (before first load) and open the home screen with data loaded. */
export async function openHome(page: Page, seed: Seed = {}) {
  await page.addInitScript(
    ([settings, progress]) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.clear();
      localStorage.setItem('ctf:settings', JSON.stringify(settings));
      if (progress) localStorage.setItem('ctf:progress', JSON.stringify(progress));
    },
    [{ ...DEFAULTS, ...seed.settings }, seed.progress ?? null] as const,
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: /學習模式/ })).toBeEnabled();
}

/** Collect console errors / page errors for the whole test. */
export function trackErrors(page: Page): string[] {
  const errs: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text());
  });
  page.on('pageerror', (e) => errs.push(e.message));
  return errs;
}

export async function back(page: Page) {
  await page.getByRole('button', { name: '返回', exact: true }).click();
}

export async function noHorizontalScroll(page: Page, where: string) {
  const [sw, iw] = await page.evaluate(() => [document.scrollingElement!.scrollWidth, window.innerWidth]);
  expect(sw, `horizontal scroll on ${where}`).toBeLessThanOrEqual(iw);
}

const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三'];

/**
 * Open the 初級 learn lesson containing the given level-1 char and type correct study answers
 * until that char is the current card (replicates engine lessonItems ordering).
 */
export async function learnUntil(page: Page, text: string, sys: Sys) {
  const target = lookup(text);
  const list = ITEMS.filter((i) => i.chapter === target.chapter && i.kind === 'char' && i.level === 1).sort(
    (a, b) => a.level - b.level || b.freq - a.freq || (a.id < b.id ? -1 : 1),
  );
  const pos = list.findIndex((i) => i.id === target.id);
  if (pos < 0) throw new Error(`${text} is not a 初級 lesson item`);
  await page.getByRole('button', { name: /學習模式/ }).click();
  await page.getByRole('button', { name: new RegExp(`第${CN[target.chapter]}章`) }).click();
  await page.getByRole('button', { name: `第 ${Math.floor(pos / 20) + 1} 課` }).click();
  for (let k = 0; k < pos % 20; k++) {
    const cur = await currentPrompt(page);
    const box = await answerInput(page);
    await box.fill(answerOf(cur.text, sys));
    await box.press('Enter');
    await page.getByRole('button', { name: /下一題/ }).click();
  }
  await expect(page.locator('.qpanel .counter')).toHaveText(new RegExp(`^${(pos % 20) + 1} /`));
}
