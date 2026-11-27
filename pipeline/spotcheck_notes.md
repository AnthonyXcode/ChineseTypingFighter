## Spot-check notes (manual review)

Reviewed: the 50-item sample above, a second random sample (seed 7: 40 words, 40 phrases, 25
chars), and every in-context reading of the common polyphones 长 行 了 得 重 还 和 看 着 为 都 地 的
中 好 只 处 倒 干 发 相 应 少 似 弹 喝 劲 将 正 背 便 难 落 血 觉 曾 率 参. The final 50-item sample
above has no errors left. Errors found and fixed:

**Fixed with context rules in `annotate.py`** (systematic, so not listed one by one in overrides.yaml):
- 地 as an adverbial particle (冷冷地, 陡地, 喃喃地, 地 tagged `uv`) came out di4 → de5 (~200 occurrences).
- 得 as a complement particle (变得, 震得, 离得, 看得出, standalone 得 tagged `ud`) came out de2 → de5 (~300).
- 长 in 长白飞尸 / 长魔 / 长刀 / 又瘦又长 came out zhang3 → pinyin now follows ToJyutping (coeng4 = chang2, zoeng2 = zhang3).
- 中 meaning "hit" (中了两掌, 中了箭) → zhong4, using ToJyutping's zung3.
- 为 wei4/wei2: pinyin follows ToJyutping (wai4 = wei2 as in 以为 大为 略为; wai6 = wei4).
- 处 cyu5 for the noun "place" (深处, 角落处) → cyu3, using pypinyin's chu4/chu3.
- 倒 dou2/dou3 follows pypinyin (adverb 倒是 / 反倒 = dao4 dou3; fall 跌倒 = dao3 dou2).
- 只/干/发 readings follow OpenCC's context-aware traditional form (隻 zhi1 zek3, 只 zhi3 zi2; 乾 gan1 gon1, 幹 gan4 gon3; 髮 fa4, 發 fa1).
- 似 → si4 except right before 的/地 (shi4).
- 一 and 不 keep their dictionary tones (yi1, bu4). pypinyin's tone-change forms (一个 yi2, 不是 bu2) go into pinyinAlt.

**Fixed in `overrides.yaml`**: see the file (60 word entries, 4 char entries, 2 charAlts, 1 skip),
e.g. 姑娘 niang5, 一重 chong2, 重重地 zhong4, 率着 shuai4, 一行/同行/车行 xing2 hang4, 几行 hang2,
弹 tan2 taan4 (flick), 劲装 jing4, 刺中/射中/中镖 zhong4, 林中/途中 zhong1, 劈成 pi1, 应道 ying4 jing3,
重伤 zung6 (alt cung5), 不禁 gam1, 店小二 ji6 (alt ji2), 数一数二 sou2, 面面相觑 soeng1, 糊 wu4;
traditional forms 干的→幹, 干笑/干得→乾, 发颤/发亮→發, 长发抖散→髮, 剧斗→鬥, 这只要→只.
The source typo 自已 is skipped.

**Known remaining limitations**
- ToJyutping sometimes picks colloquial changed tones (和尚 wo4 soeng2, 还是 waan4, 一下 haa5, 声 seng1 in
  出声). These are valid Cantonese but may differ from textbook readings. Single-char items list the
  other readings in jyutpingAlt; words generally do not.
- pypinyin gives the dictionary neutral tone where one exists (东西 xi5, 汉子 zi5, 虎子 zi5). The game should
  probably accept tone 5 or the full tone for any syllable whose pinyin ends in 5.
- 晃 huang3/huang4, 倒 (standalone), 干 (standalone) and 长 in 长得 still depend on context that the
  libraries guess. Most are covered by the *Alt lists on char items.
- `polyphonic` counts a reading only if it appears in at least 2 pypinyin phrase entries or at least
  2 times in the novel. The unfiltered rule ("more than 1 dictionary reading") flagged 71% of chars
  because both libraries list archaic variants such as 他 tuo2 and 花 faa3. With the filter, 278 of
  the 1,500 chars are flagged.
- Contexts: char/word snippets come from a pool of ≤14-char clause pieces limited to 10% of the novel
  (`CTX_BUDGET` in export.py), chosen to cover as many items as possible. About 85% of chars and 56%
  of words have a context; the rest (mostly words seen only once) have none. With all snippets
  combined, about 15% of the novel's text appears somewhere in public/data (it was 55% before the cap).
