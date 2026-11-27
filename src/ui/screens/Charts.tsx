import { useState } from 'react';
import { ScreenHeader, Seg } from '../components/Common';
import { ToneColored } from '../components/ToneColored';
import { TtsButton } from '../components/TtsButton';

type Tab = 'pinyin' | 'jyutping';

// [romanization, example char, example numbered reading]
const PY_INITIALS: [string, string, string][] = [
  ['b', '八', 'ba1'], ['p', '怕', 'pa4'], ['m', '馬', 'ma3'], ['f', '飛', 'fei1'],
  ['d', '大', 'da4'], ['t', '天', 'tian1'], ['n', '你', 'ni3'], ['l', '來', 'lai2'],
  ['g', '高', 'gao1'], ['k', '口', 'kou3'], ['h', '好', 'hao3'],
  ['j', '家', 'jia1'], ['q', '去', 'qu4'], ['x', '心', 'xin1'],
  ['zh', '知', 'zhi1'], ['ch', '吃', 'chi1'], ['sh', '山', 'shan1'], ['r', '人', 'ren2'],
  ['z', '字', 'zi4'], ['c', '草', 'cao3'], ['s', '三', 'san1'], ['y', '一', 'yi1'], ['w', '五', 'wu3'],
];
const PY_FINALS: [string, string, string][] = [
  ['a', '啊', 'a1'], ['o', '哦', 'o4'], ['e', '餓', 'e4'], ['i', '衣', 'yi1'], ['u', '烏', 'wu1'], ['ü (v)', '魚', 'yu2'],
  ['ai', '愛', 'ai4'], ['ei', '黑', 'hei1'], ['ao', '刀', 'dao1'], ['ou', '手', 'shou3'],
  ['an', '山', 'shan1'], ['en', '門', 'men2'], ['ang', '江', 'jiang1'], ['eng', '生', 'sheng1'], ['ong', '中', 'zhong1'],
  ['ia', '家', 'jia1'], ['ie', '獵', 'lie4'], ['iao', '笑', 'xiao4'], ['iu', '酒', 'jiu3'], ['ian', '天', 'tian1'],
  ['in', '心', 'xin1'], ['iang', '娘', 'niang2'], ['ing', '英', 'ying1'], ['iong', '雄', 'xiong2'],
  ['ua', '花', 'hua1'], ['uo', '我', 'wo3'], ['uai', '快', 'kuai4'], ['ui', '回', 'hui2'], ['uan', '關', 'guan1'],
  ['un', '問', 'wen4'], ['uang', '恍', 'huang3'], ['üe (ve)', '綠', 'lv4'], ['er', '二', 'er4'],
];
const PY_TONES: [string, string, string, string][] = [
  ['1', '陰平 ˉ 高平', '天', 'tian1'],
  ['2', '陽平 ˊ 上揚', '人', 'ren2'],
  ['3', '上聲 ˇ 降升', '馬', 'ma3'],
  ['4', '去聲 ˋ 全降', '笑', 'xiao4'],
  ['5', '輕聲（可不打）', '的', 'de5'],
];

const JP_INITIALS: [string, string, string][] = [
  ['b', '巴', 'baa1'], ['p', '怕', 'paa3'], ['m', '馬', 'maa5'], ['f', '花', 'faa1'],
  ['d', '打', 'daa2'], ['t', '天', 'tin1'], ['n', '你', 'nei5'], ['l', '來', 'loi4'],
  ['g', '家', 'gaa1'], ['k', '卡', 'kaa1'], ['ng', '我', 'ngo5'], ['h', '黑', 'hak1'],
  ['gw', '光', 'gwong1'], ['kw', '誇', 'kwaa1'], ['w', '回', 'wui4'],
  ['z', '酒', 'zau2'], ['c', '層', 'cang4'], ['s', '心', 'sam1'], ['j', '人', 'jan4'],
];
const JP_FINALS: [string, string, string][] = [
  ['aa', '家', 'gaa1'], ['aai', '大', 'daai6'], ['aau', '交', 'gaau1'], ['aam', '三', 'saam1'], ['aan', '山', 'saan1'],
  ['aang', '生', 'saang1'], ['aap', '鴨', 'aap3'], ['aat', '發', 'faat3'], ['aak', '白', 'baak6'],
  ['ai', '西', 'sai1'], ['au', '手', 'sau2'], ['am', '心', 'sam1'], ['an', '人', 'jan4'], ['ang', '層', 'cang4'],
  ['ap', '十', 'sap6'], ['at', '一', 'jat1'], ['ak', '黑', 'hak1'],
  ['e', '車', 'ce1'], ['ei', '地', 'dei6'], ['eng', '鏡', 'geng3'], ['ek', '石', 'sek6'],
  ['i', '衣', 'ji1'], ['iu', '笑', 'siu3'], ['im', '店', 'dim3'], ['in', '天', 'tin1'], ['ing', '英', 'jing1'],
  ['ip', '獵', 'lip6'], ['it', '熱', 'jit6'], ['ik', '色', 'sik1'],
  ['o', '歌', 'go1'], ['oi', '來', 'loi4'], ['ou', '道', 'dou3'], ['on', '安', 'on1'], ['ong', '江', 'gong1'],
  ['ot', '喝', 'hot3'], ['ok', '國', 'gwok3'],
  ['oe', '靴', 'hoe1'], ['oeng', '娘', 'noeng4'], ['oek', '腳', 'goek3'], ['eoi', '去', 'heoi3'], ['eon', '春', 'ceon1'], ['eot', '出', 'ceot1'],
  ['u', '姑', 'gu1'], ['ui', '回', 'wui4'], ['un', '門', 'mun4'], ['ung', '雄', 'hung4'], ['ut', '活', 'wut6'], ['uk', '綠', 'luk6'],
  ['yu', '雨', 'jyu5'], ['yun', '雲', 'wan4'], ['yut', '月', 'jyut6'], ['m', '唔', 'm4'], ['ng', '五', 'ng5'],
];
const JP_TONES: [string, string, string, string][] = [
  ['1', '陰平 高平 55', '詩', 'si1'],
  ['2', '陰上 高升 35', '史', 'si2'],
  ['3', '陰去 中平 33', '試', 'si3'],
  ['4', '陽平 低降 21', '時', 'si4'],
  ['5', '陽上 低升 13', '市', 'si5'],
  ['6', '陽去 低平 22', '事', 'si6'],
];

export function Charts() {
  const [tab, setTab] = useState<Tab>('pinyin');
  const initials = tab === 'pinyin' ? PY_INITIALS : JP_INITIALS;
  const finals = tab === 'pinyin' ? PY_FINALS : JP_FINALS;
  const tones = tab === 'pinyin' ? PY_TONES : JP_TONES;
  return (
    <main className="screen">
      <ScreenHeader title={tab === 'pinyin' ? '拼音表' : '粵拼表'} />
      <div className="center">
        <Seg<Tab>
          label="表格"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'pinyin', label: '普通話拼音' },
            { value: 'jyutping', label: '粵語粵拼' },
          ]}
        />
      </div>
      <section className="panel paper">
        <h2 className="section-title">聲調</h2>
        <div className="tone-grid">
          {tones.map(([t, desc, ch, rom]) => (
            <div key={t} className="tone-card">
              <div className={`tone-num ${tab === 'pinyin' ? 'py' : 'jp'}-t${t} tone`}>{t}</div>
              <div className="tone-ex">
                <span className="ex-char">{ch}</span>
                <ToneColored text={rom} system={tab} />
                <TtsButton text={ch} system={tab} />
              </div>
              <div className="muted small">{desc}</div>
            </div>
          ))}
        </div>
        {tab === 'pinyin' ? (
          <p className="muted small">輸入時以數字標調：zhong1guo2 → zhōng guó；輕聲打 5 或不打；ü 打 v。</p>
        ) : (
          <p className="muted small">粵拼以數字 1–6 標調；入聲（-p -t -k 結尾）讀 1、3、6 調。</p>
        )}
      </section>
      <RomanTable title="聲母" rows={initials} system={tab} />
      <RomanTable title="韻母" rows={finals} system={tab} />
    </main>
  );
}

function RomanTable({ title, rows, system }: { title: string; rows: [string, string, string][]; system: Tab }) {
  return (
    <section className="panel paper">
      <h2 className="section-title">{title}</h2>
      <ul className="roman-grid">
        {rows.map(([r, ch, rom]) => (
          <li key={r + rom} className="roman-cell">
            <span className="roman-key">{r}</span>
            <span className="ex-char">{ch}</span>
            <ToneColored text={rom} system={system} className="small" />
          </li>
        ))}
      </ul>
    </section>
  );
}
