"""Stage 6: build contract-shaped items -> public/data/{chars,words,phrases}.json.

Reading choice per item = the most common in-context (pinyin, jyutping, trad) tuple across its
occurrences in the novel. Other readings seen in context go to pinyinAlt/jyutpingAlt.
Single-char items additionally list the char's other dictionary readings when polyphonic.
Only items and short context snippets are exported, never the full text: char/word contexts come
from a small pool of <=14-char clause pieces chosen by greedy set cover under CTX_BUDGET.
"""
import json
from collections import Counter
from datetime import datetime, timezone
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))  # noqa: E402
from common import WORK, PUBLIC, SOURCE
from annotate import load_overrides, load_char_alts, norm_py, norm_jp

CTX_MAX = 20
CTX_WINDOW = 14   # max Han chars per char/word context snippet
CTX_MIN = 5       # min Han chars per snippet (shorter clauses give no useful context)
CTX_BUDGET = 0.10  # char/word contexts may expose at most this share of the novel's Han text
MAX_ALT = 4
PREFIX = {"char": "c", "word": "w", "phrase": "p"}


def chunks(clause_text):
    """Split a clause into <=CTX_WINDOW-char pieces (candidate context snippets)."""
    n = len(clause_text)
    if n <= CTX_WINDOW:
        return [(0, n)]
    k = -(-n // CTX_WINDOW)
    size = -(-n // k)
    return [(i, min(n, i + size)) for i in range(0, n, size)]


def pick_contexts(clauses, graded, budget):
    """Greedy set cover: choose a small pool of short clause snippets (total <= budget chars)
    that contains as many char/word items as possible. Returns {(kind, text): (ci, s, e)}.
    Limiting the pool keeps the amount of the novel exposed through contexts small."""
    import heapq
    wanted = {("char", r["text"]) for r in graded["chars"]} | {("word", r["text"]) for r in graded["words"]}
    cand = []
    for ci, cl in enumerate(clauses):
        t = cl["text"]
        for s, e in chunks(t):
            piece = t[s:e]
            if len(piece) < CTX_MIN:
                continue
            items = {("char", c) for c in piece} & wanted
            off = 0
            for w in cl["words"]:
                if off >= s and off + len(w) <= e and len(piece) >= len(w) + 3 and ("word", w) in wanted:
                    items.add(("word", w))
                off += len(w)
            if items:
                cand.append((ci, s, e, items))
    covered, chosen, used = {}, set(), 0
    # items per char, damped so that tiny 3-4 char clauses (no real context) don't win
    heap = [(-len(it) / (e - s + 4), i) for i, (ci, s, e, it) in enumerate(cand)]
    heapq.heapify(heap)
    while heap and used < budget:
        neg, i = heapq.heappop(heap)
        ci, s, e, it = cand[i]
        new = [x for x in it if x not in covered]
        if not new:
            continue
        score = len(new) / (e - s + 4)
        if heap and score < -heap[0][0] - 1e-9:
            heapq.heappush(heap, (-score, i))
            continue
        text = clauses[ci]["text"][s:e]
        if text not in chosen:
            chosen.add(text)
            used += e - s
        for x in new:
            covered[x] = (ci, s, e)
    return covered, used


def render(clauses, sents, ci, s, e):
    """(simplified, traditional) snippet; traditional reuses the clause's corrected trad chars."""
    cl = clauses[ci]
    out, out_t = cl["text"][s:e], cl["trad"][s:e]
    sent = sents[cl["sent"]]["text"]
    nxt = cl["start"] + e
    if e == len(cl["text"]) and nxt < len(sent) and sent[nxt] in "。！？…，；" and len(out) < CTX_MAX:
        out += sent[nxt]
        out_t += sent[nxt]
    return out, out_t


def main():
    d = json.loads((WORK / "annotated.json").read_text(encoding="utf-8"))
    g = json.loads((WORK / "graded.json").read_text(encoding="utf-8"))
    word_ov, char_ov = load_overrides()
    char_alts = load_char_alts()
    clauses, sents, cdict = d["clauses"], d["sentences"], d["chardict"]
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    dropped = []
    novel_han = sum(len(cl["text"]) for cl in clauses)
    ctx_map, ctx_used = pick_contexts(clauses, g, int(novel_han * CTX_BUDGET))
    stats = {}

    def polyphonic(c):
        cd = cdict[c]
        return len(cd["py"]) > 1 or len(cd["jp"]) > 1

    def build(kind, rec):
        text = rec["text"]
        n = len(text)
        readings = Counter()
        for ci, off in rec["occ"]:
            cl = clauses[ci]
            readings[(tuple(cl["py"][off:off + n]), tuple(cl["jp"][off:off + n]),
                      cl["trad"][off:off + n])] += 1
        ranked = [r for r, _ in readings.most_common()]
        py, jp, trad = ranked[0]
        py, jp = list(py), list(jp)
        alt_py = [Counter() for _ in range(n)]
        alt_jp = [Counter() for _ in range(n)]
        for (p2, j2, _), cnt in readings.items():
            for i in range(n):
                alt_py[i][p2[i]] += cnt
                alt_jp[i][j2[i]] += cnt

        if kind == "char":
            c = text
            tot = sum(alt_py[0].values())
            # prefer a full-tone reading for a standalone char when it is reasonably common
            if py[0] and py[0].endswith("5"):
                for p, cnt in alt_py[0].most_common():
                    if p and not p.endswith("5") and cnt >= 0.1 * tot:
                        py[0] = p
                        break
            jp[0] = max(alt_jp[0], key=alt_jp[0].get)
            trad = max(cdict[c]["trads"], key=cdict[c]["trads"].get)
            ov = char_ov.get(c) or {}
            if ov.get("pinyin"):
                py[0] = norm_py(str(ov["pinyin"]))
            if ov.get("jyutping"):
                jp[0] = norm_jp(str(ov["jyutping"]))
            if polyphonic(c):
                for p in cdict[c]["py"]:
                    alt_py[0][p] += 0
                for j in cdict[c]["jp"]:
                    alt_jp[0][j] += 0
            for p in ov.get("pinyinAlt") or []:
                alt_py[0][norm_py(str(p))] += 0
            for j in ov.get("jyutpingAlt") or []:
                alt_jp[0][norm_jp(str(j))] += 0

        # 一/不: export the citation tone; tone-sandhi forms from pypinyin become alternates
        for i, c in enumerate(text):
            cit = {"一": "yi1", "不": "bu4"}.get(c)
            if cit and py[i] != cit:
                alt_py[i][py[i]] += 0
                py[i] = cit

        # alternates declared on word overrides (pinyinAlt / jyutpingAlt)
        for k, ov in word_ov.items():
            if not (ov.get("pinyinAlt") or ov.get("jyutpingAlt")):
                continue
            start = text.find(k)
            while start >= 0:
                for field, alts in (("pinyinAlt", alt_py), ("jyutpingAlt", alt_jp)):
                    if ov.get(field):
                        norm = norm_py if field == "pinyinAlt" else norm_jp
                        for j, v in enumerate(str(ov[field]).split()):
                            if v != "_" and norm(v):
                                alts[start + j][norm(v)] += 0
                start = text.find(k, start + 1)

        for i, c in enumerate(text):
            ca = char_alts.get(c) or {}
            for p in ca.get("pinyin") or []:
                alt_py[i][norm_py(str(p))] += 0
            for j in ca.get("jyutping") or []:
                alt_jp[i][norm_jp(str(j))] += 0

        if any(x is None for x in py) or any(x is None for x in jp) or len(trad) != n:
            why = [f for f, bad in (("pinyin", any(x is None for x in py)),
                                    ("jyutping", any(x is None for x in jp)),
                                    ("trad", len(trad) != n)) if bad]
            dropped.append((kind, text, "+".join(why)))
            return None

        syls = []
        for i, c in enumerate(text):
            s = {"hanzi": c, "hanziTrad": trad[i], "pinyin": py[i], "jyutping": jp[i],
                 "polyphonic": polyphonic(c)}
            pa = [p for p in alt_py[i] if p and p != py[i]][:MAX_ALT]
            ja = [j for j in alt_jp[i] if j and j != jp[i]][:MAX_ALT]
            if pa:
                s["pinyinAlt"] = pa
            if ja:
                s["jyutpingAlt"] = ja
            syls.append(s)

        item = {"kind": kind, "text": text, "textTrad": trad, "syllables": syls,
                "level": rec["level"], "freq": rec["freq"], "chapter": rec["chapter"]}
        if kind == "phrase":
            ci, off = rec["occ"][0]
            ctx = render(clauses, sents, ci, 0, len(clauses[ci]["text"]))
        elif (kind, text) in ctx_map:
            ctx = render(clauses, sents, *ctx_map[(kind, text)])
        else:
            ctx = None  # outside the context budget (mostly single-occurrence words)
        if ctx:
            item["context"], item["contextTrad"] = ctx
        return item

    PUBLIC.mkdir(parents=True, exist_ok=True)
    for kind, key, fname in (("char", "chars", "chars.json"), ("word", "words", "words.json"),
                             ("phrase", "phrases", "phrases.json")):
        items = []
        for rec in g[key]:
            it = build(kind, rec)
            if it is None:
                continue
            it = {"id": f"{PREFIX[kind]}-{len(items) + 1:06d}", **it}
            items.append(it)
        data = {"version": 1, "source": SOURCE, "generatedAt": now, "items": items}
        (PUBLIC / fname).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")),
                                    encoding="utf-8")
        stats[fname] = len(items)
    (WORK / "dropped.json").write_text(json.dumps(dropped, ensure_ascii=False), encoding="utf-8")
    print(f"export: {stats}, dropped {len(dropped)}; context pool {ctx_used} Han chars "
          f"({ctx_used / novel_han:.1%} of novel), covering {len(ctx_map)} char/word items")


if __name__ == "__main__":
    main()
