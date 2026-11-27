import { expect, test } from '@playwright/test';
import { ITEMS, back, noHorizontalScroll, openHome, trackErrors } from './helpers';

test('home loads real data without error state', async ({ page }) => {
  const errs = trackErrors(page);
  const dataReqs: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/data/')) dataReqs.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  await openHome(page);
  await expect(page.getByRole('heading', { name: '拼音打字俠' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('載入字詞中')).toHaveCount(0);
  for (const name of [/學習模式/, /測試模式/, /挑戰模式/]) await expect(page.getByRole('button', { name })).toBeEnabled();
  expect(dataReqs.sort()).toEqual(['200 /data/chars.json', '200 /data/phrases.json', '200 /data/words.json']);
  expect(ITEMS.length).toBeGreaterThan(4000);
  // lesson list for chapter 1 is built from real data
  await page.getByRole('button', { name: /學習模式/ }).click();
  await expect(page.getByRole('button', { name: /第一章/ })).toContainText(/\d+ 課/);
  expect(errs).toEqual([]);
});

test('settings persist across reload', async ({ page }) => {
  await openHome(page);
  await page.getByRole('button', { name: /設定/ }).click();
  await page.getByRole('radiogroup', { name: '練習系統' }).getByRole('radio', { name: '粵拼' }).click();
  await page.getByRole('radiogroup', { name: '強度' }).getByRole('radio', { name: '中級' }).click();
  await page.getByRole('switch', { name: '提示' }).click();
  await page.getByRole('radiogroup', { name: '字體' }).getByRole('radio', { name: '简体' }).click();
  await page.getByRole('radiogroup', { name: '外觀' }).getByRole('radio', { name: '墨夜' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await expect(page.getByRole('button', { name: /學習模式/ })).toBeEnabled();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ctf:settings') ?? '{}'));
  expect(stored).toMatchObject({ system: 'jyutping', level: 2, hintsEnabled: false, script: 'simp', theme: 'dark' });
  await expect(page.getByRole('radiogroup', { name: '練習系統' }).getByRole('radio', { name: '粵拼' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radiogroup', { name: '強度' }).getByRole('radio', { name: '中級' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('switch', { name: '提示開關' })).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: /設定/ }).click();
  await expect(page.getByRole('radiogroup', { name: '字體' }).getByRole('radio', { name: '简体' })).toHaveAttribute('aria-checked', 'true');
});

for (const width of [375, 1280]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`every screen: no console errors, no horizontal scroll (${width}px, ${theme})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      const errs = trackErrors(page);
      await openHome(page, { settings: { theme } });
      await noHorizontalScroll(page, 'home');
      const simple: [RegExp, string][] = [
        [/設定/, 'settings'],
        [/排行榜/, 'leaderboard'],
        [/拼音表/, 'charts'],
      ];
      for (const [btn, name] of simple) {
        await page.getByRole('button', { name: btn }).click();
        await noHorizontalScroll(page, name);
        if (name === 'charts') {
          await page.getByRole('radio', { name: '粵語粵拼' }).click();
          await noHorizontalScroll(page, 'charts-jyutping');
        }
        await back(page);
      }
      // learn
      await page.getByRole('button', { name: /學習模式/ }).click();
      await noHorizontalScroll(page, 'learn-chapters');
      await page.getByRole('button', { name: /第一章/ }).click();
      await noHorizontalScroll(page, 'learn-lessons');
      await page.getByRole('button', { name: /第 1 課/ }).click();
      await expect(page.locator('.qpanel')).toBeVisible();
      await noHorizontalScroll(page, 'learn-study');
      await back(page);
      await back(page);
      await back(page);
      // test
      await page.getByRole('button', { name: /測試模式/ }).click();
      await noHorizontalScroll(page, 'test-setup');
      await page.getByRole('radio', { name: '指定章節' }).click();
      await noHorizontalScroll(page, 'test-setup-chapters');
      await page.getByRole('radio', { name: '全書' }).click();
      await page.getByRole('button', { name: '開始測試' }).click();
      await noHorizontalScroll(page, 'test-run');
      for (let i = 0; i < 10; i++) {
        const input = page.getByRole('textbox', { name: /輸入拼音/ });
        await input.fill('ma1');
        await input.press('Enter');
      }
      await expect(page.getByLabel(/等級/)).toBeVisible();
      await noHorizontalScroll(page, 'test-result');
      await back(page);
      await back(page);
      // challenge
      await page.getByRole('button', { name: /挑戰模式/ }).click();
      await noHorizontalScroll(page, 'challenge-select');
      await page.getByRole('button', { name: '第一章', exact: true }).click();
      await expect(page.locator('.arena')).toBeVisible();
      await noHorizontalScroll(page, 'challenge-arena');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: '暫停' })).toBeVisible();
      await noHorizontalScroll(page, 'challenge-pause');
      await page.getByRole('button', { name: '離開' }).click();
      await back(page);
      expect(errs).toEqual([]);
    });
  }
}
