import type { HintLevel, Question } from '../../types/engine';
import { getHint } from '../../engine';
import { ToneColored } from './ToneColored';

interface Props {
  q: Question;
  level: HintLevel;
  onNext: () => void;
  free?: boolean;
}

const HINT_NAME = ['', '聲母', '無調拼音', '完整答案'];

export function HintBar({ q, level, onNext, free }: Props) {
  const hint = level > 0 ? getHint(q, level) : null;
  const maxed = level >= 3;
  return (
    <div className="hint-bar">
      <button
        type="button"
        className="btn btn-hint"
        onClick={onNext}
        disabled={maxed}
        aria-label={maxed ? '已顯示全部提示' : `提示（第 ${level + 1} 級：${HINT_NAME[level + 1]}）快捷鍵 Tab`}
        title="提示 (Tab)"
      >
        💡 <span>提示</span>
        {!maxed && <kbd>Tab</kbd>}
      </button>
      <div className="hint-text" aria-live="polite">
        {hint ? (
          <>
            <span className="hint-level">{HINT_NAME[level]}</span>
            {level === 3 ? <ToneColored text={q.answer} system={q.system} /> : <code>{hint.text}</code>}
            {!free && hint.penalty > 0 && <small className="penalty">−{Math.round(hint.penalty * 100)}%</small>}
          </>
        ) : (
          <span className="muted">{free ? '學習模式提示免費' : '每級提示會扣分'}</span>
        )}
      </div>
    </div>
  );
}
