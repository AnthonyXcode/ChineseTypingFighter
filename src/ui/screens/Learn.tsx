import { useMemo, useState } from 'react';
import type { Item, Level } from '../../types/data';
import type { Question } from '../../types/engine';
import { dueIds, lessonItems, reviewCard } from '../../engine';
import { PauseOverlay, ScreenHeader } from '../components/Common';
import { HanziCard } from '../components/HanziCard';
import { QuestionPanel, type PanelResult } from '../components/QuestionPanel';
import { ToneColored } from '../components/ToneColored';
import { useApp } from '../store';
import { chapterName, questionsFor, shuffle } from '../util';

const LESSON_SIZE = 20;

type Phase =
  | { k: 'chapters' }
  | { k: 'lessons'; ch: number }
  | { k: 'study'; ch: number; lesson: number; items: Item[] }
  | { k: 'quiz'; ch?: number; lesson?: number; items: Item[] }
  | { k: 'summary'; ch?: number; lesson?: number; total: number; wrong: Item[] };

function lessonsOf(items: Item[], ch: number, level: Level): Item[][] {
  const out: Item[][] = [];
  for (let i = 0; i < 200; i++) {
    const l = lessonItems(items, ch, i, LESSON_SIZE, level);
    if (!l.length) break;
    out.push(l);
  }
  return out;
}

export function Learn({ review = false }: { review?: boolean }) {
  const { items, srs, setSrs, progress, setProgress, settings, go } = useApp();
  const [phase, setPhase] = useState<Phase>(() => {
    if (!review) return { k: 'chapters' };
    const due = new Set(dueIds(srs));
    return { k: 'quiz', items: items.filter((i) => due.has(i.id)).slice(0, 50) };
  });
  const [paused, setPaused] = useState(false);

  const lessonsByCh = useMemo(() => {
    const m = new Map<number, Item[][]>();
    for (let c = 1; c <= 13; c++) m.set(c, lessonsOf(items, c, settings.level));
    return m;
  }, [items, settings.level]);

  function finishQuiz(qItems: Item[], results: { q: Question; res: PanelResult }[], ch?: number, lesson?: number) {
    const ok = new Map<string, boolean>();
    for (const { q, res } of results) {
      const good = res.r.correct && res.hintLevel < 3;
      ok.set(q.item.id, (ok.get(q.item.id) ?? true) && good);
    }
    let s = srs;
    for (const [id, good] of ok) s = reviewCard(s, id, good);
    setSrs(s);
    if (ch !== undefined && lesson !== undefined) {
      const key = `L${settings.level}-${ch}-${lesson}`;
      if (!progress.lessonsDone.includes(key)) setProgress({ ...progress, lessonsDone: [...progress.lessonsDone, key] });
    }
    setPhase({ k: 'summary', ch, lesson, total: qItems.length, wrong: qItems.filter((i) => ok.get(i.id) === false) });
  }

  const backToList = () => {
    setPaused(false);
    if (review) go('home');
    else if (phase.k === 'chapters') go('home');
    else if (phase.k === 'lessons') setPhase({ k: 'chapters' });
    else if ('ch' in phase && phase.ch !== undefined) setPhase({ k: 'lessons', ch: phase.ch });
    else setPhase({ k: 'chapters' });
  };

  const title = review
    ? '複習'
    : phase.k === 'chapters'
      ? '學習模式'
      : 'ch' in phase && phase.ch !== undefined
        ? `${chapterName(phase.ch)}${'lesson' in phase && phase.lesson !== undefined ? `・第 ${phase.lesson + 1} 課` : ''}`
        : '學習模式';

  return (
    <main className="screen">
      <ScreenHeader title={title} onBack={backToList} />

      {phase.k === 'chapters' && (
        <section className="chapter-grid" aria-label="章節">
          {Array.from({ length: 13 }, (_, i) => i + 1).map((ch) => {
            const lessons = lessonsByCh.get(ch) ?? [];
            const done = lessons.filter((_, li) => progress.lessonsDone.includes(`L${settings.level}-${ch}-${li}`)).length;
            return (
              <button
                key={ch}
                type="button"
                className={`chapter-btn ${lessons.length && done === lessons.length ? 'done' : ''}`}
                disabled={!lessons.length}
                onClick={() => setPhase({ k: 'lessons', ch })}
              >
                <span className="chapter-name">{chapterName(ch)}</span>
                <span className="muted small">{lessons.length ? `${done} / ${lessons.length} 課` : '未有字詞'}</span>
              </button>
            );
          })}
        </section>
      )}

      {phase.k === 'lessons' && (
        <section className="panel paper">
          <ul className="lesson-list">
            {(lessonsByCh.get(phase.ch) ?? []).map((l, li) => {
              const done = progress.lessonsDone.includes(`L${settings.level}-${phase.ch}-${li}`);
              return (
                <li key={li}>
                  <button
                    type="button"
                    className={`lesson-btn ${done ? 'done' : ''}`}
                    onClick={() => setPhase({ k: 'study', ch: phase.ch, lesson: li, items: l })}
                  >
                    <span className="lesson-no">第 {li + 1} 課</span>
                    <span className="lesson-preview" lang="zh-Hant">
                      {l
                        .slice(0, 6)
                        .map((i) => (settings.script === 'trad' ? i.textTrad : i.text))
                        .join('・')}
                      {l.length > 6 ? '…' : ''}
                    </span>
                    <span className="muted small">{l.length} 個</span>
                    {done && <span className="done-mark" aria-label="已完成">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {phase.k === 'study' && (
        <Runner
          key={`study-${phase.ch}-${phase.lesson}`}
          questions={questionsFor(shuffle(phase.items), settings.system)}
          study
          onEscape={() => setPaused(true)}
          onFinish={() => setPhase({ k: 'quiz', ch: phase.ch, lesson: phase.lesson, items: phase.items })}
        />
      )}

      {phase.k === 'quiz' &&
        (phase.items.length === 0 ? (
          <section className="panel paper center">
            <p>今日沒有需要複習的字詞。</p>
            <button type="button" className="btn btn-primary" onClick={() => go('home')}>
              返回主頁
            </button>
          </section>
        ) : (
          <>
            <div className="phase-banner" role="status">
              {review ? `複習 ${phase.items.length} 個字詞` : '自己試：答案已隱藏'}
            </div>
            <Runner
              key={`quiz-${phase.ch}-${phase.lesson}`}
              questions={questionsFor(shuffle(phase.items), settings.system)}
              onEscape={() => setPaused(true)}
              onFinish={(res) => finishQuiz(phase.items, res, phase.ch, phase.lesson)}
            />
          </>
        ))}

      {phase.k === 'summary' && (
        <section className="panel paper center summary">
          <h2 className="seal-title">{phase.wrong.length === 0 ? '全對！' : '完成'}</h2>
          <p className="big-stat">
            {phase.total - phase.wrong.length} / {phase.total}
          </p>
          {phase.wrong.length > 0 && (
            <>
              <p className="muted">以下字詞已放入複習（明天再見）：</p>
              <ul className="wrong-chips">
                {phase.wrong.map((i) => (
                  <li key={i.id} className="chip">
                    <HanziCard item={i} script={settings.script} size="md" />
                    {(settings.system === 'jyutping' ? ['jyutping'] : settings.system === 'pinyin' ? ['pinyin'] : ['pinyin', 'jyutping']).map(
                      (sys) => (
                        <ToneColored
                          key={sys}
                          system={sys as 'pinyin' | 'jyutping'}
                          text={i.syllables.map((s) => s[sys as 'pinyin' | 'jyutping']).join(' ')}
                          className="small"
                        />
                      ),
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="row-btns">
            {phase.ch !== undefined && phase.lesson !== undefined && (lessonsByCh.get(phase.ch)?.length ?? 0) > phase.lesson + 1 && (
              <button
                type="button"
                className="btn btn-primary btn-lg"
                autoFocus
                onClick={() =>
                  setPhase({
                    k: 'study',
                    ch: phase.ch!,
                    lesson: phase.lesson! + 1,
                    items: lessonsByCh.get(phase.ch!)![phase.lesson! + 1],
                  })
                }
              >
                下一課 →
              </button>
            )}
            <button type="button" className="btn btn-lg" onClick={backToList}>
              {review ? '返回主頁' : '返回課程'}
            </button>
          </div>
        </section>
      )}

      {paused && <PauseOverlay onResume={() => setPaused(false)} onQuit={backToList} />}
    </main>
  );
}

function Runner({
  questions,
  study,
  onFinish,
  onEscape,
}: {
  questions: Question[];
  study?: boolean;
  onFinish: (results: { q: Question; res: PanelResult }[]) => void;
  onEscape: () => void;
}) {
  const [qs] = useState(questions);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<{ q: Question; res: PanelResult }[]>([]);
  const q = qs[idx];
  if (!q) return null;
  return (
    <>
      <div className="progress-line" aria-hidden="true">
        <div style={{ width: `${(idx / qs.length) * 100}%` }} />
      </div>
      <QuestionPanel
        key={idx}
        q={q}
        mode="learn"
        reveal={study}
        requireCorrect={study}
        showFeedback
        showContext={study}
        counter={`${idx + 1} / ${qs.length}`}
        stepNote={study ? '照打一次' : undefined}
        onEscape={onEscape}
        onDone={(res) => {
          const all = [...results, { q, res }];
          setResults(all);
          if (idx + 1 >= qs.length) onFinish(all);
          else setIdx(idx + 1);
        }}
      />
    </>
  );
}
