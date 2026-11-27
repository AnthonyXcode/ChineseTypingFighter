import type { RomanSystem } from '../../types/engine';

const LANGS: Record<RomanSystem, string[]> = {
  pinyin: ['zh-cn', 'cmn-hans-cn', 'zh-tw', 'cmn'],
  jyutping: ['zh-hk', 'yue-hk', 'yue'],
};

let voices: SpeechSynthesisVoice[] = [];
const listeners = new Set<() => void>();

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

function refresh() {
  const s = synth();
  if (!s) return;
  voices = s.getVoices();
  listeners.forEach((l) => l());
}

if (synth()) {
  refresh();
  synth()!.addEventListener?.('voiceschanged', refresh);
}

export function onVoicesChanged(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function findVoice(system: RomanSystem): SpeechSynthesisVoice | null {
  for (const lang of LANGS[system]) {
    const v = voices.find((x) => x.lang.toLowerCase().replace('_', '-') === lang);
    if (v) return v;
  }
  // loose prefix match as a last resort
  const pref = system === 'jyutping' ? 'zh-hk' : 'zh-cn';
  return voices.find((x) => x.lang.toLowerCase().replace('_', '-').startsWith(pref)) ?? null;
}

export function hasVoice(system: RomanSystem): boolean {
  return !!synth() && !!findVoice(system);
}

export function speak(text: string, system: RomanSystem): void {
  const s = synth();
  const voice = findVoice(system);
  if (!s || !voice) return;
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.8;
  s.speak(u);
}
