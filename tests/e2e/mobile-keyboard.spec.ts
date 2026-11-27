import { expect, test, type Page } from '@playwright/test';
import { answerInput, openHome } from './helpers';

// Headless Chromium has no on-screen keyboard. Fake the VisualViewport the way iOS Safari / Android Chrome
// report it (the keyboard shrinks the *visual* viewport) and check where the card ends up.
const KB = 330;

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const target = new EventTarget();
    const fake = Object.assign(target, { height: window.innerHeight, width: window.innerWidth, offsetTop: 0, offsetLeft: 0, scale: 1, pageTop: 0, pageLeft: 0 });
    Object.defineProperty(window, 'visualViewport', { get: () => fake, configurable: true });
    (window as unknown as { __kb: (px: number) => void }).__kb = (px: number) => {
      fake.height = window.innerHeight - px;
      fake.dispatchEvent(new Event('resize'));
    };
  });
});

async function openKeyboard(page: Page, px = KB) {
  await page.evaluate((n) => (window as unknown as { __kb: (n: number) => void }).__kb(n), px);
}

async function expectBottomAboveKeyboard(page: Page, selector: string, KB_ = KB) {
  const KB = KB_;
  await expect
    .poll(async () =>
      page.evaluate(
        ([sel, kb]) => {
          const el = document.querySelector(sel as string) as HTMLElement;
          const keyboardTop = window.innerHeight - (kb as number);
          return Math.round(keyboardTop - el.getBoundingClientRect().bottom); // gap between card and keyboard
        },
        [selector, KB],
      ),
    )
    .toBeGreaterThanOrEqual(4);
  const gap = await page.evaluate(
    ([sel, kb]) => window.innerHeight - (kb as number) - (document.querySelector(sel as string) as HTMLElement).getBoundingClientRect().bottom,
    [selector, KB],
  );
  // right above the keyboard — unless the page is already scrolled to the very top (card fully visible,
  // there is nothing above it to scroll away)
  const scrollY = await page.evaluate(() => window.scrollY);
  if (scrollY > 0) expect(gap).toBeLessThanOrEqual(14);
  expect(await page.evaluate(() => document.documentElement.classList.contains('kb-open'))).toBe(true);
}

test('learn card bottom sits right above the keyboard', async ({ page }) => {
  await openHome(page);
  await page.getByRole('button', { name: /學習模式/ }).click();
  await page.getByRole('button', { name: /第一章/ }).first().click();
  await page.getByRole('button', { name: /第 1 課/ }).first().click();
  await (await answerInput(page)).focus();
  await openKeyboard(page);
  await expectBottomAboveKeyboard(page, '.qpanel');
});

test('test-mode card bottom sits right above the keyboard', async ({ page }) => {
  await openHome(page);
  await page.getByRole('button', { name: /測試模式/ }).click();
  await page.getByRole('button', { name: /開始/ }).first().click();
  await (await answerInput(page)).focus();
  await openKeyboard(page);
  await expectBottomAboveKeyboard(page, '.qpanel');
});

test('challenge: word bubble and answer box both visible above the keyboard', async ({ page }) => {
  await openHome(page);
  await page.getByRole('button', { name: /挑戰模式/ }).click();
  await page.getByRole('button', { name: '第一章', exact: true }).click();
  await (await answerInput(page)).focus();
  await openKeyboard(page);
  await expectBottomAboveKeyboard(page, '.challenge-input');
  const bubbleTop = await page.evaluate(() => document.querySelector('.word-bubble')!.getBoundingClientRect().top);
  expect(bubbleTop).toBeGreaterThanOrEqual(0); // the prompt is not scrolled off the top
});

test('tall keyboard: card hidden behind it is scrolled up to sit right above it', async ({ page }) => {
  const big = 520; // leaves ~324px visible, less than the card's normal bottom position
  await openHome(page);
  await page.getByRole('button', { name: /測試模式/ }).click();
  await page.getByRole('button', { name: /開始/ }).first().click();
  const input = await answerInput(page);
  await input.focus();
  const before = await page.evaluate(() => document.querySelector('.qpanel')!.getBoundingClientRect().bottom);
  expect(before).toBeGreaterThan(844 - big); // would be covered by the keyboard
  await openKeyboard(page, big);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expectBottomAboveKeyboard(page, '.qpanel', big);
  const gap = await page.evaluate((kb) => window.innerHeight - kb - document.querySelector('.qpanel')!.getBoundingClientRect().bottom, big);
  expect(gap).toBeLessThanOrEqual(14);
  await expect(input).toBeInViewport();
});
