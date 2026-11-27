import { useCallback, useEffect, useRef, useState } from 'react';
import type { CheckResult, HintLevel, LeaderboardEntry, Question } from '../../types/engine';
import type { Level } from '../../types/data';
import { LEVEL_MULTIPLIER, addLeaderboard, addRecent, buildQuestions, checkAnswer, getHint, loadLeaderboard, loadRecent, scoreAnswer } from '../../engine';
import { sfx } from '../audio/sfx';
import { AnswerInput } from '../components/AnswerInput';
import { PauseOverlay, Overlay, ScreenHeader } from '../components/Common';
import { Fighter, type FighterAnim, type FighterKind } from '../components/Fighter';
import { HanziCard } from '../components/HanziCard';
import { HintBar } from '../components/HintBar';
import { Hearts, HpBar } from '../components/HpBar';
import { SyllableFeedback } from '../components/SyllableFeedback';
import { ToneColored } from '../components/ToneColored';
import { TtsButton } from '../components/TtsButton';
import { useApp } from '../store';
import { useKeyboardAlign } from '../hooks/useKeyboardAlign';
import { ReasonToggle } from '../components/ReasonBox';
import { ENEMY_NAME, HEARTS, LEVEL_NAME, ROMAN_NAME, SYSTEM_NAME, chapterName } from '../util';

type Stage = number | 'endless';
type EnemyKind = Exclude<FighterKind, 'hero'>;
const GRUNTS: EnemyKind[] = ['bandit', 'saber', 'sword', 'shadow'];
const GRUNTS_PER_BOSS = 5;
const PLAYER_BASE_MS: Record<Level, number> = { 1: 12000, 2: 8000, 3: 5000 };
const SPECIAL_NAMES: Record<number, string> = { 5: '疾風一字斬', 10: '潑墨千重浪', 20: '奔雷破空' };

interface Enemy {
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  boss: boolean;
}
interface Floater {
  id: number;
  text: string;
  cls: string;
}
interface Game {
  stage: Stage;
  hearts: number;
  score: number;
  combo: number;
  maxCombo: number;
  kills: number;
  gruntsDown: number;
  answered: number;
  correct: number;
  enemy: Enemy;
  q: Question;
  qStart: number;
  limit: number;
  pauseAt: number | null;
  hintLevel: HintLevel;
  ttsUsed: boolean;
  pool: Question[];
  bossPool: Question[];
  locked: boolean;
  playerAnim: FighterAnim;
  enemyAnim: FighterAnim;
  animKey: number;
  floaters: Floater[];
  special: string | null;
  missed: { q: Question; r: CheckResult | null } | null;
  status: 'fight' | 'clear' | 'over';
}

let floaterId = 0;

export function Challenge() {
  const { progress } = useApp();
  const [stage, setStage] = useState<Stage | null>(null);
  const [run, setRun] = useState(0);
  if (stage === null) return <StageSelect unlocked={progress.unlockedStage} onPick={(s) => setStage(s)} />;
  return (
    <Arena
      key={`${stage}-${run}`}
      stage={stage}
      onExit={() => setStage(null)}
      onRetry={() => setRun((r) => r + 1)}
      onNext={(s) => {
        setStage(s);
        setRun((r) => r + 1);
      }}
    />
  );
}

function StageSelect({ unlocked, onPick }: { unlocked: number; onPick: (s: Stage) => void }) {
  const settings = useApp((s) => s.settings);
  const [best] = useState(() => {
    const m = new Map<string, number>();
    for (const e of loadLeaderboard()) {
      const k = String(e.stage);
      m.set(k, Math.max(m.get(k) ?? 0, e.score));
    }
    return m;
  });
  return (
    <main className="screen">
      <ScreenHeader title="挑戰模式・打字俠" />
      <p className="center muted small">
        {SYSTEM_NAME[settings.system]}・{LEVEL_NAME[settings.level]}・{HEARTS[settings.level]} 心・提示{settings.hintsEnabled ? '開（扣分）' : '關'}
      </p>
      <section className="stage-grid" aria-label="關卡">
        {Array.from({ length: 13 }, (_, i) => i + 1).map((s) => {
          const locked = s > unlocked;
          return (
            <button
              key={s}
              type="button"
              className={`stage-btn ${locked ? 'locked' : ''} ${s < unlocked ? 'cleared' : ''}`}
              disabled={locked}
              onClick={() => onPick(s)}
              aria-label={`${chapterName(s)}${locked ? '（未解鎖）' : ''}`}
            >
              <span className="stage-no">{s}</span>
              <span className="stage-name">{chapterName(s)}</span>
              <span className="small muted">{locked ? '🔒' : best.has(String(s)) ? `最高 ${best.get(String(s))}` : s < unlocked ? '已通關' : '挑戰'}</span>
            </button>
          );
        })}
        <button type="button" className="stage-btn endless" onClick={() => onPick('endless')}>
          <span className="stage-no">∞</span>
          <span className="stage-name">無盡模式</span>
          <span className="small muted">{best.has('endless') ? `最高 ${best.get('endless')}` : '越戰越快'}</span>
        </button>
      </section>
      <section className="panel paper small">
        <ul className="rules">
          <li>對手頭上出現字詞，限時內打出{SYSTEM_NAME[settings.system]}即出招；答錯或超時，對手反擊，失一心。</li>
          <li>連擊 5／10／20 → 傷害 ×1.2／×1.5／×2 並施展絕招。</li>
          <li>每擊敗 {GRUNTS_PER_BOSS} 個對手，頭目登場（長詞成語，三倍血量）。擊敗頭目即通關。</li>
          <li>Enter 出招・Tab 提示・Esc 暫停。</li>
        </ul>
      </section>
    </main>
  );
}

function Arena({ stage, onExit, onRetry, onNext }: { stage: Stage; onExit: () => void; onRetry: () => void; onNext: (s: Stage) => void }) {
  const { items, settings, progress, setProgress } = useApp();
  const level = settings.level;
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((t) => t + 1), []);
  const [value, setValue] = useState('');
  const [paused, setPaused] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const timers = useRef(new Set<number>());

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);

  useEffect(() => {
    const set = timers.current;
    return () => set.forEach((id) => window.clearTimeout(id));
  }, []);

  const buildPool = useCallback(
    (boss: boolean): Question[] => {
      const chapters = stage === 'endless' ? undefined : [stage];
      const opts = {
        mode: 'challenge' as const,
        level: boss ? (3 as Level) : level,
        system: settings.system,
        count: boss ? 12 : 30,
        recentIds: loadRecent(), // words from recent rounds come last, so each round feels fresh
      };
      let qs = buildQuestions(items, { ...opts, chapters });
      if (!qs.length) qs = buildQuestions(items, opts);
      return qs;
    },
    [items, level, settings.system, stage],
  );

  const g = useRef<Game | null>(null);
  // mobile: keep the arena + answer box right above the on-screen keyboard
  const inputAreaRef = useRef<HTMLDivElement>(null);
  useKeyboardAlign(inputAreaRef);

  const speedFactor = (kills: number) => (stage === 'endless' ? Math.max(0.4, Math.pow(0.95, Math.floor(kills / 5))) : 1);

  const limitFor = (q: Question, boss: boolean, kills: number) => {
    let base = q.timeLimitMs ?? PLAYER_BASE_MS[level];
    if (boss && level < 3) base = Math.max(base, PLAYER_BASE_MS[level] + 1000 * Math.max(0, q.item.syllables.length - 1));
    return base * speedFactor(kills);
  };

  const makeEnemy = (index: number, boss: boolean): Enemy => {
    const base = Math.round(220 * LEVEL_MULTIPLIER[level]);
    const hp = boss ? base * 3 : base;
    const offset = typeof stage === 'number' ? stage : 0;
    return { kind: boss ? 'boss' : GRUNTS[(index + offset) % GRUNTS.length], hp, maxHp: hp, boss };
  };

  const draw = (G: Game, boss: boolean): Question | null => {
    const key = boss ? 'bossPool' : 'pool';
    if (!G[key].length) G[key] = buildPool(boss);
    return G[key].shift() ?? null;
  };

  if (g.current === null) {
    const pool = buildPool(false);
    const first = pool.shift();
    if (first) {
      g.current = {
        stage,
        hearts: HEARTS[level],
        score: 0,
        combo: 0,
        maxCombo: 0,
        kills: 0,
        gruntsDown: 0,
        answered: 0,
        correct: 0,
        enemy: makeEnemy(0, false),
        q: first,
        qStart: performance.now(),
        limit: limitFor(first, false, 0),
        pauseAt: null,
        hintLevel: 0,
        ttsUsed: false,
        pool,
        bossPool: [],
        locked: false,
        playerAnim: 'idle',
        enemyAnim: 'idle',
        animKey: 0,
        floaters: [],
        special: null,
        missed: null,
        status: 'fight',
      };
    }
  }

  const nextQuestion = (G: Game) => {
    const q = draw(G, G.enemy.boss);
    if (!q) return;
    G.q = q;
    // If paused while a hit/miss animation was pending, start the clock from the pause moment
    // (resume() shifts qStart by the paused duration).
    G.qStart = G.pauseAt ?? performance.now();
    G.limit = limitFor(q, G.enemy.boss, G.kills);
    G.hintLevel = 0;
    G.ttsUsed = false;
    G.missed = null;
    setValue('');
  };

  const addFloater = (G: Game, text: string, cls: string) => {
    const f = { id: ++floaterId, text, cls };
    G.floaters = [...G.floaters, f];
    later(() => {
      G.floaters = G.floaters.filter((x) => x.id !== f.id);
      rerender();
    }, 900);
  };

  const resolve = (raw: string, timedOut: boolean) => {
    const G = g.current;
    if (!G || G.locked || G.status !== 'fight' || G.pauseAt !== null) return;
    const elapsed = performance.now() - G.qStart;
    addRecent([G.q.item.id]);
    const r = timedOut ? null : checkAnswer(raw, G.q, level);
    const correct = !!r?.correct;
    const hintPenalty = Math.max(G.hintLevel > 0 ? getHint(G.q, G.hintLevel).penalty : 0, G.ttsUsed ? 0.1 : 0);
    const out = scoreAnswer({ level, correct, combo: G.combo, timeLeftRatio: Math.max(0, 1 - elapsed / G.limit), hintPenalty });
    G.answered += 1;
    G.animKey += 1;
    if (correct) {
      G.correct += 1;
      G.score += out.points;
      G.combo = out.newCombo;
      G.maxCombo = Math.max(G.maxCombo, G.combo);
      const dmg = Math.max(10, out.points);
      G.enemy = { ...G.enemy, hp: Math.max(0, G.enemy.hp - dmg) };
      G.playerAnim = out.special ? 'special' : 'attack';
      G.enemyAnim = 'hurt';
      addFloater(G, `−${dmg}`, 'dmg');
      sfx.hit();
      if (out.special) {
        G.special = SPECIAL_NAMES[G.combo] ?? '絕招';
        sfx.combo();
        later(() => {
          G.special = null;
          rerender();
        }, 1400);
      }
      if (G.enemy.hp <= 0) {
        G.locked = true;
        G.enemyAnim = 'dead';
        G.kills += 1;
        const wasBoss = G.enemy.boss;
        if (!wasBoss) G.gruntsDown += 1;
        later(() => {
          if (wasBoss && stage !== 'endless') {
            G.status = 'clear';
            G.playerAnim = 'win';
            sfx.victory();
            const nextUnlock = Math.min(14, Math.max(progress.unlockedStage, stage + 1));
            if (nextUnlock !== progress.unlockedStage) setProgress({ ...progress, unlockedStage: nextUnlock });
            rerender();
            return;
          }
          const boss = !wasBoss && G.gruntsDown > 0 && G.gruntsDown % GRUNTS_PER_BOSS === 0;
          G.enemy = makeEnemy(G.kills, boss);
          G.enemyAnim = 'idle';
          G.playerAnim = 'idle';
          G.locked = false;
          nextQuestion(G);
          rerender();
        }, 850);
      } else {
        nextQuestion(G);
      }
    } else {
      G.combo = 0;
      G.hearts -= 1;
      G.enemyAnim = 'attack';
      G.playerAnim = 'hurt';
      G.locked = true;
      G.missed = { q: G.q, r };
      G.pool.push(G.q); // practise it again later
      addFloater(G, timedOut ? '超時！' : '失手！', 'miss');
      sfx.hurt();
      if (G.hearts <= 0) {
        later(() => {
          G.playerAnim = 'dead';
          rerender();
        }, 400);
        later(() => {
          G.status = 'over';
          sfx.defeat();
          rerender();
        }, 1600);
      } else {
        later(() => {
          G.locked = false;
          G.playerAnim = 'idle';
          G.enemyAnim = 'idle';
          nextQuestion(G);
          rerender();
        }, settings.showReason ? 5000 : settings.hintsEnabled ? 1900 : 1400); // longer when the 解說 box is open
      }
    }
    rerender();
  };

  const resolveRef = useRef(resolve);
  useEffect(() => {
    resolveRef.current = resolve;
  });

  // countdown loop
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const G = g.current;
      const bar = barRef.current;
      if (G && bar && G.status === 'fight') {
        if (!G.locked && G.pauseAt === null) {
          const ratio = 1 - (performance.now() - G.qStart) / G.limit;
          bar.style.transform = `scaleX(${Math.max(0, ratio)})`;
          bar.classList.toggle('warn', ratio < 0.3);
          if (ratio <= 0) resolveRef.current('', true);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pause = () => {
    const G = g.current;
    if (!G || G.status !== 'fight' || G.pauseAt !== null) return;
    G.pauseAt = performance.now();
    setPaused(true);
  };
  const resume = () => {
    const G = g.current;
    if (G && G.pauseAt !== null) {
      G.qStart += performance.now() - G.pauseAt;
      G.pauseAt = null;
    }
    setPaused(false);
  };

  // pause when tab hidden
  useEffect(() => {
    const h = () => {
      if (document.hidden) {
        const G = g.current;
        if (G && G.status === 'fight' && G.pauseAt === null) {
          G.pauseAt = performance.now();
          setPaused(true);
        }
      }
    };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);

  const G = g.current;
  if (!G) {
    return (
      <main className="screen">
        <ScreenHeader title="挑戰模式" onBack={onExit} />
        <p className="center">沒有可用的字詞。</p>
      </main>
    );
  }

  const hintsOn = settings.hintsEnabled;
  const enemyName = G.enemy.boss ? `頭目` : ENEMY_NAME[G.enemy.kind];
  const stageLabel = stage === 'endless' ? '無盡模式' : chapterName(stage);
  const accuracy = G.answered ? Math.round((G.correct / G.answered) * 100) : 0;

  return (
    <main className="screen screen-wide challenge">
      <ScreenHeader
        title={stageLabel}
        onBack={pause}
        right={
          <button type="button" className="btn btn-ghost" onClick={pause} aria-label="暫停">
            ⏸
          </button>
        }
      />
      <div className="hud">
        <div className="hud-left">
          <div className="hud-label">俠客</div>
          <Hearts n={G.hearts} max={HEARTS[level]} />
        </div>
        <div className="hud-mid" aria-live="polite">
          <div className="score">{G.score.toLocaleString()}</div>
          <div className={`combo ${G.combo >= 5 ? 'hot' : ''}`}>{G.combo > 1 ? `${G.combo} 連擊` : ' '}</div>
        </div>
        <div className="hud-right">
          <HpBar hp={G.enemy.hp} max={G.enemy.maxHp} label={`${enemyName}${stage === 'endless' ? ` #${G.kills + 1}` : G.enemy.boss ? '' : ` ${G.gruntsDown + 1}/${GRUNTS_PER_BOSS}`}`} side="right" />
        </div>
      </div>

      <div className={`arena ${G.enemy.boss ? 'boss-fight' : ''} ${G.special ? 'shake' : ''}`}>
        <ArenaBackdrop />
        <div className="word-bubble" aria-live="polite">
          <div className="word-sys">
            <span className={`sys-tag sys-${G.q.system}`}>{ROMAN_NAME[G.q.system]}</span>
            {G.enemy.boss && <span className="boss-tag">頭目</span>}
          </div>
          <HanziCard item={G.q.item} script={settings.script} toneSystem={hintsOn ? G.q.system : null} size="lg" />
          <div className="countdown" aria-hidden="true">
            <div ref={barRef} className="countdown-fill" />
          </div>
          {G.missed && (
            <div className="missed">
              正解：<ToneColored text={G.missed.q.answer} system={G.missed.q.system} colored={hintsOn} />
            </div>
          )}
        </div>
        <Fighter kind="hero" anim={G.playerAnim} animKey={G.animKey} side="left" label="俠客（你）" />
        <Fighter kind={G.enemy.kind} anim={G.enemyAnim} animKey={G.animKey} side="right" label={enemyName} />
        <div className="floaters" aria-hidden="true">
          {G.floaters.map((f) => (
            <span key={f.id} className={`floater ${f.cls}`}>
              {f.text}
            </span>
          ))}
        </div>
        {G.special && (
          <div className="special-flash" role="status">
            <span className="special-small">絕招</span>
            <span className="special-name">{G.special}</span>
          </div>
        )}
      </div>

      {G.status === 'fight' && (
        <div className="challenge-input" ref={inputAreaRef}>
          <AnswerInput
            value={value}
            onChange={setValue}
            onSubmit={(v) => resolve(v, false)}
            system={G.q.system}
            onHint={
              hintsOn
                ? () => {
                    if (G.hintLevel < 3) G.hintLevel = (G.hintLevel + 1) as HintLevel;
                    rerender();
                  }
                : undefined
            }
            onEscape={pause}
            disabled={paused}
            locked={G.locked}
            status={G.missed ? 'bad' : null}
          />
          {G.missed && <ReasonToggle item={G.missed.q.item} system={G.missed.q.system} compact />}
          {hintsOn && !G.missed && (
            <div className="hint-row">
              <HintBar
                q={G.q}
                level={G.hintLevel}
                onNext={() => {
                  if (G.hintLevel < 3) G.hintLevel = (G.hintLevel + 1) as HintLevel;
                  rerender();
                }}
              />
              <TtsButton
                text={G.q.item.textTrad || G.q.item.text}
                system={G.q.system}
                penaltyNote="−10%"
                onSpeak={() => {
                  G.ttsUsed = true;
                }}
              />
            </div>
          )}
          {hintsOn && G.missed?.r && <SyllableFeedback result={G.missed.r} system={G.missed.q.system} />}
        </div>
      )}

      {paused && G.status === 'fight' && <PauseOverlay onResume={resume} onQuit={onExit} />}

      {G.status !== 'fight' && (
        <EndPanel
          cleared={G.status === 'clear'}
          stage={stage}
          score={G.score}
          maxCombo={G.maxCombo}
          kills={G.kills}
          accuracy={accuracy}
          onExit={onExit}
          onRetry={onRetry}
          onNext={typeof stage === 'number' && stage < 13 && G.status === 'clear' ? () => onNext(stage + 1) : undefined}
        />
      )}
    </main>
  );
}

const NAME_KEY = 'ctf:lastName';
function lastName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function EndPanel({
  cleared,
  stage,
  score,
  maxCombo,
  kills,
  accuracy,
  onExit,
  onRetry,
  onNext,
}: {
  cleared: boolean;
  stage: Stage;
  score: number;
  maxCombo: number;
  kills: number;
  accuracy: number;
  onExit: () => void;
  onRetry: () => void;
  onNext?: () => void;
}) {
  const settings = useApp((s) => s.settings);
  const [name, setName] = useState(lastName);
  const [board, setBoard] = useState<LeaderboardEntry[] | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function save() {
    const n = name.trim().slice(0, 12) || '無名俠客';
    try {
      localStorage.setItem(NAME_KEY, n);
    } catch {
      /* ignore */
    }
    const date = Date.now();
    const b = addLeaderboard({ name: n, score, level: settings.level, system: settings.system, stage, date });
    setSavedAt(date);
    setBoard(b);
  }

  return (
    <Overlay label={cleared ? '過關' : '敗陣'}>
      <h2 className={`seal-title ${cleared ? '' : 'lose'}`}>{cleared ? '過關！' : stage === 'endless' ? '力竭' : '敗陣'}</h2>
      {cleared && typeof stage === 'number' && <p className="center">{stage < 13 ? `已解鎖 ${chapterName(stage + 1)}` : '十三關全破，真正的打字俠！'}</p>}
      <dl className="stats">
        <div>
          <dt>得分</dt>
          <dd>{score.toLocaleString()}</dd>
        </div>
        <div>
          <dt>最高連擊</dt>
          <dd>{maxCombo}</dd>
        </div>
        <div>
          <dt>擊敗</dt>
          <dd>{kills}</dd>
        </div>
        <div>
          <dt>命中率</dt>
          <dd>{accuracy}%</dd>
        </div>
      </dl>
      {score > 0 && !board && (
        <form
          className="name-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label>
            <span>留名排行榜</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={12} placeholder="俠名" autoFocus />
          </label>
          <button type="submit" className="btn btn-primary">
            留名
          </button>
        </form>
      )}
      {board && (
        <ol className="mini-board">
          {board.map((e, i) => (
            <li key={i} className={e.date === savedAt && e.score === score ? 'me' : undefined}>
              <span>{i + 1}.</span> <span>{e.name}</span> <strong>{e.score.toLocaleString()}</strong>
            </li>
          ))}
        </ol>
      )}
      <div className="row-btns">
        {onNext && (
          <button type="button" className="btn btn-primary btn-lg" onClick={onNext} autoFocus={score === 0 || !!board}>
            下一關 →
          </button>
        )}
        <button type="button" className="btn btn-lg" onClick={onRetry}>
          再戰
        </button>
        <button type="button" className="btn btn-lg" onClick={onExit}>
          選關
        </button>
      </div>
    </Overlay>
  );
}

function ArenaBackdrop() {
  return (
    <svg className="backdrop" viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <circle cx="320" cy="48" r="22" className="bd-sun" />
      <path d="M0 140 L40 92 L70 118 L110 70 L150 112 L190 84 L230 120 L270 78 L320 116 L360 90 L400 120 L400 200 L0 200 Z" className="bd-far" />
      <path d="M0 160 L50 126 L90 148 L140 118 L200 152 L250 128 L300 150 L350 124 L400 150 L400 200 L0 200 Z" className="bd-mid" />
      <path d="M0 178 Q100 168 200 176 T400 172 L400 200 L0 200 Z" className="bd-ground" />
      <g className="bd-pine">
        <path d="M30 176 L34 120" strokeWidth="2.5" />
        <path d="M18 132 Q34 124 48 132 M14 146 Q34 136 52 146 M22 120 Q34 114 44 120" strokeWidth="3" fill="none" />
      </g>
    </svg>
  );
}
