"""Stage 1: download the 13 chapter pages (cached in data/raw/, never re-downloaded)."""
import time
import requests
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))  # noqa: E402 (python -I drops script dir)
from common import RAW, CHAPTERS

BASE = "https://m.gulongbbs.com/wuxia/nikuang/benlong/{}.html"
FIRST_ID = 66161
HEADERS = {"User-Agent": "Mozilla/5.0"}
DELAY = 2.0


def main():
    fetched = 0
    for ch in CHAPTERS:
        out = RAW / f"ch{ch:02d}.html"
        if out.exists() and out.stat().st_size > 1000:
            continue
        if fetched:
            time.sleep(DELAY)
        url = BASE.format(FIRST_ID + ch - 1)
        r = requests.get(url, headers=HEADERS, timeout=30)
        r.raise_for_status()
        out.write_bytes(r.content)  # raw bytes (GBK); decoded in clean.py
        fetched += 1
        print(f"fetched ch{ch:02d} {len(r.content)} bytes")
    print(f"scrape: {fetched} downloaded, {len(CHAPTERS) - fetched} cached")


if __name__ == "__main__":
    main()
