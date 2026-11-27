import { expect, test } from '@playwright/test';
import { ITEMS, answerInput, answerOf, currentPrompt, learnUntil, lookup, openHome } from './helpers';

async function startTest(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /測試模式/ }).click();
  await page.getByRole('button', { name: '開始測試' }).click();
}

test('pinyin prompt asks for pinyin and accepts numbered pinyin', async ({ page }) => {
  await openHome(page, { settings: { system: 'pinyin', testInstantFeedback: true } });
  await startTest(page);
  const p = await currentPrompt(page);
  expect(p.sys).toBe('pinyin');
  const input = page.getByRole('textbox', { name: '輸入拼音（數字標調）' });
  await expect(input).toHaveAttribute('placeholder', /zhong1guo2/);
  await input.fill(answerOf(p.text, 'pinyin'));
  await input.press('Enter');
  await expect(page.locator('.syl-feedback')).toContainText('完全正確');
});

test('jyutping prompt asks for jyutping and accepts e.g. "tin1"', async ({ page }) => {
  await openHome(page, { settings: { system: 'jyutping', testInstantFeedback: true } });
  expect(lookup('天').syllables[0].jyutping).toBe('tin1');
  await startTest(page);
  const p = await currentPrompt(page);
  expect(p.sys).toBe('jyutping');
  const input = page.getByRole('textbox', { name: '輸入粵拼（聲調 1–6）' });
  await expect(input).toHaveAttribute('placeholder', /gwong2dung1/);
  const jp = answerOf(p.text, 'jyutping');
  await input.fill(jp);
  await input.press('Enter');
  await expect(page.locator('.syl-feedback')).toContainText('完全正確');

  // explicit "tin1" check on 天 via the learn flow
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByRole('button', { name: '離開' }).click();
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await learnUntil(page, '天', 'jyutping');
  expect((await currentPrompt(page)).text).toBe('天');
  const box = await answerInput(page);
  await box.fill('tin1');
  await box.press('Enter');
  await expect(page.locator('.syl-feedback')).toContainText('完全正確');
});

test('雙拼: each item is asked twice — pinyin then jyutping', async ({ page }) => {
  await openHome(page, { settings: { system: 'both', testInstantFeedback: true } });
  await startTest(page);
  await expect(page.locator('.qpanel .counter')).toHaveText('第 1 / 20 題');
  const a = await currentPrompt(page);
  expect(a.sys).toBe('pinyin');
  let input = await answerInput(page);
  await input.fill(answerOf(a.text, 'pinyin'));
  await input.press('Enter');
  await expect(page.locator('.syl-feedback')).toContainText('完全正確');
  await page.keyboard.press('Enter');
  const b = await currentPrompt(page);
  expect(b).toEqual({ text: a.text, sys: 'jyutping' });
  input = page.getByRole('textbox', { name: /輸入粵拼/ });
  await expect(input).toBeFocused();
  await input.fill(answerOf(b.text, 'jyutping'));
  await input.press('Enter');
  await expect(page.locator('.syl-feedback')).toContainText('完全正確');
});

test('雙拼 study cards reveal both romanizations', async ({ page }) => {
  await openHome(page, { settings: { system: 'both' } });
  await page.getByRole('button', { name: /學習模式/ }).click();
  await page.getByRole('button', { name: /第一章/ }).click();
  await page.getByRole('button', { name: /第 1 課/ }).click();
  await expect(page.locator('.reveal-line')).toHaveCount(2);
  await expect(page.locator('.qpanel .counter')).toHaveText('1 / 40');
});

test('traditional vs simplified toggle changes displayed characters', async ({ page }) => {
  await openHome(page, { settings: { script: 'trad' } });
  await learnUntil(page, '来', 'pinyin');
  expect((await currentPrompt(page)).text).toBe('來');
  await expect(page.locator('.qpanel .hanzi-card')).toHaveText('來');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '返回', exact: true }).click();

  await page.getByRole('button', { name: /設定/ }).click();
  await page.getByRole('radiogroup', { name: '字體' }).getByRole('radio', { name: '简体' }).click();
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await learnUntil(page, '来', 'pinyin');
  await expect(page.locator('.qpanel .hanzi-card')).toHaveText('来');
  // lesson preview list also follows the setting
  await page.getByRole('button', { name: '返回', exact: true }).click();
  const preview = (await page.locator('.lesson-preview').allTextContents()).join('');
  for (const ch of preview.replace(/[・…]/g, '')) expect(ITEMS.some((i) => i.text === ch)).toBe(true);
});
