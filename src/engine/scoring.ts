// Scoring, combo, grades and post-test error analysis.

import type { Level } from '../types/data';
import type {
  CheckResult,
  Question,
  ScoreInput,
  ScoreOutput,
  TestAnalysis,
  TestRecord,
} from '../types/engine';
import { splitSyllable } from './romanization';

export const LEVEL_MULTIPLIER: Record<Level, number> = { 1: 1, 2: 1.5, 3: 2 };

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function comboMultiplierFor(combo: number): number {
  if (combo >= 20) return 2;
  if (combo >= 10) return 1.5;
  if (combo >= 5) return 1.2;
  return 1;
}

/** Combo multiplier is based on the combo count INCLUDING this answer (5th correct -> x1.2). */
export function scoreAnswer(input: ScoreInput): ScoreOutput {
  if (!input.correct) return { points: 0, newCombo: 0, comboMultiplier: 1, special: false };
  const newCombo = Math.max(0, input.combo) + 1;
  const comboMultiplier = comboMultiplierFor(newCombo);
  const points = Math.round(
    100 *
      LEVEL_MULTIPLIER[input.level] *
      comboMultiplier *
      (0.5 + 0.5 * clamp01(input.timeLeftRatio)) *
      (1 - clamp01(input.hintPenalty)),
  );
  return { points, newCombo, comboMultiplier, special: newCombo === 5 || newCombo === 10 || newCombo === 20 };
}

export function gradeFor(accuracy: number): TestRecord['grade'] {
  if (accuracy >= 0.95) return 'S';
  if (accuracy >= 0.85) return 'A';
  if (accuracy >= 0.7) return 'B';
  if (accuracy >= 0.5) return 'C';
  return 'D';
}

const bump = (rec: Record<string, number>, key: string) => {
  rec[key] = (rec[key] ?? 0) + 1;
};

/** Empty initial/final shown as "∅". Tone keys: digit, or "none" when no tone typed (jyutping). */
export function analyzeTest(results: { q: Question; r: CheckResult }[]): TestAnalysis {
  const analysis: TestAnalysis = {
    accuracy: 0,
    grade: 'D',
    initialErrors: {},
    finalErrors: {},
    toneConfusion: {},
  };
  if (!results.length) return analysis;
  let correct = 0;
  for (const { q, r } of results) {
    if (r.correct) correct++;
    for (const s of r.syllables) {
      if (!s.given) continue;
      const e = splitSyllable(s.expected, q.system);
      const g = splitSyllable(s.given, q.system);
      if (!s.initialOk) bump(analysis.initialErrors, `${e.initial || '∅'}→${g.initial || '∅'}`);
      if (!s.finalOk) bump(analysis.finalErrors, `${e.final || '∅'}→${g.final || '∅'}`);
      if (!s.toneOk) {
        const row = (analysis.toneConfusion[e.tone || 'none'] ??= {});
        bump(row, g.tone || 'none');
      }
    }
  }
  analysis.accuracy = correct / results.length;
  analysis.grade = gradeFor(analysis.accuracy);
  return analysis;
}
