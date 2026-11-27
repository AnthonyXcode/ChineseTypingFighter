// ===== Engine API contract (owned by lead) =====
// src/engine/index.ts MUST export functions with exactly these signatures.
// UI imports only from 'src/engine' (index.ts).

import type { Item, Level } from './data';

export type RomanSystem = 'pinyin' | 'jyutping';
/** which romanizations the player must type for each question */
export type PracticeSystem = 'pinyin' | 'jyutping' | 'both';
export type Mode = 'learn' | 'test' | 'challenge';
export type ScriptPref = 'trad' | 'simp';

export interface Settings {
  system: PracticeSystem;
  level: Level;
  hintsEnabled: boolean;
  script: ScriptPref;          // default 'trad'
  soundOn: boolean;
  ttsOn: boolean;
  testInstantFeedback: boolean;// default false
  theme: 'auto' | 'light' | 'dark';
  showReason: boolean;         // show the "why is this the answer" box after answering (default false)
}

/** Explanation of an answer ("為甚麼？" box). Built by explainAnswer(item, system). */
export interface SyllableExplanation {
  hanzi: string;                // simplified
  hanziTrad: string;
  roman: string;                // numbered, e.g. "zhong1"
  display: string;              // pinyin with tone mark ("zhōng"); jyutping numbered
  initial: string;              // "" for zero initial
  final: string;
  tone: string;                 // "1".."6"
  toneName: string;             // 陰平 / 陽平 / 上聲 / 去聲 / 輕聲 ; 粵: 陰平 陰上 陰去 陽平 陽上 陽去 (陰入 中入 陽入)
  contour: string;              // e.g. "高平 55"
  notes: string[];              // spelling rules, polyphone note, ...
  other: string;                // the other system's reading for comparison ("" if missing)
}
export interface Explanation {
  system: RomanSystem;
  syllables: SyllableExplanation[];
  notes: string[];              // word-level notes (tone sandhi, ...)
}

export interface SyllableResult {
  expected: string;   // canonical numbered form e.g. "zhong1"
  given: string;      // what player typed for this syllable (normalized), "" if missing
  initialOk: boolean;
  finalOk: boolean;
  toneOk: boolean;    // on Level 1 tone errors are tolerated but still reported here
}

export interface CheckResult {
  correct: boolean;           // accepted under current level rules
  perfect: boolean;           // every initial/final/tone right
  syllables: SyllableResult[];
  errorTypes: ErrorType[];    // de-duplicated
}

export type ErrorType = 'initial' | 'final' | 'tone' | 'missing' | 'extra';

export type HintLevel = 0 | 1 | 2 | 3;  // 0 none, 1 initials, 2 toneless, 3 full answer
export interface Hint {
  level: HintLevel;
  text: string;       // e.g. "zh_ g_" | "zhong guo" | "zhōng guó"
  penalty: number;    // fraction 0..1 deducted from this question's score (0.1 / 0.3 / 0.6)
}

export interface Question {
  item: Item;
  system: RomanSystem;          // for 'both', the UI asks two Questions (pinyin then jyutping) for same item
  answer: string;               // canonical numbered, syllables space-separated "zhong1 guo2"
  timeLimitMs: number | null;   // null in learn/test (unless timed), set in challenge
}

export interface QuestionOptions {
  mode: Mode;
  level: Level;
  system: PracticeSystem;
  count: number;
  chapters?: number[];          // restrict to chapters; undefined = all
  srs?: SrsState;               // if given, due items are prioritised
  excludeIds?: string[];
  recentIds?: string[];         // recently practised items: still eligible, but drawn after everything else
  rng?: () => number;           // injectable for tests
}

export interface ScoreInput {
  level: Level;
  correct: boolean;
  combo: number;                // combo count BEFORE this answer
  timeLeftRatio: number;        // 0..1 (1 if untimed)
  hintPenalty: number;          // max penalty used on this question, 0..1
}
export interface ScoreOutput {
  points: number;               // integer
  newCombo: number;
  comboMultiplier: number;      // 1, 1.2 (>=5), 1.5 (>=10), 2 (>=20)
  special: boolean;             // true when combo just hit 5, 10 or 20 (trigger 絕招)
}

// Leitner SRS: boxes 1..5, intervals 1/2/4/8/16 days
export interface SrsCard { id: string; box: 1 | 2 | 3 | 4 | 5; due: number /* epoch ms */; }
export type SrsState = Record<string, SrsCard>;

export interface TestRecord {
  date: number; level: Level; system: PracticeSystem; total: number; correct: number;
  avgMs: number; hintsUsed: number; grade: 'S' | 'A' | 'B' | 'C' | 'D';
  wrongIds: string[];
}
export interface LeaderboardEntry {
  name: string; score: number; level: Level; system: PracticeSystem; stage: number | 'endless'; date: number;
}

export interface ToneConfusion { [expectedTone: string]: { [givenTone: string]: number } }
export interface TestAnalysis {
  accuracy: number; grade: TestRecord['grade'];
  initialErrors: Record<string, number>;   // key "zh→z", "n→l", "gw→g"
  finalErrors: Record<string, number>;     // key "ing→in", "ng→n", "k→t"
  toneConfusion: ToneConfusion;
}

/*
 * ---- Functions src/engine/index.ts must export ----
 *
 * // romanization.ts
 * normalizeInput(raw: string, system: RomanSystem): string[]
 *     // lowercases, ü/u:/v -> v, strips punctuation, splits into syllables using legal-syllable table
 *     // (accepts with or without spaces/apostrophes). Tone digits kept. Returns syllables.
 * checkAnswer(raw: string, q: Question, level: Level): CheckResult
 *     // Level 1: correct if initials+finals right (tone ignored). Level 2/3: tone required.
 *     // pinyin neutral tone: "5" or no digit both OK. Alternatives (pinyinAlt/jyutpingAlt) accepted.
 * toDiacritic(numbered: string): string          // "zhong1 guo2" -> "zhōng guó", "lv4" -> "lǜ" (pinyin only)
 * splitSyllable(s: string, system: RomanSystem): { initial: string; final: string; tone: string }
 * toneOf(s: string): string                       // "zhong1" -> "1", "de" -> "5"
 *
 * // hints.ts
 * getHint(q: Question, level: HintLevel): Hint
 *
 * // questions.ts
 * loadData(): Promise<Item[]>                    // fetch /data/chars.json, words.json, phrases.json (falls back to /data/sample.json)
 * buildQuestions(items: Item[], opts: QuestionOptions): Question[]
 *     // level 1: kind 'char' freq-top; level 2: 2-char words; level 3: 3-4 char words + phrases<=8, weight polyphonic
 *     // challenge timeLimitMs: L1 12000, L2 8000, L3 5000 + 1000*chars; else null
 *     // system 'both' -> for each item emit pinyin Question then jyutping Question (count = item count)
 * lessonItems(items: Item[], chapter: number, lessonIndex: number, size?: number /*20*\/): Item[]
 *
 * // scoring.ts
 * LEVEL_MULTIPLIER: Record<Level, number>       // {1:1, 2:1.5, 3:2}
 * scoreAnswer(input: ScoreInput): ScoreOutput   // points = round(100*levelMult*comboMult*(0.5+0.5*timeLeftRatio)*(1-hintPenalty)), 0 if wrong (combo resets)
 * gradeFor(accuracy: number): TestRecord['grade']  // S>=.95 A>=.85 B>=.70 C>=.50 else D
 * analyzeTest(results: { q: Question; r: CheckResult }[]): TestAnalysis
 *
 * // srs.ts
 * reviewCard(state: SrsState, id: string, correct: boolean, now?: number): SrsState  // pure, returns new state
 * dueIds(state: SrsState, now?: number): string[]
 *
 * // storage.ts (all try/catch, never throws, falls back to defaults)
 * DEFAULT_SETTINGS: Settings
 * loadSettings(): Settings;  saveSettings(s: Settings): void
 * loadSrs(): SrsState;       saveSrs(s: SrsState): void
 * loadTests(): TestRecord[]; addTest(r: TestRecord): void        // keeps last 50
 * loadLeaderboard(): LeaderboardEntry[]; addLeaderboard(e: LeaderboardEntry): LeaderboardEntry[] // top 10
 * loadProgress(): { unlockedStage: number; lessonsDone: string[] }; saveProgress(p): void
 */
