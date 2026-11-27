import { expect, test } from '@playwright/test';
import { answerCurrent, answerInput, currentPrompt, lookup, openHome, trackErrors } from './helpers';

test('learn: chapter 1 lesson 1 at 初級 — study, 自己試 quiz, lesson marked done', async ({ page }) => {
  test.setTimeout(120_000);
  const errs = trackErrors(page);
  await openHome(page);
  await page.getByRole('button', { name: /學習模式/ }).click();
  await expect(page.getByRole('button', { name: /第一章/ })).toContainText('0 /');
  await page.getByRole('button', { name: /第一章/ }).click();
  await page.getByRole('button', { name: /第 1 課/ }).click();

  const counter = page.locator('.qpanel .counter');
  await expect(counter).toHaveText(/^1 \/ \d+$/);
  const total = Number((await counter.textContent())!.split('/')[1].trim());
  expect(total).toBe(20);

  // study cards: answer is revealed; a wrong attempt must be retried
  const first = await currentPrompt(page);
  expect(lookup(first.text).level).toBe(1);
  expect(lookup(first.text).chapter).toBe(1);
  await expect(page.locator('.reveal')).toBeVisible();
  await answerCurrent(page, false);
  await expect(page.getByText('再試一次')).toBeVisible();
  await expect(counter).toHaveText(`1 / ${total}`);

  for (let i = 1; i <= total; i++) {
    await expect(counter).toHaveText(`${i} / ${total}`);
    await answerCurrent(page, true);
    const next = page.getByRole('button', { name: /下一題/ });
    await expect(next).toBeFocused(); // focus moves to "next" so Enter continues
    await page.keyboard.press('Enter');
  }

  // 自己試 quiz: answers hidden
  await expect(page.getByRole('status').filter({ hasText: '自己試' })).toBeVisible();
  await expect(page.locator('.reveal')).toHaveCount(0);
  const wrongOnes: string[] = [];
  for (let i = 1; i <= total; i++) {
    await expect(counter).toHaveText(`${i} / ${total}`);
    const ok = i !== 3; // get one wrong
    const p = await answerCurrent(page, ok);
    if (!ok) wrongOnes.push(lookup(p.text).id);
    await page.getByRole('button', { name: /下一題/ }).click();
  }
  await expect(page.locator('.summary .big-stat')).toHaveText(`${total - 1} / ${total}`);
  await expect(page.getByText('以下字詞已放入複習')).toBeVisible();

  const stored = await page.evaluate(() => ({
    progress: JSON.parse(localStorage.getItem('ctf:progress') ?? '{}'),
    srs: JSON.parse(localStorage.getItem('ctf:srs') ?? '{}'),
  }));
  expect(stored.progress.lessonsDone).toContain('L1-1-0');
  expect(Object.keys(stored.srs)).toHaveLength(total);
  expect(stored.srs[wrongOnes[0]].box).toBe(1);

  await page.getByRole('button', { name: '返回課程' }).click();
  await expect(page.getByRole('button', { name: /第 1 課/ })).toHaveClass(/done/);
  await expect(page.getByLabel('已完成')).toHaveCount(1);
  expect(errs).toEqual([]);
});

test('learn: Esc pauses, Esc resumes and focus returns to the answer box', async ({ page }) => {
  await openHome(page);
  await page.getByRole('button', { name: /學習模式/ }).click();
  await page.getByRole('button', { name: /第一章/ }).click();
  await page.getByRole('button', { name: /第 1 課/ }).click();
  const input = await answerInput(page);
  await expect(input).toBeFocused();
  await input.press('Escape');
  const dialog = page.getByRole('dialog', { name: '暫停' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: /繼續/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(input).toBeFocused();
  // Tab in learn mode gives a (free) hint during the quiz, not in study (answer shown)
  await input.press('Tab');
  await expect(input).toBeFocused();
});
