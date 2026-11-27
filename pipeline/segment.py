"""Stage 3: sentence/clause split + jieba word segmentation -> data/raw/work/segments.json.

Output (stays under data/raw/ because it contains the full text):
  {"sentences": [{"ch": 1, "text": "..."}],
   "clauses":   [{"ch": 1, "sent": 0, "start": 5, "text": "天色阴霾得可怕", "words": ["天色", ...]}]}
A clause is a maximal run of Han characters inside a sentence (split at any punctuation / non-Han).
"""
import json
import re
import jieba
import jieba.posseg as pseg
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))  # noqa: E402
from common import WORK, PIPE, CHAPTERS

SENT_RE = re.compile(r"[^。！？…\n]+[。！？…」”’]*")
HAN_RUN = re.compile(r"[一-鿿]+")


def main():
    jieba.setLogLevel(60)
    ud = PIPE / "userdict.txt"
    if ud.exists():
        jieba.load_userdict(str(ud))
    sentences, clauses, postags = [], [], {}
    for ch in CHAPTERS:
        text = (WORK / f"ch{ch:02d}.txt").read_text(encoding="utf-8")
        for para in text.splitlines():
            for m in SENT_RE.finditer(para):
                s = m.group(0).strip()
                if not s:
                    continue
                si = len(sentences)
                sentences.append({"ch": ch, "text": s})
                for r in HAN_RUN.finditer(s):
                    words, tags = [], []
                    for w, flag in pseg.lcut(r.group(0)):
                        words.append(w)
                        tags.append(flag)
                        postags.setdefault(w, {}).setdefault(flag, 0)
                        postags[w][flag] += 1
                    clauses.append({"ch": ch, "sent": si, "start": r.start(),
                                    "text": r.group(0), "words": words, "tags": tags})
    # dominant POS tag per word (used to spot proper names / numerals in grade.py)
    pos = {w: max(d, key=d.get) for w, d in postags.items()}
    (WORK / "segments.json").write_text(json.dumps(
        {"sentences": sentences, "clauses": clauses, "pos": pos}, ensure_ascii=False), encoding="utf-8")
    print(f"segment: {len(sentences)} sentences, {len(clauses)} clauses, {len(pos)} distinct tokens")


if __name__ == "__main__":
    main()
