import { expect, test, type Page } from '@playwright/test';
import { answerCurrent, answerInput, currentPrompt, lookup, openHome, trackErrors } from './helpers';

/** Wait until the arena accepts input again (no miss/kill animation pending). */
async function ready(page: Page) {
  await expect(page.locator('.word-bubble .missed')).toHaveCount(0);
  await expect(page.locator('.fighter-right .anim-dead')).toHaveCount(0);
  await expect(await answerInput(page)).toBeEnabled();
}

const hearts = (page: Page) => page.getByRole('img', { name: /^生命/ });

test('challenge stage 1 初級: hits, combo, miss, timeout, pause, game over → leaderboard', async ({ page }) => {
  test.setTimeout(120_000);
  const errs = trackErrors(page);
  await page.clock.install();
  await openHome(page);
  await page.getByRole('button', { name: /挑戰模式/ }).click();
  await expect(page.getByRole('button', { name: /第二章（未解鎖）/ })).toBeDisabled();
  await page.getByRole('button', { name: '第一章', exact: true }).click();
  await expect(hearts(page)).toHaveAttribute('aria-label', '生命 5 / 5');
  const enemyHp = page.getByRole('progressbar', { name: /血量/ });
  await expect(enemyHp).toHaveAttribute('aria-label', /1\/5 血量/);
  const maxHp = Number(await enemyHp.getAttribute('aria-valuemax'));

  // prompt is a level-1 chapter-1 char
  const p0 = await currentPrompt(page);
  expect(p0.sys).toBe('pinyin');
  expect(lookup(p0.text).kind).toBe('char');

  // correct answer → damage + score
  await answerCurrent(page, true);
  await expect(page.locator('.hud .score')).not.toHaveText('0');
  await expect.poll(async () => Number(await enemyHp.getAttribute('aria-valuenow'))).toBeLessThan(maxHp);
  await ready(page);
  await answerCurrent(page, true);
  await expect(page.locator('.hud .combo')).toHaveText('2 連擊');

  // keep hitting until the first enemy is defeated
  for (let i = 0; i < 5; i++) {
    if ((await enemyHp.getAttribute('aria-label'))?.includes('2/5')) break;
    await ready(page);
    await answerCurrent(page, true);
  }
  await expect(enemyHp).toHaveAttribute('aria-label', /2\/5 血量/);
  await ready(page);
  const combo = await page.locator('.hud .combo').textContent();
  expect(Number(combo?.match(/\d+/)?.[0])).toBeGreaterThanOrEqual(3);

  // wrong answer → lose a heart, combo resets, answer shown
  await answerCurrent(page, false);
  await expect(hearts(page)).toHaveAttribute('aria-label', '生命 4 / 5');
  await expect(page.locator('.word-bubble .missed')).toContainText('正解');
  await expect(page.locator('.hud .combo')).not.toContainText('連擊');
  await ready(page);

  // Esc pauses; the countdown does not run while paused
  await (await answerInput(page)).press('Escape');
  await expect(page.getByRole('dialog', { name: '暫停' })).toBeVisible();
  await page.clock.runFor(20_000);
  await expect(hearts(page)).toHaveAttribute('aria-label', '生命 4 / 5');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '暫停' })).toHaveCount(0);
  await expect(await answerInput(page)).toBeFocused();

  // timeout (12 s at 初級) → lose a heart
  await page.clock.runFor(12_200);
  await expect(hearts(page)).toHaveAttribute('aria-label', '生命 3 / 5');
  await ready(page);

  // three more misses → game over
  for (const left of [2, 1, 0]) {
    await answerCurrent(page, false);
    await expect(hearts(page)).toHaveAttribute('aria-label', `生命 ${left} / 5`);
    if (left > 0) await ready(page);
  }
  const over = page.getByRole('dialog', { name: '敗陣' });
  await expect(over).toBeVisible();
  const finalScore = (await over.locator('.stats dd').first().textContent())!.trim();
  const nameBox = over.getByPlaceholder('俠名');
  await expect(nameBox).toBeFocused();
  await nameBox.fill('測試俠');
  await over.getByRole('button', { name: '留名' }).click();
  await expect(over.locator('.mini-board li.me')).toContainText('測試俠');

  await over.getByRole('button', { name: '選關' }).click();
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByRole('button', { name: /排行榜/ }).click();
  const row = page.getByRole('row').filter({ hasText: '測試俠' });
  await expect(row).toContainText(finalScore);
  await expect(row).toContainText('第一章');
  await expect(row).toContainText('初級');
  expect(errs).toEqual([]);
});

test('challenge endless mode starts and plays', async ({ page }) => {
  await openHome(page);
  await page.getByRole('button', { name: /挑戰模式/ }).click();
  await page.getByRole('button', { name: /無盡模式/ }).click();
  await expect(page.getByRole('heading', { name: '無盡模式' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: /#1 血量/ })).toBeVisible();
  await answerCurrent(page, true);
  await expect(page.locator('.hud .score')).not.toHaveText('0');
});

test('challenge at 高級 has 1 heart and harder prompts', async ({ page }) => {
  await openHome(page, { settings: { level: 3 } });
  await page.getByRole('button', { name: /挑戰模式/ }).click();
  await page.getByRole('button', { name: '第一章', exact: true }).click();
  await expect(hearts(page)).toHaveAttribute('aria-label', '生命 1 / 1');
  const p = await currentPrompt(page);
  expect(lookup(p.text).syllables.length).toBeGreaterThanOrEqual(3);
  // toneless answer is rejected at 高級
  const input = await answerInput(page);
  await input.fill(lookup(p.text).syllables.map((s) => s.pinyin.replace(/\d$/, '')).join(''));
  await input.press('Enter');
  await expect(hearts(page)).toHaveAttribute('aria-label', '生命 0 / 1');
  await expect(page.getByRole('dialog', { name: '敗陣' })).toBeVisible();
});

test('clearing stage 1 (5 grunts + boss) unlocks stage 2', async ({ page }) => {
  test.setTimeout(120_000);
  const errs = trackErrors(page);
  await openHome(page);
  await page.getByRole('button', { name: /挑戰模式/ }).click();
  await page.getByRole('button', { name: '第一章', exact: true }).click();
  const clear = page.getByRole('dialog', { name: '過關' });
  let sawBoss = false;
  for (let i = 0; i < 60; i++) {
    // wait until either the stage is cleared or the next enemy is ready
    await expect
      .poll(async () => (await clear.count()) > 0 || (await page.locator('.fighter-right .anim-dead').count()) === 0)
      .toBe(true);
    if (await clear.count()) break;
    await ready(page);
    if (await page.locator('.word-bubble .boss-tag').count()) sawBoss = true;
    await answerCurrent(page, true);
  }
  await expect(clear).toBeVisible();
  expect(sawBoss).toBe(true);
  await expect(clear).toContainText('已解鎖 第二章');
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('ctf:progress') ?? '{}'));
  expect(progress.unlockedStage).toBe(2);
  await clear.getByRole('button', { name: '選關' }).click();
  await expect(page.getByRole('button', { name: '第二章', exact: true })).toBeEnabled();
  expect(errs).toEqual([]);
});
