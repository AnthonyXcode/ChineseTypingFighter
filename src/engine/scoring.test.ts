import { describe, expect, it } from 'vitest';
import {
  BOX_INTERVAL_DAYS,
  DAY_MS,
  HINT_PENALTY,
  LEVEL_MULTIPLIER,
  analyzeTest,
  checkAnswer,
  comboMultiplierFor,
  dueIds,
  getHint,
  gradeFor,
  reviewCard,
  scoreAnswer,
} from './index';
import type { SrsState } from './index';
import { mkItem, mkQ } from './testFixtures';

describe('scoreAnswer', () => {
  const base = { level: 1 as const, correct: true, combo: 0, timeLeftRatio: 1, hintPenalty: 0 };
  it('base points and level multipliers', () => {
    expect(LEVEL_MULTIPLIER).toEqual({ 1: 1, 2: 1.5, 3: 2 });
    expect(scoreAnswer(base)).toEqual({ points: 100, newCombo: 1, comboMultiplier: 1, special: false });
    expect(scoreAnswer({ ...base, level: 2 }).points).toBe(150);
    expect(scoreAnswer({ ...base, level: 3 }).points).toBe(200);
  });
  it('time bonus and hint penalty', () => {
    expect(scoreAnswer({ ...base, timeLeftRatio: 0 }).points).toBe(50);
    expect(scoreAnswer({ ...base, timeLeftRatio: 0.5 }).points).toBe(75);
    expect(scoreAnswer({ ...base, hintPenalty: 0.3 }).points).toBe(70);
    expect(scoreAnswer({ ...base, level: 3, combo: 9, timeLeftRatio: 0.5, hintPenalty: 0.1 }).points).toBe(
      Math.round(100 * 2 * 1.5 * 0.75 * 0.9),
    );
    // clamped inputs
    expect(scoreAnswer({ ...base, timeLeftRatio: 7, hintPenalty: -1 }).points).toBe(100);
    expect(scoreAnswer({ ...base, timeLeftRatio: NaN }).points).toBe(50);
  });
  it('wrong answer resets combo and scores 0', () => {
    expect(scoreAnswer({ ...base, correct: false, combo: 12 })).toEqual({
      points: 0,
      newCombo: 0,
      comboMultiplier: 1,
      special: false,
    });
  });
  it('combo thresholds and specials at 5/10/20', () => {
    const at = (combo: number) => scoreAnswer({ ...base, combo });
    expect(at(3)).toMatchObject({ newCombo: 4, comboMultiplier: 1, special: false });
    expect(at(4)).toMatchObject({ newCombo: 5, comboMultiplier: 1.2, special: true, points: 120 });
    expect(at(5)).toMatchObject({ newCombo: 6, comboMultiplier: 1.2, special: false });
    expect(at(9)).toMatchObject({ newCombo: 10, comboMultiplier: 1.5, special: true, points: 150 });
    expect(at(18)).toMatchObject({ newCombo: 19, comboMultiplier: 1.5, special: false });
    expect(at(19)).toMatchObject({ newCombo: 20, comboMultiplier: 2, special: true, points: 200 });
    expect(at(29)).toMatchObject({ newCombo: 30, comboMultiplier: 2, special: false });
    expect(comboMultiplierFor(0)).toBe(1);
  });
});

describe('gradeFor', () => {
  it('boundaries', () => {
    expect(gradeFor(1)).toBe('S');
    expect(gradeFor(0.95)).toBe('S');
    expect(gradeFor(0.949)).toBe('A');
    expect(gradeFor(0.85)).toBe('A');
    expect(gradeFor(0.849)).toBe('B');
    expect(gradeFor(0.7)).toBe('B');
    expect(gradeFor(0.699)).toBe('C');
    expect(gradeFor(0.5)).toBe('C');
    expect(gradeFor(0.499)).toBe('D');
    expect(gradeFor(0)).toBe('D');
  });
});

describe('analyzeTest', () => {
  it('empty', () => {
    expect(analyzeTest([])).toEqual({ accuracy: 0, grade: 'D', initialErrors: {}, finalErrors: {}, toneConfusion: {} });
  });
  it('collects confusions', () => {
    const zg = mkQ(mkItem('中国', 'zhong1 guo2', 'zung1 gwok3'));
    const xing = mkQ(mkItem('星', 'xing1', 'sing1'));
    const gwok = mkQ(mkItem('国', 'guo2', 'gwok3'), 'jyutping');
    const an = mkQ(mkItem('安', 'an1', 'on1'));
    const cases = [
      { q: zg, raw: 'zong1 guo3', lvl: 3 as const },
      { q: zg, raw: 'zhong1 guo2', lvl: 3 as const },
      { q: xing, raw: 'xin1', lvl: 3 as const },
      { q: gwok, raw: 'gok', lvl: 3 as const },
      { q: an, raw: 'man1', lvl: 3 as const },
      { q: zg, raw: 'zong1', lvl: 3 as const }, // missing syllable is not analysed
    ];
    const results = cases.map(({ q, raw, lvl }) => ({ q, r: checkAnswer(raw, q, lvl) }));
    const a = analyzeTest(results);
    expect(a.accuracy).toBeCloseTo(1 / 6);
    expect(a.grade).toBe('D');
    expect(a.initialErrors).toEqual({ 'zh→z': 2, 'gw→g': 1, '∅→m': 1 });
    expect(a.finalErrors).toEqual({ 'ing→in': 1 });
    expect(a.toneConfusion).toEqual({ '2': { '3': 1 }, '3': { none: 1 } });
  });
});

describe('getHint', () => {
  const zg = mkItem('中国', 'zhong1 guo2', 'zung1 gwok3');
  it('pinyin levels', () => {
    const q = mkQ(zg);
    expect(getHint(q, 0)).toEqual({ level: 0, text: '', penalty: 0 });
    expect(getHint(q, 1)).toEqual({ level: 1, text: 'zh_ g_', penalty: 0.1 });
    expect(getHint(q, 2)).toEqual({ level: 2, text: 'zhong guo', penalty: 0.3 });
    expect(getHint(q, 3)).toEqual({ level: 3, text: 'zhōng guó', penalty: 0.6 });
    expect(HINT_PENALTY[3]).toBe(0.6);
  });
  it('zero initial and ü', () => {
    const q = mkQ(mkItem('安绿', 'an1 lv4', 'on1 luk6'));
    expect(getHint(q, 1).text).toBe('_ l_');
    expect(getHint(q, 2).text).toBe('an lü');
    expect(getHint(q, 3).text).toBe('ān lǜ');
  });
  it('jyutping levels (L3 numbered)', () => {
    const q = mkQ(mkItem('广东话', 'guang3 dong1 hua4', 'gwong2 dung1 waa2'), 'jyutping');
    expect(getHint(q, 1).text).toBe('gw_ d_ w_');
    expect(getHint(q, 2).text).toBe('gwong dung waa');
    expect(getHint(q, 3).text).toBe('gwong2 dung1 waa2');
    const m = mkQ(mkItem('唔', 'wu2', 'm4'), 'jyutping');
    expect(getHint(m, 1).text).toBe('_');
  });
});

describe('srs', () => {
  const now = 1_000_000_000_000;
  it('intervals 1/2/4/8/16 days', () => {
    expect(BOX_INTERVAL_DAYS).toEqual({ 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 });
    let s: SrsState = {};
    s = reviewCard(s, 'a', true, now);
    expect(s.a).toEqual({ id: 'a', box: 2, due: now + 2 * DAY_MS });
    s = reviewCard(s, 'a', true, now);
    expect(s.a.box).toBe(3);
    expect(s.a.due).toBe(now + 4 * DAY_MS);
    s = reviewCard(s, 'a', true, now);
    s = reviewCard(s, 'a', true, now);
    expect(s.a).toEqual({ id: 'a', box: 5, due: now + 16 * DAY_MS });
    s = reviewCard(s, 'a', true, now);
    expect(s.a.box).toBe(5);
    s = reviewCard(s, 'a', false, now);
    expect(s.a).toEqual({ id: 'a', box: 1, due: now + DAY_MS });
  });
  it('new wrong card goes to box 1; pure', () => {
    const s0: SrsState = {};
    const s1 = reviewCard(s0, 'b', false, now);
    expect(s0).toEqual({});
    expect(s1.b.box).toBe(1);
  });
  it('defaults now to Date.now()', () => {
    const s = reviewCard({}, 'c', false);
    expect(s.c.due).toBeGreaterThan(Date.now());
    expect(dueIds(s)).toEqual([]);
  });
  it('dueIds sorted by due', () => {
    const s: SrsState = {
      a: { id: 'a', box: 1, due: now - 10 },
      b: { id: 'b', box: 2, due: now - 100 },
      c: { id: 'c', box: 3, due: now + 1 },
      d: { id: 'd', box: 1, due: now - 10 },
      e: { id: 'e', box: 1, due: now },
    };
    expect(dueIds(s, now)).toEqual(['b', 'a', 'd', 'e']);
    const tie: SrsState = { z: { id: 'z', box: 1, due: 1 }, y: { id: 'y', box: 1, due: 1 } };
    expect(dueIds(tie, now)).toEqual(['y', 'z']);
  });
});
