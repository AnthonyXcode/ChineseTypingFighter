import { useMemo, useState } from 'react';
import type { Question, TestAnalysis, TestRecord } from '../../types/engine';
import { addRecent, addTest, analyzeTest, buildQuestions, loadRecent, loadTests, reviewCard } from '../../engine';
import { AccuracyChart } from '../components/AccuracyChart';
import { PauseOverlay, ScreenHeader, Seg } from '../components/Common';
import { HanziCard } from '../components/HanziCard';
import { QuestionPanel, type PanelResult } from '../components/QuestionPanel';
import { ReasonToggle } from '../components/ReasonBox';
import { ToneColored } from '../components/ToneColored';
import { useApp } from '../store';
import { LEVEL_NAME, SYSTEM_NAME, chapterName, chaptersPresent, fmtDate, fmtSec } from '../util';

type Row = { q: Question; res: PanelResult };
type Phase = { k: 'setup' } | { k: 'run'; questions: Question[] } | { k: 'result'; rows: Row[]; record: TestRecord; analysis: TestAnalysis };

export function Test() {
  const { items, settings, go } = useApp();
  const [phase, setPhase] = useState<Phase>({ k: 'setup' });
  const [count, setCount] = useState(10);
  const [allBook, setAllBook] = useState(true);
  const [chapters, setChapters] = useState<number[]>([]);
  const [paused, setPaused] = useState(false);
  const [tests, setTests] = useState(() => loadTests());
  const present = useMemo(() => chaptersPresent(items), [items]);

  function start() {
    const questions = buildQuestions(items, {
      mode: 'test',
      level: settings.level,
      system: settings.system,
      count,
      chapters: allBook || chapters.length === 0 ? undefined : chapters,
      recentIds: loadRecent(),
    });
    setPhase({ k: 'run', questions });
  }

  function finish(rows: Row[]) {
    addRecent(rows.map((r) => r.q.item.id));
    const analysis = analyzeTest(rows.map(({ q, res }) => ({ q, r: res.r })));
    const correct = rows.filter((r) => r.res.r.correct).length;
    const wrongIds = Array.from(new Set(rows.filter((r) => !r.res.r.correct).map((r) => r.q.item.id)));
    const record: TestRecord = {
      date: Date.now(),
      level: settings.level,
      system: settings.system,
      total: rows.length,
      correct,
      avgMs: rows.length ? rows.reduce((a, r) => a + r.res.ms, 0) / rows.length : 0,
      hintsUsed: rows.filter((r) => r.res.hintLevel > 0).length, // questions where any hint was used
      grade: analysis.grade,
      wrongIds,
    };
    addTest(record);
    setTests(loadTests());
    setPhase({ k: 'result', rows, record, analysis });
  }

  const quit = () => {
    setPaused(false);
    setPhase({ k: 'setup' });
  };

  return (
    <main className="screen">
      <ScreenHeader title="測試模式" onBack={phase.k === 'run' ? () => setPaused(true) : phase.k === 'result' ? quit : undefined} />

      {phase.k === 'setup' && (
        <>
          <section className="panel paper">
            <p className="muted small">
              {SYSTEM_NAME[settings.system]}・{LEVEL_NAME[settings.level]}・提示{settings.hintsEnabled ? '開' : '關'}
              {settings.testInstantFeedback ? '・即時對錯' : '・完成後才顯示對錯'}
              <button type="button" className="link-btn" onClick={() => go('home')}>
                更改
              </button>
            </p>
            <div className="opt-row">
              <span className="opt-label">題數</span>
              <Seg<number>
                label="題數"
                value={count}
                onChange={setCount}
                options={[10, 20, 50].map((n) => ({ value: n, label: `${n} 題` }))}
              />
            </div>
            <div className="opt-row">
              <span className="opt-label">範圍</span>
              <Seg<'all' | 'ch'>
                label="範圍"
                value={allBook ? 'all' : 'ch'}
                onChange={(v) => setAllBook(v === 'all')}
                options={[
                  { value: 'all', label: '全書' },
                  { value: 'ch', label: '指定章節' },
                ]}
              />
            </div>
            {!allBook && (
              <div className="chapter-checks" role="group" aria-label="選擇章節">
                {Array.from({ length: 13 }, (_, i) => i + 1).map((c) => {
                  const on = chapters.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      disabled={!present.includes(c)}
                      className={`chip-btn ${on ? 'on' : ''}`}
                      onClick={() => setChapters(on ? chapters.filter((x) => x !== c) : [...chapters, c].sort((a, b) => a - b))}
                    >
                      {chapterName(c)}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="center">
              <button type="button" className="btn btn-primary btn-lg" onClick={start} disabled={!allBook && chapters.length === 0}>
                開始測試
              </button>
            </div>
          </section>
          <History tests={tests} />
        </>
      )}

      {phase.k === 'run' &&
        (phase.questions.length === 0 ? (
          <section className="panel paper center">
            <p>此範圍及強度沒有足夠字詞。</p>
            <button type="button" className="btn" onClick={quit}>
              返回
            </button>
          </section>
        ) : (
          <TestRunner questions={phase.questions} onFinish={finish} onEscape={() => setPaused(true)} />
        ))}

      {phase.k === 'result' && <Result {...phase} tests={tests} onAgain={quit} />}

      {paused && <PauseOverlay onResume={() => setPaused(false)} onQuit={quit} />}
    </main>
  );
}

function TestRunner({ questions, onFinish, onEscape }: { questions: Question[]; onFinish: (rows: Row[]) => void; onEscape: () => void }) {
  const settings = useApp((s) => s.settings);
  const [idx, setIdx] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const q = questions[idx];
  return (
    <>
      <div className="progress-line" aria-hidden="true">
        <div style={{ width: `${(idx / questions.length) * 100}%` }} />
      </div>
      <QuestionPanel
        key={idx}
        q={q}
        mode="test"
        showFeedback={settings.testInstantFeedback}
        counter={`第 ${idx + 1} / ${questions.length} 題`}
        onEscape={onEscape}
        onDone={(res) => {
          const all = [...rows, { q, res }];
          setRows(all);
          if (idx + 1 >= questions.length) onFinish(all);
          else setIdx(idx + 1);
        }}
      />
    </>
  );
}

function topN(rec: Record<string, number>, n = 6): [string, number][] {
  return Object.entries(rec)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function Result({
  rows,
  record,
  analysis,
  tests,
  onAgain,
}: {
  rows: Row[];
  record: TestRecord;
  analysis: TestAnalysis;
  tests: TestRecord[];
  onAgain: () => void;
}) {
  const { settings, srs, setSrs } = useApp();
  const [added, setAdded] = useState(false);
  const wrong = rows.filter((r) => !r.res.r.correct);
  // PLAN §4: using the level-3 hint (full answer) also marks the item for review.
  const reviewIds = Array.from(new Set([...record.wrongIds, ...rows.filter((r) => r.res.hintLevel >= 3).map((r) => r.q.item.id)]));
  // rows: only expected tones that were actually confused; columns: every tone involved
  const rowTones = Object.keys(analysis.toneConfusion)
    .filter((t) => Object.values(analysis.toneConfusion[t] ?? {}).some((n) => n > 0))
    .sort();
  const tones = Array.from(
    new Set([
      ...Object.keys(analysis.toneConfusion),
      ...Object.values(analysis.toneConfusion).flatMap((r) => Object.keys(r)),
    ]),
  ).sort();
  const inits = topN(analysis.initialErrors);
  const finals = topN(analysis.finalErrors);

  return (
    <>
      <section className="panel paper result-head">
        <div className={`grade grade-${record.grade}`} aria-label={`等級 ${record.grade}`}>
          {record.grade}
        </div>
        <dl className="stats">
          <div>
            <dt>正確率</dt>
            <dd>{Math.round(analysis.accuracy * 100)}%</dd>
          </div>
          <div>
            <dt>答對</dt>
            <dd>
              {record.correct} / {record.total}
            </dd>
          </div>
          <div>
            <dt>平均作答</dt>
            <dd>{fmtSec(record.avgMs)}</dd>
          </div>
          <div>
            <dt>使用提示題數</dt>
            <dd>{record.hintsUsed} 題</dd>
          </div>
        </dl>
      </section>

      <section className="panel paper">
        <h2 className="section-title">錯誤分析</h2>
        {inits.length + finals.length + tones.length === 0 ? (
          <p className="muted">沒有錯誤，好功夫！</p>
        ) : (
          <div className="analysis-grid">
            <div>
              <h3 className="sub-title">聲母混淆</h3>
              {inits.length ? (
                <ul className="bar-list">
                  {inits.map(([k, v]) => (
                    <li key={k}>
                      <code>{k}</code>
                      <span className="bar" style={{ width: `${Math.min(100, v * 20)}%` }} />
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">無</p>
              )}
            </div>
            <div>
              <h3 className="sub-title">韻母混淆</h3>
              {finals.length ? (
                <ul className="bar-list">
                  {finals.map(([k, v]) => (
                    <li key={k}>
                      <code>{k}</code>
                      <span className="bar" style={{ width: `${Math.min(100, v * 20)}%` }} />
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">無</p>
              )}
            </div>
            <div>
              <h3 className="sub-title">聲調混淆（行＝正確，列＝你打的）</h3>
              {tones.length ? (
                <div className="table-wrap">
                  <table className="table tone-matrix">
                    <thead>
                      <tr>
                        <th scope="col">
                          <span className="sr-only">正確聲調</span>
                        </th>
                        {tones.map((t) => (
                          <th key={t} scope="col">
                            {t}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rowTones.map((e) => (
                        <tr key={e}>
                          <th scope="row">{e}</th>
                          {tones.map((g) => {
                            const v = analysis.toneConfusion[e]?.[g] ?? 0;
                            return (
                              <td key={g} className={v ? (e === g ? 'hit' : 'miss') : ''}>
                                {v || ''}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted small">無</p>
              )}
            </div>
          </div>
        )}
      </section>

      {reviewIds.length > 0 && (
        <section className="panel paper">
          <div className="section-head">
            <h2 className="section-title">錯題（{wrong.length}）</h2>
            <button
              type="button"
              className="btn btn-primary"
              disabled={added}
              onClick={() => {
                let s = srs;
                for (const id of reviewIds) s = reviewCard(s, id, false);
                setSrs(s);
                setAdded(true);
              }}
            >
              {added ? '✓ 已加入複習' : `加入複習（${reviewIds.length}）`}
            </button>
          </div>
          <ul className="wrong-list">
            {wrong.map(({ q, res }, i) => (
              <li key={i}>
                <HanziCard item={q.item} script={settings.script} size="md" toneSystem={q.system} />
                <div>
                  <div>
                    <span className="muted small">你打：</span>
                    <code className="given">{res.raw}</code>
                  </div>
                  <div>
                    <span className="muted small">答案：</span>
                    <ToneColored text={q.answer} system={q.system} /> <code className="small muted">{q.answer}</code>
                  </div>
                  <ReasonToggle item={q.item} system={q.system} persist={false} compact />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="center row-btns">
        <button type="button" className="btn btn-primary btn-lg" onClick={onAgain} autoFocus>
          再測一次
        </button>
      </div>
      <History tests={tests} />
    </>
  );
}

function History({ tests }: { tests: TestRecord[] }) {
  if (!tests.length) return null;
  const recent = tests.slice(-8).reverse();
  return (
    <section className="panel paper">
      <h2 className="section-title">歷史成績</h2>
      <AccuracyChart tests={tests} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">日期</th>
              <th scope="col">等級</th>
              <th scope="col">正確</th>
              <th scope="col">強度</th>
              <th scope="col">系統</th>
              <th scope="col">平均</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((t, i) => (
              <tr key={i}>
                <td className="small">{fmtDate(t.date)}</td>
                <td>
                  <strong className={`grade-text grade-${t.grade}`}>{t.grade}</strong>
                </td>
                <td className="num">
                  {t.correct}/{t.total}
                </td>
                <td>{LEVEL_NAME[t.level]}</td>
                <td>{SYSTEM_NAME[t.system]}</td>
                <td className="small">{fmtSec(t.avgMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
