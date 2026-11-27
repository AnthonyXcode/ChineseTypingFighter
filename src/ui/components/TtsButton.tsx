import type { RomanSystem } from '../../types/engine';
import { speak } from '../audio/tts';
import { useHasVoice } from '../hooks/useHasVoice';
import { useApp } from '../store';

interface Props {
  text: string;
  system: RomanSystem;
  onSpeak?: () => void;
  label?: string;
  penaltyNote?: string;
}

export function TtsButton({ text, system, onSpeak, label, penaltyNote }: Props) {
  const ttsOn = useApp((s) => s.settings.ttsOn);
  const available = useHasVoice(system);
  if (!ttsOn || !available) return null;
  const name = system === 'pinyin' ? '普通話' : '粵語';
  return (
    <button
      type="button"
      className="btn btn-icon tts-btn"
      aria-label={`${name}讀音${penaltyNote ? `（${penaltyNote}）` : ''}`}
      title={`${name}讀音`}
      onClick={() => {
        speak(text, system);
        onSpeak?.();
      }}
    >
      🔊{label ? <span className="tts-label">{label}</span> : null}
      {penaltyNote ? <small className="penalty">{penaltyNote}</small> : null}
    </button>
  );
}
