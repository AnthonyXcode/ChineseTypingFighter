import { useSyncExternalStore } from 'react';
import type { RomanSystem } from '../../types/engine';
import { hasVoice, onVoicesChanged } from '../audio/tts';

export function useHasVoice(system: RomanSystem): boolean {
  return useSyncExternalStore(onVoicesChanged, () => hasVoice(system), () => false);
}
