import { expect, test } from '@playwright/test';
import { answerCurrent, answerInput, currentPrompt, lookup, openHome, trackErrors } from './helpers';

const DAY = 24 * 60 * 60 * 1000;

test('test mode: 10 questions → grade, accuracy, analysis, hints counted, 加入複習 → due tomorrow', async ({ page }) => {
  const errs = trackErrors(page);
  const t0 = new Date('2026-03-01T09:00:00Z').getTime();
  await page.clock.install({ time: t0 });
  await openHome(page);
  await expect(page.locator('.review-banner strong')).toHaveText('0');
  await page.getByRole('button', { name: /測試模式/ }).click();
  await page.getByRole('radio', { name: '10 題' }).click();
  await page.getByRole('button', { name: '開始測試' }).click();

  const counter = page.locator('.qpanel .counter');
  const wrongIds = new Set<string>();
  let hintedId = '';
  for (let i = 1; i <= 10; i++) {
    await expect(counter).toHaveText(`第 ${i} / 10 題`);
    if (i === 1) {
      // three hint levels with their penalties
      const input = await answerInput(page);
      const hintText = page.locator('.hint-text');
      await expect(hintText).toContainText('每級提示會扣分');
      await input.press('Tab');
      await expect(hintText).toContainText('聲母');
      await expect(hintText.locator('.penalty')).toHaveText('−10%');
      await input.press('Tab');
      await expect(hintText).toContainText('無調拼音');
      await expect(hintText.locator('.penalty')).toHaveText('−30%');
      await input.press('Tab');
      await expect(hintText).toContainText('完整答案');
      await expect(hintText.locator('.penalty')).toHaveText('−60%');
      await expect(page.getByRole('button', { name: '已顯示全部提示' })).toBeDisabled();
      await expect(input).toBeFocused();
      hintedId = lookup((await currentPrompt(page)).text).id;
    }
    const ok = i <= 6; // 6 right, 4 wrong
    const p = await answerCurrent(page, ok);
    if (!ok) wrongIds.add(lookup(p.text).id);
  }

  // results
  await expect(page.getByLabel('等級 C')).toBeVisible(); // 60% → C
  const stats = page.locator('.result-head .stats');
  await expect(stats).toContainText('60%');
  await expect(stats).toContainText('6 / 10');
  await expect(stats).toContainText('1 題'); // questions that used any hint (3 levels on one question)
  await expect(page.getByRole('heading', { name: '錯誤分析' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '聲母混淆' })).toBeVisible();
  await expect(page.locator('.bar-list li').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '錯題（4）' })).toBeVisible();
  await expect(page.locator('.wrong-list li')).toHaveCount(4);

  // test history stored
  const tests = await page.evaluate(() => JSON.parse(localStorage.getItem('ctf:tests') ?? '[]'));
  expect(tests).toHaveLength(1);
  expect(tests[0]).toMatchObject({ total: 10, correct: 6, grade: 'C', hintsUsed: 1 });

  // 加入複習: 4 wrong + the item answered with the full-answer hint
  const addBtn = page.getByRole('button', { name: /加入複習/ });
  await expect(addBtn).toHaveText('加入複習（5）');
  await addBtn.click();
  await expect(page.getByRole('button', { name: '✓ 已加入複習' })).toBeDisabled();
  const srs = await page.evaluate(() => JSON.parse(localStorage.getItem('ctf:srs') ?? '{}'));
  expect(Object.keys(srs).sort()).toEqual([...wrongIds, hintedId].sort());
  for (const c of Object.values(srs) as { box: number; due: number }[]) {
    expect(c.box).toBe(1);
    expect(c.due).toBeGreaterThanOrEqual(t0 + DAY);
  }

  // home: nothing due today, 5 due tomorrow
  await page.getByRole('button', { name: '返回', exact: true }).click(); // result → setup
  await page.getByRole('button', { name: '返回', exact: true }).click(); // setup → home
  await expect(page.locator('.review-banner strong')).toHaveText('0');
  await page.clock.setSystemTime(t0 + DAY + 60_000);
  await page.getByRole('button', { name: /設定/ }).click();
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await expect(page.locator('.review-banner strong')).toHaveText('5');
  await expect(page.locator('.review-banner')).toBeEnabled();
  // review session contains exactly those items
  await page.locator('.review-banner').click();
  await expect(page.getByRole('status').filter({ hasText: '複習 5 個字詞' })).toBeVisible();
  expect(errs).toEqual([]);
});

test('hints off: no 💡, Tab does not reveal hints (test + challenge)', async ({ page }) => {
  await openHome(page, { settings: { hintsEnabled: false } });
  await page.getByRole('button', { name: /測試模式/ }).click();
  await expect(page.getByText(/提示關/)).toBeVisible();
  await page.getByRole('button', { name: '開始測試' }).click();
  const input = await answerInput(page);
  await expect(input).toBeFocused();
  await expect(page.getByRole('button', { name: /提示/ })).toHaveCount(0);
  await expect(page.locator('.hint-bar, .hint-text')).toHaveCount(0);
  await input.press('Tab');
  await expect(page.locator('.hint-bar, .hint-text')).toHaveCount(0);
  await expect(page.getByText('💡')).toHaveCount(0);
  // tone colours are hint-only: prompt characters are not tone-coloured
  await expect(page.locator('.qpanel .hanzi-char.tone')).toHaveCount(0);

  await page.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByRole('button', { name: '離開' }).click();
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByRole('button', { name: /挑戰模式/ }).click();
  await page.getByRole('button', { name: '第一章', exact: true }).click();
  const cInput = await answerInput(page);
  await expect(cInput).toBeFocused();
  await cInput.press('Tab');
  await expect(page.locator('.hint-bar, .hint-text')).toHaveCount(0);
  await expect(page.getByText('💡')).toHaveCount(0);
});

test('test mode with instant feedback shows per-syllable result and keeps keyboard flow', async ({ page }) => {
  await openHome(page, { settings: { testInstantFeedback: true } });
  await page.getByRole('button', { name: /測試模式/ }).click();
  await page.getByRole('button', { name: '開始測試' }).click();
  await answerCurrent(page, false);
  await expect(page.locator('.syl-feedback')).toContainText('錯誤');
  await expect(page.getByRole('button', { name: /下一題/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.qpanel .counter')).toHaveText('第 2 / 10 題');
  await expect(await answerInput(page)).toBeFocused();
  await answerCurrent(page, true);
  await expect(page.locator('.syl-feedback')).toContainText('完全正確');
});
