import { dueIds } from '../../engine';
import type { Level } from '../../types/data';
import type { PracticeSystem } from '../../types/engine';
import { Seg, Toggle } from '../components/Common';
import { useApp } from '../store';
import { LEVEL_NAME, LEVEL_RULE } from '../util';

export function Home() {
  const { settings, updateSettings, go, srs, items, loading, error, init } = useApp();
  const due = dueIds(srs).filter((id) => items.some((i) => i.id === id)).length;

  return (
    <main className="home">
      <div className="home-hero">
        <div className="seal" aria-hidden="true">
          打字
          <br />
          俠
        </div>
        <h1 className="home-title">拼音打字俠</h1>
        <p className="home-sub">以倪匡《奔龍》字詞，練普通話拼音與粵語粵拼</p>
      </div>

      {loading && <p className="center muted" role="status">載入字詞中…</p>}
      {error && (
        <div className="error-box" role="alert">
          資料載入失敗：{error}{' '}
          <button type="button" className="btn" onClick={() => void init()}>
            重試
          </button>
        </div>
      )}

      <section className="panel paper home-options" aria-label="練習選項">
        <div className="opt-row">
          <span className="opt-label">練習系統</span>
          <Seg<PracticeSystem>
            label="練習系統"
            value={settings.system}
            onChange={(system) => updateSettings({ system })}
            options={[
              { value: 'pinyin', label: '拼音', title: '普通話漢語拼音' },
              { value: 'jyutping', label: '粵拼', title: '粵語 Jyutping' },
              { value: 'both', label: '雙拼', title: '同一字拼音及粵拼都要打' },
            ]}
          />
        </div>
        <div className="opt-row">
          <span className="opt-label">強度</span>
          <Seg<Level>
            label="強度"
            value={settings.level}
            onChange={(level) => updateSettings({ level })}
            options={([1, 2, 3] as Level[]).map((l) => ({ value: l, label: LEVEL_NAME[l] }))}
          />
        </div>
        <p className="level-rule">{LEVEL_RULE[settings.level]}</p>
        <div className="opt-row">
          <span className="opt-label">提示</span>
          <Toggle label="提示開關" checked={settings.hintsEnabled} onChange={(hintsEnabled) => updateSettings({ hintsEnabled })} />
          <span className="muted small">{settings.hintsEnabled ? 'Tab 逐級提示・聲調顏色・錯處標示' : '無提示，真功夫'}</span>
        </div>
      </section>

      <nav className="mode-grid" aria-label="遊戲模式">
        <button type="button" className="mode-btn" onClick={() => go('learn')} disabled={loading || !!error}>
          <span className="mode-char">學</span>
          <span className="mode-name">學習模式</span>
          <span className="mode-desc">按章節學字詞，照打記讀音</span>
        </button>
        <button type="button" className="mode-btn" onClick={() => go('test')} disabled={loading || !!error}>
          <span className="mode-char">試</span>
          <span className="mode-name">測試模式</span>
          <span className="mode-desc">檢驗程度，錯誤分析</span>
        </button>
        <button type="button" className="mode-btn mode-btn-red" onClick={() => go('challenge')} disabled={loading || !!error}>
          <span className="mode-char">戰</span>
          <span className="mode-name">挑戰模式</span>
          <span className="mode-desc">打字俠武俠對決</span>
        </button>
      </nav>

      <button type="button" className="review-banner" onClick={() => go('review')} disabled={due === 0 || loading}>
        <span>📜 今日需複習</span> <strong>{due}</strong> <span>個</span>
        {due > 0 && <span className="review-go">開始複習 →</span>}
      </button>

      <nav className="home-links" aria-label="其他">
        <button type="button" className="btn btn-ghost" onClick={() => go('settings')}>
          ⚙ 設定
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => go('leaderboard')}>
          🏆 排行榜
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => go('charts')}>
          📖 拼音表／粵拼表
        </button>
      </nav>
      <footer className="footer muted small">字詞取材自倪匡《奔龍》，只作語言練習用途。</footer>
    </main>
  );
}
