"""Validate public/data/{chars,words,phrases}.json against the contract in src/types/data.ts."""
import json
import re
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))  # noqa: E402
from common import PUBLIC

PY = re.compile(r"^[a-z]+[1-5]$")
JP = re.compile(r"^[a-z]+[1-6]$")
HAN = re.compile(r"^[一-鿿]+$")
ID = {"char": re.compile(r"^c-\d{6}$"), "word": re.compile(r"^w-\d{6}$"), "phrase": re.compile(r"^p-\d{6}$")}
ITEM_KEYS = {"id", "kind", "text", "textTrad", "syllables", "level", "freq", "chapter", "context", "contextTrad"}
SYL_KEYS = {"hanzi", "hanziTrad", "pinyin", "jyutping", "polyphonic", "pinyinAlt", "jyutpingAlt"}


def check_file(fname, kind):
    errs = []
    d = json.loads((PUBLIC / fname).read_text(encoding="utf-8"))
    assert d.get("version") == 1, f"{fname}: version"
    assert isinstance(d.get("source"), str) and d["source"], f"{fname}: source"
    assert isinstance(d.get("generatedAt"), str), f"{fname}: generatedAt"
    ids = set()
    for it in d["items"]:
        e = lambda m: errs.append(f"{fname} {it.get('id')} {it.get('text')}: {m}")
        if set(it) - ITEM_KEYS:
            e(f"unknown keys {set(it) - ITEM_KEYS}")
        if it["kind"] != kind or not ID[kind].match(it["id"]):
            e("kind/id")
        if it["id"] in ids:
            e("duplicate id")
        ids.add(it["id"])
        t, tt, syl = it["text"], it["textTrad"], it["syllables"]
        if not HAN.match(t) or not HAN.match(tt):
            e("non-Han text")
        if not (len(syl) == len(t) == len(tt)):
            e("length mismatch")
        if kind == "char" and len(t) != 1:
            e("char len")
        if kind == "word" and not 2 <= len(t) <= 4:
            e("word len")
        if kind == "phrase" and not 5 <= len(t) <= 8:
            e("phrase len")
        if it["level"] not in (1, 2, 3):
            e("level")
        if not (isinstance(it["chapter"], int) and 1 <= it["chapter"] <= 13):
            e("chapter")
        if not (isinstance(it["freq"], int) and it["freq"] >= 1):
            e("freq")
        if "context" in it:
            if len(it["context"]) > 20 or t not in it["context"]:
                e(f"context {it['context']!r}")
            if len(it.get("contextTrad", "")) != len(it["context"]):
                e("contextTrad")
        for i, s in enumerate(syl):
            if set(s) - SYL_KEYS:
                e(f"syllable keys {set(s) - SYL_KEYS}")
            if i < len(t) and (s["hanzi"] != t[i] or s["hanziTrad"] != tt[i]):
                e(f"syllable {i} hanzi")
            if not PY.match(s["pinyin"]) or not JP.match(s["jyutping"]):
                e(f"syllable {i} reading {s['pinyin']} {s['jyutping']}")
            if not isinstance(s["polyphonic"], bool):
                e("polyphonic")
            for a in s.get("pinyinAlt", []):
                if not PY.match(a) or a == s["pinyin"]:
                    e(f"pinyinAlt {a}")
            for a in s.get("jyutpingAlt", []):
                if not JP.match(a) or a == s["jyutping"]:
                    e(f"jyutpingAlt {a}")
    return len(d["items"]), errs


def main():
    total_errs = []
    for fname, kind in (("chars.json", "char"), ("words.json", "word"), ("phrases.json", "phrase")):
        n, errs = check_file(fname, kind)
        print(f"{fname}: {n} items, {len(errs)} errors")
        total_errs += errs
    for x in total_errs[:30]:
        print("  ", x)
    if total_errs:
        sys.exit(1)
    print("validate: OK")


if __name__ == "__main__":
    main()
