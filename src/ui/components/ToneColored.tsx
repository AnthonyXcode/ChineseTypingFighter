import type { RomanSystem } from '../../types/engine';
import { toDiacritic, toneOf } from '../../engine';
import { toneClass } from '../util';

interface Props {
  /** numbered, space separated, e.g. "zhong1 guo2" */
  text: string;
  system: RomanSystem;
  colored?: boolean;
  className?: string;
}

export function ToneColored({ text, system, colored = true, className }: Props) {
  const syls = text.trim().split(/\s+/).filter(Boolean);
  return (
    <span className={`roman ${className ?? ''}`} lang={system === 'pinyin' ? 'zh-Latn-pinyin' : 'yue-Latn-jyutping'}>
      {syls.map((s, i) => {
        const shown = system === 'pinyin' ? toDiacritic(s) : s;
        return (
          <span key={i} className={colored ? toneClass(system, toneOf(s)) : undefined}>
            {shown}
            {i < syls.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </span>
  );
}
