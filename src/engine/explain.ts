// "為甚麼？" — explains why an item is read the way it is (initial + final + tone, spelling rules,
// polyphones, tone sandhi). Pure and data-driven so it can be unit-tested.

import type { Item } from '../types/data';
import type { Explanation, RomanSystem, SyllableExplanation } from '../types/engine';
import { splitSyllable, toDiacritic } from './romanization';

const PINYIN_TONES: Record<string, [string, string]> = {
  '1': ['第一聲・陰平', '高平 55'],
  '2': ['第二聲・陽平', '中升 35'],
  '3': ['第三聲・上聲', '降升 214'],
  '4': ['第四聲・去聲', '全降 51'],
  '5': ['輕聲', '輕而短，不標調'],
};

const JYUTPING_TONES: Record<string, [string, string]> = {
  '1': ['第一聲・陰平', '高平 55'],
  '2': ['第二聲・陰上', '高升 35'],
  '3': ['第三聲・陰去', '中平 33'],
  '4': ['第四聲・陽平', '低降 21'],
  '5': ['第五聲・陽上', '低升 13'],
  '6': ['第六聲・陽去', '低平 22'],
};
// Checked syllables (final -p/-t/-k) only take tones 1, 3, 6 and are called 入聲.
const JYUTPING_ENTERING: Record<string, string> = { '1': '陰入', '3': '中入', '6': '陽入' };

function pinyinNotes(initial: string, final: string, tone: string, hanzi: string): string[] {
  const n: string[] = [];
  if (initial === 'y' || initial === 'w') n.push(`零聲母音節，開頭的 ${initial} 只是書寫形式（例：yi = i，wu = u）。`);
  if (/^[jqxy]$/.test(initial) && final.startsWith('u')) {
    n.push(`${initial} 後面的 ü 省去兩點寫成 u；輸入時打 u 或 v 都可以。`);
  }
  if (final.includes('v')) n.push('ü 在 n、l 後要保留兩點（寫 ü），輸入時打 v，例：lv4 = lǜ。');
  if (final === 'iu') n.push('iu 是 iou 的省寫（例：jiu = j + iou）。');
  if (final === 'ui') n.push('ui 是 uei 的省寫（例：gui = g + uei）。');
  if (final === 'un' && !/^[jqxy]$/.test(initial)) n.push('un 是 uen 的省寫（例：chun = ch + uen）。');
  if (/^(zh|ch|sh|r|z|c|s)$/.test(initial) && final === 'i') {
    n.push(`${initial}i 的 i 不是「衣」的音，而是舌尖元音，只寫作 i。`);
  }
  if (/^(zh|ch|sh)$/.test(initial)) n.push(`${initial} 是翹舌音，注意不要讀成 ${initial[0]}。`);
  if (tone === '5') n.push('輕聲不標調：輸入時可打 5 或不打聲調；本遊戲亦接受原調。');
  if (hanzi === '一') n.push('「一」單用讀 yī；在第四聲前變 yí、在其他聲調前變 yì。本遊戲以原調為準，變調亦接受。');
  if (hanzi === '不') n.push('「不」在第四聲前變 bú（例：不是 bú shì）。本遊戲以原調 bù 為準，變調亦接受。');
  return n;
}

function jyutpingNotes(initial: string, final: string, tone: string): string[] {
  const n: string[] = [];
  if (/[ptk]$/.test(final)) n.push(`入聲：以 -${final.slice(-1)} 收尾，讀得短促，只配第 1、3、6 聲。`);
  if (initial === 'gw' || initial === 'kw') n.push(`${initial} 是圓唇聲母（嘴唇要圓），懶音常讀成 ${initial[0]}。`);
  if (initial === 'ng') n.push('ng 聲母：舌根鼻音，懶音常把它省掉（如「我」ngo5 讀成 o5）。');
  if (initial === 'n') n.push('n 與 l 要分清：n 是鼻音，懶音常讀成 l。');
  if (initial === 'j') n.push('粵拼的 j 等於英文的 y 音（例：jan4 人）。');
  if (initial === 'z' || initial === 'c') n.push(`粵拼的 ${initial} 對應普通話的 ${initial === 'z' ? 'z / zh / j' : 'c / ch / q'} 一類聲母。`);
  if (final.startsWith('oe') || final.startsWith('eo')) n.push(`${final} 是圓唇的「靴」類元音，普通話沒有，要圓唇發音。`);
  if (final.startsWith('yu')) n.push('yu 是圓唇的 ü 音（如「魚」jyu4）。');
  if ((initial === '' && (final === 'm' || final === 'ng'))) n.push(`${final} 自成音節（鼻音音節），沒有元音。`);
  if (final.endsWith('ng') && final !== 'ng') n.push('-ng 收尾（舌根），懶音常讀成 -n。');
  if (tone === '4' || tone === '5' || tone === '6') n.push('陽調（第 4、5、6 聲）音高較低。');
  return n;
}

function syllableOf(item: Item, i: number, system: RomanSystem): SyllableExplanation {
  const s = item.syllables[i];
  const roman = system === 'pinyin' ? s.pinyin : s.jyutping;
  const other = system === 'pinyin' ? s.jyutping : s.pinyin;
  const { initial, final, tone: rawTone } = splitSyllable(roman, system);
  const tone = rawTone || (system === 'pinyin' ? '5' : '');
  let toneName = '';
  let contour = '';
  if (system === 'pinyin') {
    [toneName, contour] = PINYIN_TONES[tone] ?? ['', ''];
  } else {
    [toneName, contour] = JYUTPING_TONES[tone] ?? ['', ''];
    if (/[ptk]$/.test(final) && JYUTPING_ENTERING[tone]) toneName += `（${JYUTPING_ENTERING[tone]}）`;
  }
  const notes = system === 'pinyin' ? pinyinNotes(initial, final, tone, s.hanzi) : jyutpingNotes(initial, final, tone);

  const alts = (system === 'pinyin' ? s.pinyinAlt : s.jyutpingAlt) ?? [];
  if (s.polyphonic) {
    const word = item.syllables.length > 1 ? `在「${item.textTrad || item.text}」中` : '這裏';
    const also = alts.length ? `；亦接受 ${alts.map((a) => (system === 'pinyin' ? toDiacritic(a) : a)).join('、')}` : '';
    notes.unshift(`多音字：${word}讀 ${system === 'pinyin' ? toDiacritic(roman) : roman}${also}。`);
  }

  return {
    hanzi: s.hanzi,
    hanziTrad: s.hanziTrad,
    roman,
    display: system === 'pinyin' ? toDiacritic(roman) : roman,
    initial,
    final,
    tone,
    toneName,
    contour,
    notes,
    other: other ? (system === 'pinyin' ? other : toDiacritic(other)) : '',
  };
}

export function explainAnswer(item: Item, system: RomanSystem): Explanation {
  const syllables = item.syllables.map((_, i) => syllableOf(item, i, system));
  const notes: string[] = [];
  if (system === 'pinyin') {
    // third-tone sandhi: 3 + 3 -> the first is pronounced as tone 2 (still written as tone 3)
    for (let i = 0; i + 1 < syllables.length; i++) {
      if (syllables[i].tone === '3' && syllables[i + 1].tone === '3') {
        const a = syllables[i];
        notes.push(`兩個第三聲相連：「${a.hanziTrad || a.hanzi}」實際讀成第二聲（${toDiacritic(a.roman.replace(/3$/, '2'))}），但拼寫仍標第三聲。`);
      }
    }
  }
  if (syllables.length > 1) {
    notes.push(`逐字拼出後連起來：${syllables.map((s) => s.display).join(' ')}。`);
  }
  return { system, syllables, notes };
}
