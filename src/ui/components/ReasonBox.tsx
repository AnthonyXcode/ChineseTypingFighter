import { useId, useState } from 'react';
import type { Item } from '../../types/data';
import type { RomanSystem } from '../../types/engine';
import { explainAnswer } from '../../engine';
import { useApp } from '../store';
import { toneClass } from '../util';

/**
 * "為甚麼？" toggle + box explaining why the answer is read that way.
 * Open/closed is remembered in settings.showReason, so it stays the same across questions.
 */
export function ReasonToggle({
  item,
  system,
  compact = false,
  persist = true,
}: {
  item: Item;
  system: RomanSystem;
  compact?: boolean;
  /** false: open state is local to this toggle (e.g. one per row in a list) */
  persist?: boolean;
}) {
  const saved = useApp((s) => s.settings.showReason);
  const updateSettings = useApp((s) => s.updateSettings);
  const [local, setLocal] = useState(false);
  const open = persist ? saved : local;
  const id = useId();
  return (
    <div className={`reason ${compact ? 'reason-compact' : ''}`}>
      <button
        type="button"
        className={`btn btn-ghost reason-btn ${open ? 'on' : ''}`}
        aria-expanded={open}
        aria-controls={id}
        // keep focus where it is (answer box / 下一題) so Enter keeps working and the mobile keyboard stays up
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (persist ? updateSettings({ showReason: !open }) : setLocal(!open))}
      >
        📖 {open ? '收起解說' : '為甚麼？'}
      </button>
      {open && <ReasonBox id={id} item={item} system={system} />}
    </div>
  );
}

export function ReasonBox({ item, system, id }: { item: Item; system: RomanSystem; id?: string }) {
  const script = useApp((s) => s.settings.script);
  const e = explainAnswer(item, system);
  const otherName = system === 'pinyin' ? '粵拼' : '普通話';
  return (
    <section id={id} className="reason-box" aria-label="讀音解說">
      <ol className="reason-list">
        {e.syllables.map((s, i) => (
          <li key={i} className="reason-syl">
            <div className="reason-head">
              <span className="reason-hanzi">{script === 'trad' ? s.hanziTrad || s.hanzi : s.hanzi}</span>
              <span className={`reason-roman ${toneClass(system, s.tone)}`}>{s.display}</span>
              {s.other && (
                <span className="reason-other muted">
                  {otherName} {s.other}
                </span>
              )}
            </div>
            <div className="reason-parts">
              <span className="part">
                <small>聲母</small>
                <b>{s.initial || '（零聲母）'}</b>
              </span>
              <span className="plus">＋</span>
              <span className="part">
                <small>韻母</small>
                <b>{s.final}</b>
              </span>
              <span className="plus">＋</span>
              <span className={`part ${toneClass(system, s.tone)}`}>
                <small>聲調</small>
                <b>{s.toneName || s.tone}</b>
                {s.contour && <small className="contour">{s.contour}</small>}
              </span>
            </div>
            {s.notes.length > 0 && (
              <ul className="reason-notes">
                {s.notes.map((n, k) => (
                  <li key={k}>{n}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      {e.notes.length > 0 && (
        <ul className="reason-notes reason-word-notes">
          {e.notes.map((n, k) => (
            <li key={k}>{n}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
