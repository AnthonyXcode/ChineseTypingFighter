// Progressive hints: 1 initials, 2 toneless, 3 full answer.

import type { Hint, HintLevel, Question } from '../types/engine';
import { splitSyllable, toDiacritic } from './romanization';

export const HINT_PENALTY: Record<HintLevel, number> = { 0: 0, 1: 0.1, 2: 0.3, 3: 0.6 };

export function getHint(q: Question, level: HintLevel): Hint {
  const syls = q.answer.trim().split(/\s+/).filter(Boolean);
  let text = '';
  if (level === 1) {
    text = syls
      .map((s) => {
        const { initial, final } = splitSyllable(s, q.system);
        // zero-initial syllables (ai4, ngo5 has an initial; aa3 doesn't) reveal the first letter of the final
        return (initial || final.charAt(0)) + '_';
      })
      .join(' ');
  } else if (level === 2) {
    text = syls
      .map((s) => {
        const body = s.replace(/[0-9]+$/, '');
        return q.system === 'pinyin' ? body.replace(/v/g, 'ü') : body;
      })
      .join(' ');
  } else if (level === 3) {
    text = q.system === 'pinyin' ? toDiacritic(syls.join(' ')) : syls.join(' ');
  }
  return { level, text, penalty: HINT_PENALTY[level] };
}
