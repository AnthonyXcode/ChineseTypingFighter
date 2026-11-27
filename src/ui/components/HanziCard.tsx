import type { Item } from '../../types/data';
import type { RomanSystem, ScriptPref } from '../../types/engine';
import { toneOf } from '../../engine';
import { charsOf, itemText, toneClass } from '../util';

interface Props {
  item: Item;
  script: ScriptPref;
  /** when set, colour each character by its tone in this system */
  toneSystem?: RomanSystem | null;
  size?: 'xl' | 'lg' | 'md';
  className?: string;
}

export function HanziCard({ item, script, toneSystem, size = 'xl', className }: Props) {
  const chars = charsOf(item, script);
  return (
    <div className={`hanzi-card hanzi-${size} ${className ?? ''}`} lang="zh-Hant" aria-label={itemText(item, script)}>
      {chars.map((c, i) => {
        const syl = item.syllables[i];
        const cls = toneSystem && syl ? toneClass(toneSystem, toneOf(syl[toneSystem])) : '';
        return (
          <span key={i} className={`hanzi-char ${cls}`} aria-hidden="true">
            {c}
          </span>
        );
      })}
    </div>
  );
}
