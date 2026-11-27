import type { ReactNode } from 'react';
import type { Level } from '../../types/data';
import type { PracticeSystem, ScriptPref, Settings as S } from '../../types/engine';
import { ScreenHeader, Seg, Toggle } from '../components/Common';
import { useApp } from '../store';
import { LEVEL_NAME, LEVEL_RULE } from '../util';

export function Settings() {
  const { settings, updateSettings } = useApp();
  return (
    <main className="screen">
      <ScreenHeader title="設定" />
      <section className="panel paper settings-list">
        <Row label="練習系統">
          <Seg<PracticeSystem>
            label="練習系統"
            value={settings.system}
            onChange={(system) => updateSettings({ system })}
            options={[
              { value: 'pinyin', label: '拼音' },
              { value: 'jyutping', label: '粵拼' },
              { value: 'both', label: '雙拼' },
            ]}
          />
        </Row>
        <Row label="強度" note={LEVEL_RULE[settings.level]}>
          <Seg<Level>
            label="強度"
            value={settings.level}
            onChange={(level) => updateSettings({ level })}
            options={([1, 2, 3] as Level[]).map((l) => ({ value: l, label: LEVEL_NAME[l] }))}
          />
        </Row>
        <Row label="提示" note="Tab／💡 逐級提示，聲調顏色，錯處標示">
          <Toggle label="提示" checked={settings.hintsEnabled} onChange={(hintsEnabled) => updateSettings({ hintsEnabled })} />
        </Row>
        <Row label="字體" note="練習字以繁體或簡體顯示">
          <Seg<ScriptPref>
            label="字體"
            value={settings.script}
            onChange={(script) => updateSettings({ script })}
            options={[
              { value: 'trad', label: '繁體' },
              { value: 'simp', label: '简体' },
            ]}
          />
        </Row>
        <Row label="音效">
          <Toggle label="音效" checked={settings.soundOn} onChange={(soundOn) => updateSettings({ soundOn })} />
        </Row>
        <Row label="讀音 🔊" note="使用瀏覽器語音（普通話 zh-CN／粵語 zh-HK），無語音時自動隱藏">
          <Toggle label="讀音" checked={settings.ttsOn} onChange={(ttsOn) => updateSettings({ ttsOn })} />
        </Row>
        <Row label="測試即時對錯" note="關閉時，測試完成後才顯示成績">
          <Toggle
            label="測試即時對錯"
            checked={settings.testInstantFeedback}
            onChange={(testInstantFeedback) => updateSettings({ testInstantFeedback })}
          />
        </Row>
        <Row label="外觀">
          <Seg<S['theme']>
            label="外觀"
            value={settings.theme}
            onChange={(theme) => updateSettings({ theme })}
            options={[
              { value: 'auto', label: '自動' },
              { value: 'light', label: '宣紙' },
              { value: 'dark', label: '墨夜' },
            ]}
          />
        </Row>
      </section>
      <section className="panel paper">
        <h2 className="section-title">輸入規則</h2>
        <ul className="rules">
          <li>拼音：<code>zhong1guo2</code> 或 <code>zhong1 guo2</code>；ü 可打 <code>v</code> 或 <code>u:</code>；輕聲打 5 或不打。</li>
          <li>粵拼：<code>gwong2dung1</code>，聲調 1–6。</li>
          <li>雙拼：同一字先打拼音，再打粵拼。</li>
          <li>快捷鍵：Enter 提交、Tab 提示、Esc 暫停／返回。</li>
        </ul>
      </section>
    </main>
  );
}

function Row({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <div className="setting-row">
      <div>
        <div className="setting-label">{label}</div>
        {note && <div className="muted small">{note}</div>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}
