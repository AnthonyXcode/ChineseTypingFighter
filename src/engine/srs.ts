// Leitner spaced repetition: boxes 1..5, intervals 1/2/4/8/16 days.

import type { SrsCard, SrsState } from '../types/engine';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const BOX_INTERVAL_DAYS: Record<SrsCard['box'], number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

/**
 * Pure. Correct: box +1 (a new card counts as box 1, so it moves to box 2), capped at 5.
 * Wrong: back to box 1. due = now + interval(box).
 */
export function reviewCard(state: SrsState, id: string, correct: boolean, now: number = Date.now()): SrsState {
  const prev = state[id]?.box ?? 1;
  const box = (correct ? Math.min(5, prev + 1) : 1) as SrsCard['box'];
  return { ...state, [id]: { id, box, due: now + BOX_INTERVAL_DAYS[box] * DAY_MS } };
}

/** Ids whose due time has passed, most overdue first. */
export function dueIds(state: SrsState, now: number = Date.now()): string[] {
  return Object.values(state)
    .filter((c) => c && c.due <= now)
    .sort((a, b) => a.due - b.due || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((c) => c.id);
}
