"""Stage 2: extract body text from cached HTML -> data/raw/work/chNN.txt (one paragraph per line)."""
import html
import re
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))  # noqa: E402
from common import RAW, WORK, CHAPTERS

BOILER = ("作者:", "作者：", "来源:", "来源：", "点击:", "点击：", "下一个文章", "上一个文章",
          "Copyright", "古龙武侠网", "更新时间")


def extract(raw: str) -> str:
    i = raw.find('id="div_content"')
    if i < 0:
        raise ValueError("div_content not found")
    j = raw.find("<!--content-->", i)
    body = raw[i:j if j > 0 else len(raw)]
    body = re.sub(r"(?is)<script.*?</script>", "", body)
    body = re.sub(r"(?is)<style.*?</style>", "", body)
    body = re.sub(r"(?i)<br\s*/?>|</p>|<p[^>]*>", "\n", body)
    body = re.sub(r"(?s)<[^>]+>", "", body)
    body = body.replace("&nbsp;", " ")
    body = html.unescape(body)
    body = body.replace('id="div_content" class="articleContent">', "")
    lines = []
    for line in body.splitlines():
        line = line.strip().strip("　 \t")
        if not line or set(line) <= set("×　 "):
            continue
        if any(b in line for b in BOILER):
            continue
        lines.append(line)
    return "\n".join(lines)


def main():
    total = 0
    for ch in CHAPTERS:
        raw = (RAW / f"ch{ch:02d}.html").read_bytes().decode("gbk", errors="ignore")
        text = extract(raw)
        (WORK / f"ch{ch:02d}.txt").write_text(text, encoding="utf-8")
        n = len(re.findall(r"[一-鿿]", text))
        total += n
        print(f"ch{ch:02d}: {n} Han chars")
    print(f"clean: total {total} Han chars")


if __name__ == "__main__":
    main()
