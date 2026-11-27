# QA Report — 拼音打字俠 Chinese Typing Fighter

Date: 2026-11-27 · Scope: PLAN.md §3–5 and the §8 checklist · Build under test: current working tree (real data, 5,000 items)

## Results summary

| Check | Result |
|---|---|
| `npm test` (Vitest, engine) | **65 / 65 passed** (4 files) |
| `npm run e2e` (Playwright 1.56.1, Chromium) | **20 / 20 passed** (5 spec files; 3 consecutive green runs) |
| `npx tsc -b` | pass |
| `npm run lint` | pass (0 problems) |
| `npm run build` | pass |

## Setup added

- `@playwright/test@1.56.1` (exact pin) devDependency; Chromium installed via `npx playwright install chromium`.
- `playwright.config.ts`: `testDir: tests/e2e`, webServer `npm run dev -- --port 5175 --strictPort`, `baseURL http://localhost:5175`, trace kept on failure.
- `npm run e2e` → `playwright test`. Vitest stays limited to `src/**/*.test.{ts,tsx}`, so it ignores `tests/e2e`.
- ESLint now ignores `test-results/` and `playwright-report/`. Both are also listed in `.gitignore`.

## E2E coverage (`tests/e2e/`)

The tests avoid fixed waits. To answer a question, a test reads the prompt from the DOM (the `aria-label` of `HanziCard` and the system tag), then looks up the answer in `public/data/*.json`. Both `text` and `textTrad` are unique across the data, which this lookup depends on. `localStorage` is seeded once per test with sound and TTS off. Time-based checks use `page.clock`.

| Spec | What it verifies |
|---|---|
| `basics.spec.ts` | Home loads all 3 JSON files (HTTP 200) with no alert or loading state. Settings (system, level, hints, script, theme) persist across a reload. The full screen tour (home, settings, leaderboard, charts in both tabs, learn chapters/lessons/study, test setup/run/result, challenge select/arena/pause) runs at **375 px and 1280 px**, in **light and dark**. On every screen it asserts `scrollWidth <= innerWidth` and **no console or page errors**. |
| `learn.spec.ts` | Chapter 1, lesson 1 at 初級 is 20 level-1 chapter-1 items. A wrong study answer has to be retried. After each correct study card, focus moves to 下一題 and Enter advances. The 自己試 quiz hides answers; one wrong answer gives 19/20. The lesson is saved as `L1-1-0` and shown with ✓. SRS has 20 cards, and the wrong one is in box 1. Esc pauses, Esc resumes, and focus goes back to the input. |
| `test-mode.spec.ts` | A 10-question test with 6 right and 4 wrong gives grade **C** and **60%**, shows 使用提示 3 次, the error analysis (聲母/韻母/聲調), and 錯題(4). Tab moves through hint levels 1, 2 and 3, showing **−10% / −30% / −60%**, and focus stays in the input. History is saved. 加入複習 stores 5 cards (4 wrong + 1 answered with the full-answer hint) due tomorrow. Home shows 今日需複習 **0**; after moving the clock forward a day it shows **5**, and the review session holds 5 items. With hints **off**: no 💡, Tab shows no hint and there is no tone colouring, in both test and challenge. With instant feedback on: the per-syllable result shows, and focus moves to 下一題 and then back to the next input. |
| `challenge.spec.ts` | Stage 1 at 初級: 5 hearts. A correct answer adds score and lowers enemy HP. The combo counter reaches `2 連擊` and keeps rising; the enemy is defeated and the HUD shows 2/5. A wrong answer costs a heart, resets the combo and shows 正解. **Esc pauses**: 20 s of fake time while paused costs no heart. Resume puts focus back in the input. A **12 s timeout** costs a heart. At game over, the name box is focused and 留名 adds the player to the mini leaderboard; the 排行榜 screen then has a row with the score, 第一章 and 初級. **Clearing stage 1** (5 grunts, then the boss) shows 過關, saves `unlockedStage: 2` and enables 第二章. **Endless** mode starts and scores. At **高級** there is 1 heart, prompts are 3+ characters, and an answer without tones is rejected. |
| `systems.spec.ts` | Pinyin prompt, label and placeholder are correct, and a numbered answer is accepted. Jyutping prompt, label and placeholder are correct; 天 is answered with **`tin1`** and accepted. **雙拼** asks pinyin and then jyutping for the same item (20 questions for 10 items), and study cards show both readings (40 cards). **Traditional vs simplified**: the same lesson card shows 來 in 繁體 and 来 in 简体, and lesson previews follow the setting. |

### Engine probes (exploratory, not committed)

- A throwaway Vitest run checked every item in the real data, about 5,000 items × 2 systems. Each canonical answer was accepted in three forms: spaced, unspaced, and the level-3 hint text with diacritics. **0 failures.**
- Edge inputs also behaved correctly: `lü4`, `lu:4`, `LV4`, `xi'an` versus `xian`, `zhōngguó`, `hao 3`, jyutping `ng5`, `m4` and `hoeng1gong2`, missing/extra syllables, toneless jyutping at 初級 versus 中級, and neutral `de`/`de4`.
- **No engine bugs found**, so no new engine unit test was needed. (The data never uses `ü` in canonical answers; it is always `v`.)

## Bugs found and fixed

| # | Severity | Bug | Fix |
|---|---|---|---|
| 1 | **High** | **Esc could not pause in any mode** (Learn, Test, Challenge). Pressing Esc in the answer box opened the pause overlay, and the same keydown then reached the overlay's new `window` Esc listener (React commits synchronously during the discrete event), which closed it again straight away. In Challenge the timer kept running. | `src/ui/components/AnswerInput.tsx:52` stops the Esc keydown from propagating after handling it. `src/ui/components/Common.tsx:31-44` registers the overlay listener directly and documents why. |
| 2 | Medium | **Focus was lost after the pause overlay closed** in Learn and Test. Focus ended up on `<body>`, so the player had to click back into the input. | `src/ui/components/Common.tsx:19-30`: `Overlay` remembers the element that had focus when it opened and focuses it again after the overlay unmounts. This is deferred so StrictMode's simulated unmount doesn't take focus away from the dialog. |
| 3 | Low | Challenge: pausing during the hit/miss animation (850 / 1400–1900 ms) let the pending timer start the next question **while paused**. On resume, `qStart` moved into the future, which gave free extra time and made the countdown bar overflow (`scaleX > 1`). | `src/ui/screens/Challenge.tsx:236`: `G.qStart = G.pauseAt ?? performance.now()`. |
| 4 | Low (spec gap) | PLAN §4 says hint level 3 (full answer) means the item "記為需複習", but in Test mode 加入複習 only added wrong answers. | `src/ui/screens/Test.tsx:195,313,322,327`: the review set is wrong items plus items answered with hint level 3, and the button shows the count. |
| 5 | Cosmetic | The Challenge 失手！/超時！ floater used `--ink`. In dark mode it was light-on-light where it overlapped the hero's white robe and was hard to read. | `src/App.css:1520`: `.floater.miss` now uses `var(--seal)`. |

## Remaining issues / observations (not fixed)

| Severity | Issue |
|---|---|
| Low | Esc pauses only while the answer input has focus. If the player clicks elsewhere in the arena (for example on the backdrop), Esc does nothing until they click back into the input. The ⏸ button still works. A global Esc handler for Challenge would make this more robust. |
| Low | In Challenge, Enter during the miss/kill lock (about 0.85–1.9 s) is silently ignored, and the typed text stays in the box until the next question clears it. There is no visual "locked" state on the input. |
| Low | A level-1 hint for a zero-initial syllable (for example `ai4`) shows only `_`, which tells the player almost nothing. |
| Low | Test results: `使用提示 N 次` adds up hint *levels* (3 Tab presses on one question count as 3). That's arguably fine, but the wording suggests a count of questions. The tone-confusion matrix also shows rows for tones that only appear as "given" tones, so some rows are empty. |
| Low | 拼音表: the example for final `un` is 問 `wèn`, which is the w-spelling of *uen*. Something like 春 `chūn` would show the final better. |
| Cosmetic | At 375 px the 失手！ floater can overlap the bottom edge of the word bubble during its float-up animation. |
| Info | Dev-only: in this sandbox the Vite file watcher did not pick up edits, so the running dev server served stale modules until it was restarted. Playwright starts its own server when none is running, which is the reliable path. |
| Info | A score of 0 at game over gives no name-entry form. This is intentional, but tests have to score at least once before testing the leaderboard. |

## Exploratory pass notes

- Screenshots were reviewed at 375 px and 1280 px, in light and dark, for home, settings, charts, learn study/wrong-answer/pause, test result, challenge select/arena/miss/game over. No overlapping UI blocks, no horizontal scroll, and contrast in dark mode is acceptable. The grade stamp "D" and history grade are low-emphasis grey by design.
- Keyboard: Enter submits. After feedback, focus moves to 下一題, so Enter advances. Tab steps through hint levels without moving focus, and with hints off Tab moves focus normally. Esc now pauses and resumes (fix 1), and focus returns to the input (fix 2). The game-over name box and the result-screen primary buttons get focus automatically.
