"""Stage 5: count occurrences, pick items and assign levels -> data/raw/work/graded.json.

Commonness proxy = jieba's bundled dictionary frequency (offline, modern-corpus based).
chars : top ~1,500 chars by novel frequency; level 1 = frequent in novel AND common in jieba,
        level 2 = moderately common, level 3 = rare.
words : jieba tokens of 2-4 Han chars that exist in jieba's dictionary (or our name userdict);
        2 chars -> level 2, 3-4 chars -> level 3. Names capped. ~3,000.
phrases: clauses of 5-8 Han chars, ranked by the rarity of their rarest char. ~500, level 3.
"""
import json
import math
from collections import Counter
import jieba
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))  # noqa: E402
from common import WORK, PIPE

N_CHARS, N_WORDS, N_PHRASES = 1500, 3000, 500
LEVEL1_CHARS = 500
MAX_NAMES_WORDS = 40          # proper-name words allowed in words.json
MAX_NAME_PHRASES = 60         # phrases containing a character name
NUMERALS = set("零一二三四五六七八九十百千万两几")
NAME_TAGS = {"nr", "nrfg", "nrt"}


def load_userdict_names():
    names = set()
    p = PIPE / "userdict.txt"
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            parts = line.split()
            if len(parts) >= 3 and parts[2] in NAME_TAGS | {"ns"}:
                names.add(parts[0])
    return names


def main():
    d = json.loads((WORK / "annotated.json").read_text(encoding="utf-8"))
    jieba.setLogLevel(60)
    jieba.dt.initialize()
    F = jieba.dt.FREQ
    names = load_userdict_names()
    import yaml
    ov = yaml.safe_load((PIPE / "overrides.yaml").read_text(encoding="utf-8")) or {}
    skip = set(ov.get("skip") or [])
    pos = d["pos"]

    # jieba char-commonness rank (1 = most common)
    singles = sorted((v, k) for k, v in F.items() if len(k) == 1 and v > 0)
    crank = {k: i + 1 for i, (v, k) in enumerate(reversed(singles))}

    occ = {"char": {}, "word": {}, "phrase": {}}

    def add(kind, key, ch, ci, off):
        o = occ[kind].get(key)
        if o is None:
            occ[kind][key] = {"freq": 1, "chapter": ch, "occ": [[ci, off]]}
        else:
            o["freq"] += 1
            if len(o["occ"]) < 50:
                o["occ"].append([ci, off])

    for ci, cl in enumerate(d["clauses"]):
        text, ch = cl["text"], cl["ch"]
        for i, c in enumerate(text):
            add("char", c, ch, ci, i)
        off = 0
        for w in cl["words"]:
            if 2 <= len(w) <= 4:
                add("word", w, ch, ci, off)
            off += len(w)
        # phrases: skip clauses that start with a particle left over from onomatopoeia
        # ("…”地一声") or end with a speech tag 道 ("…他道：")
        if 5 <= len(text) <= 8 and text[0] not in "地的得着了道" and cl["words"][-1] != "道":
            add("phrase", text, ch, ci, 0)

    # ---- chars
    cands = sorted(occ["char"], key=lambda c: (-occ["char"][c]["freq"], crank.get(c, 99999)))
    chosen = cands[:N_CHARS]
    chars = []
    n1 = 0
    for c in chosen:
        o = occ["char"][c]
        r = crank.get(c, 99999)
        if n1 < LEVEL1_CHARS and r <= 1200 and o["freq"] >= 8:
            lvl = 1
            n1 += 1
        elif r <= 1500 or (r <= 3000 and o["freq"] >= 3):
            lvl = 2
        else:
            lvl = 3
        chars.append({"text": c, "level": lvl, **o})

    # ---- words
    def is_name(w):
        return w in names or pos.get(w) in NAME_TAGS

    def word_ok(w, o):
        if set(w) <= NUMERALS or w in skip:
            return False
        if is_name(w):
            return o["freq"] >= 3
        return F.get(w, 0) > 0

    wc = [w for w, o in occ["word"].items() if word_ok(w, o)]
    wc.sort(key=lambda w: (-occ["word"][w]["freq"], -F.get(w, 0)))
    words, nn = [], 0
    for w in wc:
        if len(words) >= N_WORDS:
            break
        if is_name(w):
            if nn >= MAX_NAMES_WORDS:
                continue
            nn += 1
        o = occ["word"][w]
        words.append({"text": w, "level": 2 if len(w) == 2 else 3, "name": is_name(w), **o})

    # ---- phrases
    def worst(t):
        return max(crank.get(c, 99999) for c in t)

    def has_name(t):
        return any(n in t for n in names)

    pc = list(occ["phrase"])
    pc.sort(key=lambda t: (worst(t), -occ["phrase"][t]["freq"], t))
    phrases, npn = [], 0
    for t in pc:
        if len(phrases) >= N_PHRASES:
            break
        if has_name(t):
            if npn >= MAX_NAME_PHRASES:
                continue
            npn += 1
        phrases.append({"text": t, "level": 3, **occ["phrase"][t]})

    out = {"chars": chars, "words": words, "phrases": phrases,
           "char_candidates": len(occ["char"]), "word_candidates": len(occ["word"]),
           "phrase_candidates": len(occ["phrase"])}
    (WORK / "graded.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    lv = lambda xs: dict(sorted(Counter(x["level"] for x in xs).items()))
    print(f"grade: chars {len(chars)} {lv(chars)} / words {len(words)} {lv(words)} (names {nn}) / "
          f"phrases {len(phrases)} (with names {npn})")


if __name__ == "__main__":
    main()
