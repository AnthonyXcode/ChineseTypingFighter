"""Stage 4: annotate every clause with traditional chars, pinyin and jyutping (in context).

- pinyin: pypinyin on the jieba-segmented clause (phrase-aware), TONE3, neutral tone = 5, ü = v.
- jyutping: ToJyutping on the traditional clause (its own longest-match word lexicon gives context).
- traditional: OpenCC s2hk on the whole clause (sentence-level context resolves 发/干/后 etc.).
- pipeline/overrides.yaml `words:` entries are applied on top (longest match first).
Also records each char's dictionary readings (for `polyphonic` and *Alt lists).
Output: data/raw/work/annotated.json
"""
import json
import re
from collections import Counter
import yaml
from opencc import OpenCC
from pypinyin import lazy_pinyin, pinyin, Style
import ToJyutping
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))  # noqa: E402
from common import WORK, PIPE

PY_RE = re.compile(r"^[a-z]+[1-5]$")
JP_RE = re.compile(r"^[a-z]+[1-6]$")
cc = OpenCC("s2hk")


def load_overrides():
    p = PIPE / "overrides.yaml"
    d = yaml.safe_load(p.read_text(encoding="utf-8")) if p.exists() else {}
    d = d or {}
    return d.get("words") or {}, d.get("chars") or {}


def load_char_alts():
    p = PIPE / "overrides.yaml"
    d = yaml.safe_load(p.read_text(encoding="utf-8")) if p.exists() else {}
    return (d or {}).get("charAlts") or {}


def norm_py(s):
    if s is None:
        return None
    s = s.lower().replace("ü", "v").replace("u:", "v")
    return s if PY_RE.match(s) else None


def norm_jp(s):
    if s is None:
        return None
    s = s.lower()
    return s if JP_RE.match(s) else None


def to_trad(text):
    t = cc.convert(text)
    if len(t) == len(text):
        return t
    # fallback: char by char (should be rare; s2hk is 1:1 for Han chars)
    out = []
    for ch in text:
        c = cc.convert(ch)
        out.append(c if len(c) == 1 else ch)
    return "".join(out)


# ---- context rules (applied before overrides.yaml). Each fixes a systematic library error by
# cross-checking one annotator against another that handles that char better.
TRAD_RULES = {  # simplified char -> {trad form chosen by OpenCC in context: (pinyin, jyutping)}
    "只": {"隻": ("zhi1", "zek3"), "只": ("zhi3", "zi2")},
    "干": {"乾": ("gan1", "gon1"), "幹": ("gan4", "gon3"), "干": ("gan1", "gon1")},
    "发": {"髮": ("fa4", "faat3"), "發": ("fa1", "faat3")},
}
JP_TO_PY = {  # ToJyutping's choice decides pinyin (ToJyutping's lexicon is better for these)
    "长": {"coeng4": "chang2", "zoeng2": "zhang3"},
    "中": {"zung3": "zhong4", "zung1": "zhong1"},
    "为": {"wai4": "wei2", "wai6": "wei4"},
}
PY_TO_JP = {  # pypinyin's choice decides jyutping
    "处": {"chu4": "cyu3", "chu3": "cyu5"},
    "倒": {"dao4": "dou3", "dao3": "dou2"},
}
DI_NOUNS = {"地上", "地道", "地方", "地位", "地步", "地下", "地面", "地带", "地头", "地势", "地图",
            "地狱", "地底", "地板", "地洞", "地域", "地形", "地球", "地区", "地主", "地点", "地穴"}
DI_ADV = {"陡地", "旋地", "突地", "霍地", "倏地", "猛地", "似地", "蓦地", "忽地", "骤地"}
DE2_WORDS = {"只得", "不得", "难得", "获得", "取得", "所得", "值得", "挣得", "乐得", "赢得", "博得",
             "心得", "自得", "求得", "应得", "总得", "懂得", "晓得", "免得", "舍得", "记得", "觉得",
             "认得", "使得", "显得", "来得", "值得", "省得", "落得", "怪不得", "恨不得", "巴不得",
             "说不得", "顾不得", "舍不得", "不得不", "不得要领", "不得好死", "浪得虚名"}


def apply_rules(cl, trad, py, jp):
    off = 0
    for w, tag in zip(cl["words"], cl["tags"]):
        for i, c in enumerate(w):
            p = off + i
            if c in TRAD_RULES and trad[p] in TRAD_RULES[c]:
                py[p], jp[p] = TRAD_RULES[c][trad[p]]
            elif c in JP_TO_PY and jp[p] in JP_TO_PY[c]:
                py[p] = JP_TO_PY[c][jp[p]]
            elif c in PY_TO_JP and py[p] in PY_TO_JP[c]:
                jp[p] = PY_TO_JP[c][py[p]]
            elif c == "似":
                # shi4 only in 似的/似地 ("as if"); otherwise si4 (似乎, 碧也似绿, 如鬼似魅)
                nxt = cl["text"][p + 1] if p + 1 < len(cl["text"]) else ""
                py[p] = "shi4" if nxt in "的地" else "si4"
            elif c == "地":
                # structural particle 地 (de5): tagged uv, adverb-forming suffix (冷冷地, 陡地),
                # or glued by jieba to the following verb (地将, 地向 ...)
                if (w == "地" and tag == "uv") or (len(w) > 1 and i == len(w) - 1 and (
                        w in DI_ADV or (len(w) >= 3 and (tag != "i" or w[-2] == w[-3])) or tag in ("z", "d"))) \
                        or (i == 0 and len(w) > 1 and w not in DI_NOUNS and tag != "s"):
                    py[p] = "de5"
            elif c == "得":
                # complement particle 得 (de5) after a verb/adjective; 得到/得罪... keep de2
                if w == "得" and tag == "ud":
                    py[p] = "de5"
                elif i > 0 and w not in DE2_WORDS and w[i - 1] not in "不只难获取所值挣乐赢博心自求应总" \
                        and py[p] == "de2":
                    py[p] = "de5"
        off += len(w)


def clause_pinyin(words):
    out = []
    for w in words:
        py = lazy_pinyin(w, style=Style.TONE3, neutral_tone_with_five=True, v_to_u=False,
                         errors=lambda s: [None] * len(s))
        if len(py) != len(w):
            py = [None] * len(w)
        out.extend(norm_py(x) for x in py)
    return out


def clause_jyutping(trad):
    res = ToJyutping.get_jyutping_list(trad)
    if len(res) != len(trad):
        res = [(c, ToJyutping.get_jyutping(c)) for c in trad]
    out = []
    for _, jp in res:
        # multi-syllable entries can't happen per char, but guard anyway
        if jp and " " in jp:
            jp = None
        out.append(norm_jp(jp))
    return out


def apply_overrides(text, trad, py, jp, word_ov, keys):
    """Apply overrides.yaml `words:` entries in place (longest key first). Returns new trad."""
    trad = list(trad)
    i = 0
    n = len(text)
    while i < n:
        for k in keys:
            if text.startswith(k, i):
                ov = word_ov[k]
                for field, arr, norm in (("pinyin", py, norm_py), ("jyutping", jp, norm_jp)):
                    if field in ov and ov[field]:
                        vals = str(ov[field]).split()
                        if len(vals) != len(k):
                            raise ValueError(f"override {k}.{field} length mismatch")
                        for j, v in enumerate(vals):
                            if v != "_":
                                arr[i + j] = norm(v)
                if ov.get("trad"):
                    t = str(ov["trad"])
                    if len(t) != len(k):
                        raise ValueError(f"override {k}.trad length mismatch")
                    for j, v in enumerate(t):
                        if v != "_":
                            trad[i + j] = v
                            c = text[i + j]
                            # keep readings consistent with the corrected traditional form
                            if c in TRAD_RULES and v in TRAD_RULES[c]:
                                tp, tj = TRAD_RULES[c][v]
                                if not ov.get("pinyin"):
                                    py[i + j] = tp
                                if not ov.get("jyutping"):
                                    jp[i + j] = tj
                i += len(k)
                break
        else:
            i += 1
    return "".join(trad)


_PHRASE_READINGS = None


def phrase_readings():
    """char -> Counter(pinyin) over pypinyin's phrase dictionary (how often each reading is used)."""
    global _PHRASE_READINGS
    if _PHRASE_READINGS is None:
        from collections import defaultdict, Counter
        from pypinyin.constants import PHRASES_DICT
        from pypinyin.contrib.tone_convert import to_tone3
        cnt = defaultdict(Counter)
        for ph, pys in PHRASES_DICT.items():
            for c, p in zip(ph, pys):
                cnt[c][to_tone3(p[0], neutral_tone_with_five=True)] += 1
        _PHRASE_READINGS = cnt
    return _PHRASE_READINGS


def char_dict(ch, trad, seen_py, seen_jp):
    """Dictionary readings of a char, filtered to readings that are actually in use.

    The raw pypinyin heteronym list and ToJyutping candidate list include archaic/variant readings
    (他 tuo2, 但 tan3, 花 faa3 ...), which would flag ~70% of chars as polyphonic. A reading counts
    when it is used in >=2 pypinyin phrase entries or seen >=2 times in the novel (in context).
    """
    raw_py = pinyin(ch, style=Style.TONE3, heteronym=True, neutral_tone_with_five=True, v_to_u=False)[0]
    raw_py = list(dict.fromkeys(p for p in (norm_py(x) for x in raw_py) if p))
    raw_jp = []
    cands = ToJyutping.get_jyutping_candidates(trad)
    if cands and cands[0][1]:
        raw_jp = list(dict.fromkeys(j for j in (norm_jp(x) for x in cands[0][1]) if j))
    pr = phrase_readings()[ch]
    py = [p for p in raw_py if pr[p] >= 2 or seen_py[p] >= 2]
    py += [p for p, n in seen_py.most_common() if n >= 2 and p not in py]
    jp = [j for j, n in seen_jp.most_common() if n >= 2]
    if not py:
        py = raw_py[:1] or [p for p, _ in seen_py.most_common(1)]
    if not jp:
        jp = raw_jp[:1] or [j for j, _ in seen_jp.most_common(1)]
    return {"py": py, "jp": jp, "py_all": raw_py, "jp_all": raw_jp}


def main():
    seg = json.loads((WORK / "segments.json").read_text(encoding="utf-8"))
    word_ov, _ = load_overrides()
    keys = sorted(word_ov, key=len, reverse=True)
    chars = {}
    for cl in seg["clauses"]:
        text = cl["text"]
        trad = to_trad(text)
        py = clause_pinyin(cl["words"])
        jp = clause_jyutping(trad)
        apply_rules(cl, trad, py, jp)
        trad = apply_overrides(text, trad, py, jp, word_ov, keys)
        cl["trad"], cl["py"], cl["jp"] = trad, py, jp
        for c, t, p, j in zip(text, trad, py, jp):
            e = chars.setdefault(c, {"trads": Counter(), "py": Counter(), "jp": Counter()})
            e["trads"][t] += 1
            e["py"][p] += 1
            e["jp"][j] += 1
    cdict = {}
    for c, e in chars.items():
        t = e["trads"].most_common(1)[0][0]
        d = char_dict(c, t, e["py"], e["jp"])
        d["trads"] = dict(e["trads"])
        cdict[c] = d
    seg["chardict"] = cdict
    (WORK / "annotated.json").write_text(json.dumps(seg, ensure_ascii=False), encoding="utf-8")
    miss_py = sum(x is None for cl in seg["clauses"] for x in cl["py"])
    miss_jp = sum(x is None for cl in seg["clauses"] for x in cl["jp"])
    print(f"annotate: {len(seg['clauses'])} clauses, {len(cdict)} distinct chars, "
          f"missing pinyin {miss_py}, missing jyutping {miss_jp}, {len(word_ov)} word overrides")


if __name__ == "__main__":
    main()
