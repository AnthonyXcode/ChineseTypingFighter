import { useRef, useState } from 'react';
import type { CheckResult, HintLevel, Question } from '../../types/engine';
import { checkAnswer, getHint } from '../../engine';
import { sfx } from '../audio/sfx';
import { useApp } from '../store';
import { ROMAN_NAME, answerFor, itemContext, systemsFor } from '../util';
import { AnswerInput } from './AnswerInput';
import { HanziCard } from './HanziCard';
import { HintBar } from './HintBar';
import { SyllableFeedback } from './SyllableFeedback';
import { ToneColored } from './ToneColored';
import { TtsButton } from './TtsButton';
import { useKeyboardAlign } from '../hooks/useKeyboardAlign';

export interface PanelResult {
  raw: string;
  r: CheckResult;
  hintLevel: HintLevel;
  hintPenalty: number;
  ms: number;
}

interface Props {
  q: Question;
  mode: 'learn' | 'test';
  /** show the answer above the input (learn "照打" step) */
  reveal?: boolean;
  /** show per-question feedback before moving on */
  showFeedback: boolean;
  /** wrong answers must be retried until correct */
  requireCorrect?: boolean;
  showContext?: boolean;
  /** e.g. "第 3 / 20 題" */
  counter?: string;
  stepNote?: string;
  onDone: (res: PanelResult) => void;
  onEscape?: () => void;
}

export function QuestionPanel({ q, mode, reveal, showFeedback, requireCorrect, showContext, counter, stepNote, onDone, onEscape }: Props) {
  const settings = useApp((s) => s.settings);
  const [value, setValue] = useState('');
  const [hintLevel, setHintLevel] = useState<HintLevel>(0);
  const [feedback, setFeedback] = useState<CheckResult | null>(null);
  const [first, setFirst] = useState<PanelResult | null>(null);
  const [ttsUsed, setTtsUsed] = useState(false);
  const start = useRef(performance.now());
  const panelRef = useRef<HTMLDivElement>(null);
  useKeyboardAlign(panelRef);

  const learn = mode === 'learn';
  const hintsOn = settings.hintsEnabled;
  const colored = hintsOn || learn;
  const penalty = Math.max(hintLevel > 0 ? getHint(q, hintLevel).penalty : 0, !learn && ttsUsed ? 0.1 : 0);
  const done = feedback !== null && (!requireCorrect || feedback.correct);
  const ctx = showContext ? itemContext(q.item, settings.script) : undefined;

  function submit(raw: string) {
    if (done) return;
    const r = checkAnswer(raw, q, settings.level);
    const res: PanelResult = { raw, r, hintLevel, hintPenalty: penalty, ms: performance.now() - start.current };
    const firstRes = first ?? res;
    if (!first) setFirst(res);
    if (!showFeedback) {
      onDone(firstRes);
      return;
    }
    if (r.correct) sfx.correct();
    else sfx.wrong();
    setFeedback(r);
  }

  function next() {
    if (first) onDone(first);
  }

  function nextHint() {
    if (!hintsOn && !learn) return;
    setHintLevel((l) => (Math.min(3, l + 1) as HintLevel));
  }

  return (
    <div className="qpanel" ref={panelRef}>
      <div className="qpanel-meta">
        {counter && <span className="counter">{counter}</span>}
        <span className={`sys-tag sys-${q.system}`}>{ROMAN_NAME[q.system]}</span>
        {stepNote && <span className="muted">{stepNote}</span>}
      </div>
      <HanziCard item={q.item} script={settings.script} toneSystem={colored && (reveal || done) ? q.system : null} />
      {reveal && (
        <div className="reveal">
          {systemsFor(settings.system).map((sys) => (
            <div key={sys} className={`reveal-line ${sys === q.system ? 'current' : ''}`}>
              <span className={`sys-tag sys-${sys}`}>{sys === 'pinyin' ? '拼' : '粵'}</span>
              <ToneColored text={answerFor(q.item, sys)} system={sys} colored={colored} className="roman-lg" />
              <TtsButton text={q.item.textTrad || q.item.text} system={sys} />
            </div>
          ))}
        </div>
      )}
      {ctx && <p className="context">「{ctx}」</p>}
      <AnswerInput
        value={value}
        onChange={(v) => {
          setValue(v);
          if (feedback && !done) setFeedback(null);
        }}
        onSubmit={submit}
        system={q.system}
        disabled={done}
        onHint={hintsOn || learn ? nextHint : undefined}
        onEscape={onEscape}
        status={feedback ? (feedback.correct ? 'ok' : 'bad') : null}
      />
      {(hintsOn || learn) && !reveal && !done && (
        <div className="hint-row">
          <HintBar q={q} level={hintLevel} onNext={nextHint} free={learn} />
          {hintsOn && !learn && (
            <TtsButton
              text={q.item.textTrad || q.item.text}
              system={q.system}
              onSpeak={() => setTtsUsed(true)}
              penaltyNote="−10%"
            />
          )}
          {learn && <TtsButton text={q.item.textTrad || q.item.text} system={q.system} />}
        </div>
      )}
      {feedback && <SyllableFeedback result={feedback} system={q.system} />}
      {feedback && requireCorrect && !feedback.correct && <p className="muted center">再試一次（照上面答案打）</p>}
      {done && (
        <div className="center">
          {!colored && (
            <p>
              答案：<ToneColored text={q.answer} system={q.system} colored={false} />
            </p>
          )}
          <button type="button" className="btn btn-primary btn-lg" onClick={next} autoFocus>
            下一題 →
          </button>
        </div>
      )}
    </div>
  );
}
