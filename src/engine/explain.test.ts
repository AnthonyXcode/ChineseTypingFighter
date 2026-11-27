import { describe, expect, it } from 'vitest';
import { explainAnswer } from './index';
import { mkItem } from './testFixtures';

describe('explainAnswer', () => {
  it('pinyin: initial, final, tone name and contour per char', () => {
    const e = explainAnswer(mkItem('中国', 'zhong1 guo2', 'zung1 gwok3'), 'pinyin');
    expect(e.syllables.map((s) => [s.display, s.initial, s.final, s.tone])).toEqual([
      ['zhōng', 'zh', 'ong', '1'],
      ['guó', 'g', 'uo', '2'],
    ]);
    expect(e.syllables[0].toneName).toContain('陰平');
    expect(e.syllables[0].contour).toBe('高平 55');
    expect(e.syllables[0].other).toBe('zung1');
    expect(e.syllables[0].notes.join()).toContain('翹舌');
    expect(e.notes.join()).toContain('zhōng guó');
  });

  it('pinyin spelling rules: ü after j/q/x/y, ü after l, iou/uei/uen, zero initial, neutral tone', () => {
    const n = (py: string, hz = '字') => explainAnswer(mkItem(hz, py, 'zi6'), 'pinyin').syllables[0].notes.join('|');
    expect(n('qu4')).toContain('ü 省去兩點');
    expect(n('lv4')).toContain('lǜ');
    expect(n('jiu3')).toContain('iou');
    expect(n('gui4')).toContain('uei');
    expect(n('chun1')).toContain('uen');
    expect(n('yi1')).toContain('零聲母');
    expect(n('de5')).toContain('輕聲');
    expect(n('yi1', '一')).toContain('變調');
    expect(n('bu4', '不')).toContain('bú');
  });

  it('pinyin third-tone sandhi', () => {
    const e = explainAnswer(mkItem('你好', 'ni3 hao3', 'nei5 hou2'), 'pinyin');
    expect(e.notes.join()).toContain('ní');
  });

  it('jyutping: tone names incl. entering tones and initial notes', () => {
    const e = explainAnswer(mkItem('国语', 'guo2 yu3', 'gwok3 jyu5'), 'jyutping');
    const [gwok, jyu] = e.syllables;
    expect([gwok.initial, gwok.final, gwok.tone]).toEqual(['gw', 'ok', '3']);
    expect(gwok.toneName).toContain('中入');
    expect(gwok.notes.join()).toContain('入聲');
    expect(gwok.notes.join()).toContain('圓唇');
    expect(gwok.other).toBe('guó');
    expect(jyu.contour).toBe('低升 13');
    const ng = explainAnswer(mkItem('我', 'wo3', 'ngo5'), 'jyutping').syllables[0];
    expect(ng.notes.join()).toContain('ng 聲母');
    const m = explainAnswer(mkItem('唔', 'wu2', 'm4'), 'jyutping').syllables[0];
    expect(m.notes.join()).toContain('自成音節');
  });

  it('polyphone note names the word and accepted alternatives', () => {
    const item = mkItem('长大', 'zhang3 da4', 'zoeng2 daai6');
    item.syllables[0].polyphonic = true;
    item.syllables[0].pinyinAlt = ['chang2'];
    const s = explainAnswer(item, 'pinyin').syllables[0];
    expect(s.notes[0]).toMatch(/多音字：在「.+」中讀 zhǎng；亦接受 cháng/);
  });
});
