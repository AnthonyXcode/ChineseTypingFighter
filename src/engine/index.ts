// Public engine API. UI imports only from here.

export {
  normalizeInput,
  checkAnswer,
  toDiacritic,
  splitSyllable,
  toneOf,
  canonicalSyllable,
  acceptedReadings,
} from './romanization';
export { getHint, HINT_PENALTY } from './hints';
export { explainAnswer } from './explain';
export {
  loadData,
  buildQuestions,
  lessonItems,
  itemLevel,
  timeLimitFor,
  makeQuestion,
  resetDataCache,
} from './questions';
export { LEVEL_MULTIPLIER, scoreAnswer, gradeFor, analyzeTest, comboMultiplierFor } from './scoring';
export { reviewCard, dueIds, BOX_INTERVAL_DAYS, DAY_MS } from './srs';
export {
  DEFAULT_SETTINGS,
  DEFAULT_PROGRESS,
  loadSettings,
  saveSettings,
  loadSrs,
  saveSrs,
  loadTests,
  addTest,
  loadLeaderboard,
  addLeaderboard,
  loadProgress,
  saveProgress,
  loadRecent,
  addRecent,
} from './storage';
export type { Progress } from './storage';
export {
  PINYIN_SYLLABLES,
  JYUTPING_SYLLABLES,
  PINYIN_INITIALS,
  JYUTPING_INITIALS,
  JYUTPING_FINALS,
  isLegalSyllable,
} from './syllables';
export type * from '../types/engine';
