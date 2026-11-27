"""Shared paths and helpers for the 奔龍 data pipeline."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
PIPE = ROOT / "pipeline"
DATA = ROOT / "data"
RAW = DATA / "raw"
WORK = RAW / "work"          # intermediate files (contain full text -> stay in gitignored raw/)
PUBLIC = ROOT / "public" / "data"
CHAPTERS = list(range(1, 14))
SOURCE = "倪匡《奔龍》"

HAN_RE = re.compile(r"^[一-鿿]+$")


def is_han(s: str) -> bool:
    return bool(s) and bool(HAN_RE.match(s))


for d in (RAW, WORK):
    d.mkdir(parents=True, exist_ok=True)
