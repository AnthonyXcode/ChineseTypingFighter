import { expect, test } from '@playwright/test';
import { answerCurrent, answerInput, currentPrompt, lookup, openHome } from './helpers';

test('learn: 為甚麼？ toggles the explanation, keeps focus, and stays open on the next card', async ({ page }) => {
  await openHome(page);
  await page.getByRole('button', { name: /學習模式/ }).click();
  await page.getByRole('button', { name: /第一章/ }).first().click();
  await page.getByRole('button', { name: /第 1 課/ }).first().click();

  const input = await answerInput(page);
  await expect(input).toBeFocused();
  const toggle = page.getByRole('button', { name: /為甚麼？/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('region', { name: '讀音解說' })).toHaveCount(0);

  await toggle.click();
  const box = page.getByRole('region', { name: '讀音解說' });
  await expect(box).toBeVisible();
  await expect(input).toBeFocused(); // clicking the toggle does not steal focus

  const p = await currentPrompt(page);
  const syl = lookup(p.text).syllables[0];
  await expect(box).toContainText('聲母');
  await expect(box).toContainText('韻母');
  await expect(box).toContainText('聲調');
  await expect(box).toContainText(syl.jyutping); // the other system is shown for comparison

  // finish this card: the open state persists on the next one
  await input.fill(syl.pinyin);
  await input.press('Enter');
  await page.getByRole('button', { name: /下一題/ }).click();
  await expect(page.getByRole('region', { name: '讀音解說' })).toBeVisible();
  await page.getByRole('button', { name: /收起解說/ }).click();
  await expect(page.getByRole('region', { name: '讀音解說' })).toHaveCount(0);
});

test('test results: each wrong answer has its own 為甚麼？', async ({ page }) => {
  await openHome(page, { settings: { testInstantFeedback: false } });
  await page.getByRole('button', { name: /測試模式/ }).click();
  await page.getByRole('button', { name: /開始/ }).first().click();
  for (let i = 0; i < 10; i++) await answerCurrent(page, i % 2 === 0);
  const rows = page.locator('.wrong-list > li');
  await expect(rows).toHaveCount(5);
  await rows.nth(1).getByRole('button', { name: /為甚麼？/ }).click();
  await expect(rows.nth(1).getByRole('region', { name: '讀音解說' })).toBeVisible();
  await expect(rows.nth(0).getByRole('region', { name: '讀音解說' })).toHaveCount(0);
});

test('challenge: a miss offers 為甚麼？', async ({ page }) => {
  await page.clock.install();
  await openHome(page);
  await page.getByRole('button', { name: /挑戰模式/ }).click();
  await page.getByRole('button', { name: '第一章', exact: true }).click();
  await answerCurrent(page, false);
  await page.getByRole('button', { name: /為甚麼？/ }).click();
  await expect(page.getByRole('region', { name: '讀音解說' })).toBeVisible();
  await expect(await answerInput(page)).toBeFocused();
});

test('settings: 答案解說 switch opens the box automatically', async ({ page }) => {
  await openHome(page, { settings: { showReason: true } });
  await page.getByRole('button', { name: /學習模式/ }).click();
  await page.getByRole('button', { name: /第一章/ }).first().click();
  await page.getByRole('button', { name: /第 1 課/ }).first().click();
  await expect(page.getByRole('region', { name: '讀音解說' })).toBeVisible();
});
