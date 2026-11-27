import type { CheckResult, RomanSystem } from '../../types/engine';
import { splitSyllable, toDiacritic } from '../../engine';

interface Props {
  result: CheckResult;
  system: RomanSystem;
}

const ERR_NAME: Record<string, string> = { initial: '聲母', final: '韻母', tone: '聲調', missing: '缺音節', extra: '多打音節' };

export function SyllableFeedback({ result, system }: Props) {
  const status = result.perfect ? '完全正確' : result.correct ? '正確（聲調有誤）' : '錯誤';
  const errs = result.errorTypes.map((e) => ERR_NAME[e] ?? e).join('、');
  return (
    <div className={`syl-feedback ${result.correct ? 'ok' : 'bad'}`} role="status" aria-live="polite">
      <div className="syl-feedback-title">
        {result.correct ? '✓' : '✗'} {status}
        {errs && <span className="muted">（錯：{errs}）</span>}
      </div>
      <div className="syl-row">
        {result.syllables.map((s, i) => {
          const p = s.given ? splitSyllable(s.given, system) : null;
          return (
            <div key={i} className="syl-cell">
              <div className="syl-given">
                {p ? (
                  <>
                    <span className={s.initialOk ? 'part-ok' : 'part-bad'}>{p.initial}</span>
                    <span className={s.finalOk ? 'part-ok' : 'part-bad'}>{p.final}</span>
                    <span className={s.toneOk ? 'part-ok tone-digit' : 'part-bad tone-digit'}>{p.tone}</span>
                  </>
                ) : (
                  <span className="part-bad">（缺）</span>
                )}
              </div>
              {s.expected && (
                <div className="syl-expected" title="正確答案">
                  {system === 'pinyin' ? toDiacritic(s.expected) : s.expected}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
