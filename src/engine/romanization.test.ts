import { describe, expect, it } from 'vitest';
import {
  acceptedReadings,
  canonicalSyllable,
  checkAnswer,
  normalizeInput,
  splitSyllable,
  toDiacritic,
  toneOf,
} from './index';
import { JYUTPING_SYLLABLES, PINYIN_SYLLABLES, isLegalSyllable } from './syllables';
import { mkItem, mkQ } from './testFixtures';

describe('syllable tables', () => {
  it('pinyin has ~410 base syllables', () => {
    expect(PINYIN_SYLLABLES.size).toBeGreaterThan(400);
    expect(PINYIN_SYLLABLES.size).toBeLessThan(460);
    for (const s of ['zhuang', 'lve', 'nv', 'yu', 'er', 'a', 'jiong', 'shei']) {
      expect(isLegalSyllable(s, 'pinyin')).toBe(true);
    }
    for (const s of ['zhi1', 'bv', 'gi', 'fong', 'xa']) expect(isLegalSyllable(s, 'pinyin')).toBe(false);
  });
  it('jyutping includes initials x finals and syllabic nasals', () => {
    for (const s of ['gwong', 'ngo', 'm', 'ng', 'jyut', 'kwaang', 'aa', 'zoeng']) {
      expect(JYUTPING_SYLLABLES.has(s)).toBe(true);
    }
    expect(isLegalSyllable('zhong', 'jyutping')).toBe(false);
  });
});

describe('toneOf / splitSyllable / canonicalSyllable', () => {
  it('toneOf', () => {
    expect(toneOf('zhong1')).toBe('1');
    expect(toneOf('de')).toBe('5');
    expect(toneOf('de5')).toBe('5');
  });
  it('pinyin initials', () => {
    expect(splitSyllable('zhong1', 'pinyin')).toEqual({ initial: 'zh', final: 'ong', tone: '1' });
    expect(splitSyllable('shi4', 'pinyin')).toEqual({ initial: 'sh', final: 'i', tone: '4' });
    expect(splitSyllable('yi1', 'pinyin')).toEqual({ initial: 'y', final: 'i', tone: '1' });
    expect(splitSyllable('wo3', 'pinyin')).toEqual({ initial: 'w', final: 'o', tone: '3' });
    expect(splitSyllable('an4', 'pinyin')).toEqual({ initial: '', final: 'an', tone: '4' });
    expect(splitSyllable('de', 'pinyin')).toEqual({ initial: 'd', final: 'e', tone: '5' });
    expect(splitSyllable('jv2', 'pinyin')).toEqual({ initial: 'j', final: 'u', tone: '2' });
    expect(splitSyllable('lv4', 'pinyin')).toEqual({ initial: 'l', final: 'v', tone: '4' });
    expect(splitSyllable('ng2', 'pinyin')).toEqual({ initial: '', final: 'ng', tone: '2' });
  });
  it('jyutping initials (gw/kw/ng before g/k/n), syllabic m/ng', () => {
    expect(splitSyllable('gwong2', 'jyutping')).toEqual({ initial: 'gw', final: 'ong', tone: '2' });
    expect(splitSyllable('kwai4', 'jyutping')).toEqual({ initial: 'kw', final: 'ai', tone: '4' });
    expect(splitSyllable('ngo5', 'jyutping')).toEqual({ initial: 'ng', final: 'o', tone: '5' });
    expect(splitSyllable('m4', 'jyutping')).toEqual({ initial: '', final: 'm', tone: '4' });
    expect(splitSyllable('ng5', 'jyutping')).toEqual({ initial: '', final: 'ng', tone: '5' });
    expect(splitSyllable('jyut6', 'jyutping')).toEqual({ initial: 'j', final: 'yut', tone: '6' });
    expect(splitSyllable('aa3', 'jyutping')).toEqual({ initial: '', final: 'aa', tone: '3' });
    expect(splitSyllable('si', 'jyutping')).toEqual({ initial: 's', final: 'i', tone: '' });
  });
  it('canonicalSyllable', () => {
    expect(canonicalSyllable('QV4', 'pinyin')).toBe('qu4');
    expect(canonicalSyllable('yvan2', 'pinyin')).toBe('yuan2');
    expect(canonicalSyllable('jyu5', 'jyutping')).toBe('jyu5');
  });
});

describe('normalizeInput', () => {
  it('spaced and unspaced pinyin', () => {
    expect(normalizeInput('zhong1 guo2', 'pinyin')).toEqual(['zhong1', 'guo2']);
    expect(normalizeInput('zhong1guo2', 'pinyin')).toEqual(['zhong1', 'guo2']);
    expect(normalizeInput('  ZhongGuo  ', 'pinyin')).toEqual(['zhong', 'guo']);
    expect(normalizeInput('zhongguo2', 'pinyin', 2)).toEqual(['zhong', 'guo2']);
  });
  it('separators: apostrophe, hyphen, punctuation', () => {
    expect(normalizeInput("xi'an", 'pinyin')).toEqual(['xi', 'an']);
    expect(normalizeInput('xi’an', 'pinyin')).toEqual(['xi', 'an']);
    expect(normalizeInput('ni3-hao3!', 'pinyin')).toEqual(['ni3', 'hao3']);
  });
  it('expected count disambiguates', () => {
    expect(normalizeInput('xian', 'pinyin')).toEqual(['xian']);
    expect(normalizeInput('xian', 'pinyin', 2)).toEqual(['xi', 'an']);
    expect(normalizeInput('xian1', 'pinyin', 2)).toEqual(['xi', 'an1']);
    // closest achievable count when exact is impossible
    expect(normalizeInput('zhong', 'pinyin', 3)).toEqual(['zhong']);
  });
  it('tone digits are hard boundaries', () => {
    expect(normalizeInput('xi1an1', 'pinyin', 1)).toEqual(['xi1', 'an1']);
  });
  it('ü / u: / v', () => {
    expect(normalizeInput('lü4', 'pinyin')).toEqual(['lv4']);
    expect(normalizeInput('lu:4', 'pinyin')).toEqual(['lv4']);
    expect(normalizeInput('lv4', 'pinyin')).toEqual(['lv4']);
    expect(normalizeInput('nüè', 'pinyin')).toEqual(['nve4']);
    expect(normalizeInput('jv2', 'pinyin')).toEqual(['ju2']);
  });
  it('diacritic input', () => {
    expect(normalizeInput('zhōngguó', 'pinyin')).toEqual(['zhong1', 'guo2']);
    expect(normalizeInput('Nǐ hǎo', 'pinyin')).toEqual(['ni3', 'hao3']);
    expect(normalizeInput('lǜ', 'pinyin')).toEqual(['lv4']);
    expect(normalizeInput('ā á ǎ à', 'pinyin')).toEqual(['a1', 'a2', 'a3', 'a4']);
    // explicit digit wins over mark
    expect(normalizeInput('mā3', 'pinyin')).toEqual(['ma3']);
  });
  it('neutral tone kept as typed', () => {
    expect(normalizeInput('de5', 'pinyin')).toEqual(['de5']);
    expect(normalizeInput('de', 'pinyin')).toEqual(['de']);
  });
  it('jyutping', () => {
    expect(normalizeInput('gwong2dung1waa2', 'jyutping')).toEqual(['gwong2', 'dung1', 'waa2']);
    expect(normalizeInput('ngo5', 'jyutping')).toEqual(['ngo5']);
    expect(normalizeInput('m4', 'jyutping')).toEqual(['m4']);
    expect(normalizeInput('ng5', 'jyutping')).toEqual(['ng5']);
    expect(normalizeInput('jyut6', 'jyutping')).toEqual(['jyut6']);
    expect(normalizeInput('nei5hou2', 'jyutping')).toEqual(['nei5', 'hou2']);
    expect(normalizeInput('gwongdungwaa', 'jyutping', 3)).toEqual(['gwong', 'dung', 'waa']);
    // jyutping does not turn u: into v
    expect(normalizeInput('ju:5', 'jyutping')).toEqual(['ju5']);
  });
  it('lone digit attaches to previous toneless syllable', () => {
    expect(normalizeInput('zhong 1', 'pinyin')).toEqual(['zhong1']);
    expect(normalizeInput('zhong1 2', 'pinyin')).toEqual(['zhong1']);
    expect(normalizeInput('1', 'pinyin')).toEqual([]);
  });
  it('illegal chunks kept whole; empty input', () => {
    expect(normalizeInput('zhonh1', 'pinyin')).toEqual(['zhonh1']);
    expect(normalizeInput('', 'pinyin')).toEqual([]);
    expect(normalizeInput('  ,, ', 'jyutping')).toEqual([]);
  });
});

describe('checkAnswer', () => {
  const zg = mkItem('中国', 'zhong1 guo2', 'zung1 gwok3');
  const qp = mkQ(zg, 'pinyin');
  const qj = mkQ(zg, 'jyutping');

  it('accepts spaced, unspaced, diacritic input', () => {
    for (const raw of ['zhong1 guo2', 'zhong1guo2', 'ZHONG1GUO2', 'zhōngguó', "zhong1'guo2"]) {
      const r = checkAnswer(raw, qp, 2);
      expect(r.correct, raw).toBe(true);
      expect(r.perfect).toBe(true);
      expect(r.errorTypes).toEqual([]);
    }
  });

  it('level 1 ignores tone but reports it', () => {
    const r = checkAnswer('zhongguo', qp, 1);
    expect(r.correct).toBe(true);
    expect(r.perfect).toBe(false);
    expect(r.syllables.map((s) => s.toneOk)).toEqual([false, false]);
    expect(r.errorTypes).toEqual(['tone']);
    const wrongTone = checkAnswer('zhong4 guo3', qp, 1);
    expect(wrongTone.correct).toBe(true);
  });

  it('level 2 and 3 require tones', () => {
    for (const lvl of [2, 3] as const) {
      expect(checkAnswer('zhongguo', qp, lvl).correct).toBe(false);
      expect(checkAnswer('zhong4 guo2', qp, lvl).correct).toBe(false);
      expect(checkAnswer('zhong1 guo2', qp, lvl).correct).toBe(true);
    }
  });

  it('every level requires all syllables', () => {
    for (const lvl of [1, 2, 3] as const) {
      const r = checkAnswer('zhong1', qp, lvl);
      expect(r.correct).toBe(false);
      expect(r.errorTypes).toContain('missing');
      expect(r.syllables[1]).toEqual({ expected: 'guo2', given: '', initialOk: false, finalOk: false, toneOk: false });
    }
  });

  it('extra syllables are rejected', () => {
    const r = checkAnswer('zhong1 guo2 ren2', qp, 1);
    expect(r.correct).toBe(false);
    expect(r.perfect).toBe(false);
    expect(r.errorTypes).toEqual(['extra']);
    expect(r.syllables).toHaveLength(2);
  });

  it('per-syllable initial / final / tone errors, de-duplicated', () => {
    const r = checkAnswer('zong1 gou3', qp, 3);
    expect(r.syllables[0]).toMatchObject({ expected: 'zhong1', given: 'zong1', initialOk: false, finalOk: true, toneOk: true });
    expect(r.syllables[1]).toMatchObject({ initialOk: true, finalOk: false, toneOk: false });
    expect(r.errorTypes).toEqual(['initial', 'final', 'tone']);
    const r2 = checkAnswer('zong1 kuo2', qp, 3);
    expect(r2.errorTypes).toEqual(['initial']);
  });

  it('pinyin neutral tone: 5 or no digit', () => {
    const q = mkQ(mkItem('的', 'de5', 'dik1'), 'pinyin');
    expect(checkAnswer('de', q, 3).correct).toBe(true);
    expect(checkAnswer('de5', q, 3).correct).toBe(true);
    expect(checkAnswer('de1', q, 3).correct).toBe(true); // neutral tone accepts any typed tone
    const q2 = mkQ(mkItem('东西', 'dong1 xi5', 'dung1 sai1'), 'pinyin');
    expect(checkAnswer('dong1xi', q2, 2).perfect).toBe(true);
  });

  it('ü / v', () => {
    const q = mkQ(mkItem('绿', 'lv4', 'luk6'), 'pinyin');
    for (const raw of ['lv4', 'lü4', 'lu:4', 'lǜ']) expect(checkAnswer(raw, q, 3).correct, raw).toBe(true);
    expect(checkAnswer('lu4', q, 3).correct).toBe(false);
    const qj = mkQ(mkItem('去', 'qu4', 'heoi3'), 'pinyin');
    expect(checkAnswer('qv4', qj, 3).correct).toBe(true);
  });

  it('jyutping: tones required at L2/3, digit missing is a tone error', () => {
    expect(checkAnswer('zung1gwok3', qj, 3).perfect).toBe(true);
    expect(checkAnswer('zung1 gwok', qj, 3).correct).toBe(false);
    expect(checkAnswer('zung gwok', qj, 1).correct).toBe(true);
    const r = checkAnswer('zung1 gok3', qj, 2);
    expect(r.errorTypes).toEqual(['initial']);
  });

  it('jyutping syllables ngo5 / m4 / ng5 / jyut6 / gwong2dung1waa2', () => {
    const cases: [string, string, string][] = [
      ['我', 'wo3', 'ngo5'],
      ['唔', 'wu2', 'm4'],
      ['五', 'wu3', 'ng5'],
      ['粵', 'yue4', 'jyut6'],
    ];
    for (const [t, p, j] of cases) {
      const q = mkQ(mkItem(t, p, j), 'jyutping');
      expect(checkAnswer(j, q, 3).correct, j).toBe(true);
    }
    const gdw = mkQ(mkItem('广东话', 'guang3 dong1 hua4', 'gwong2 dung1 waa2'), 'jyutping');
    expect(checkAnswer('gwong2dung1waa2', gdw, 3).perfect).toBe(true);
    expect(checkAnswer('gwongdungwaa', gdw, 1).correct).toBe(true);
    const wrong = checkAnswer('gong2dung1waa2', gdw, 3);
    expect(wrong.correct).toBe(false);
    expect(wrong.errorTypes).toEqual(['initial']);
  });

  it('accepts alternative readings per syllable', () => {
    const item = mkItem('行', 'xing2', 'hang4', { alts: [{ pinyinAlt: ['hang2'], jyutpingAlt: ['hong4'] }] });
    expect(checkAnswer('xing2', mkQ(item, 'pinyin'), 3).correct).toBe(true);
    expect(checkAnswer('hang2', mkQ(item, 'pinyin'), 3).correct).toBe(true);
    expect(checkAnswer('hong4', mkQ(item, 'jyutping'), 3).correct).toBe(true);
    const r = checkAnswer('hang2', mkQ(item, 'jyutping'), 3);
    expect(r.correct).toBe(false);
    expect(acceptedReadings(mkQ(item, 'jyutping'))).toEqual([['hang4', 'hong4']]);
  });
});

describe('toDiacritic', () => {
  it('standard placement', () => {
    expect(toDiacritic('zhong1 guo2')).toBe('zhōng guó');
    expect(toDiacritic('lv4')).toBe('lǜ');
    expect(toDiacritic('nve4')).toBe('nüè');
    expect(toDiacritic('hao3')).toBe('hǎo');
    expect(toDiacritic('xie4')).toBe('xiè');
    expect(toDiacritic('gou3')).toBe('gǒu');
    expect(toDiacritic('liu2')).toBe('liú');
    expect(toDiacritic('hui4')).toBe('huì');
    expect(toDiacritic('er2')).toBe('ér');
    expect(toDiacritic('de5')).toBe('de');
    expect(toDiacritic('ma')).toBe('ma');
    expect(toDiacritic('lv')).toBe('lü');
    expect(toDiacritic('m2')).toBe('ḿ');
    expect(toDiacritic('  ni3   hao3 ')).toBe('nǐ hǎo');
  });
});
