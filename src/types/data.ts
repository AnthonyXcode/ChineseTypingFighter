// ===== Shared data contract (owned by lead; do not change without lead approval) =====
// Produced by pipeline/ (Python) -> public/data/*.json, consumed by src/engine and src/ui.

export type Level = 1 | 2 | 3;

export interface Syllable {
  hanzi: string;        // single char, simplified
  hanziTrad: string;    // single char, traditional (HK forms, OpenCC s2hk)
  pinyin: string;       // numbered tone, lowercase, ü written as "v": "zhong1", "lv4", neutral tone = 5 ("de5")
  jyutping: string;     // numbered tone 1-6, lowercase: "zung1"
  polyphonic: boolean;  // char has >1 reading in dictionary
  pinyinAlt?: string[];   // other acceptable readings when context ambiguous
  jyutpingAlt?: string[];
}

export interface Item {
  id: string;           // "c-000123" (char) | "w-000123" (word) | "p-000123" (phrase)
  kind: 'char' | 'word' | 'phrase';
  text: string;         // simplified
  textTrad: string;     // traditional
  syllables: Syllable[];// one per Han character, same order as text
  level: Level;
  freq: number;         // occurrences in novel
  chapter: number;      // first chapter it appears in, 1..13
  context?: string;     // source snippet (simplified, <=20 chars) containing the item
  contextTrad?: string;
}

// File shape of public/data/chars.json, words.json, phrases.json
export interface DataFile {
  version: 1;
  source: string;       // "倪匡《奔龍》"
  generatedAt: string;  // ISO date
  items: Item[];
}
