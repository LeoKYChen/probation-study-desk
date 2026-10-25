#!/usr/bin/env python3
"""Split assets/study-round.woff into two WOFF2 files for faster first loads.

core: every character used in the repository's pages and data, plus ASCII and common punctuation.
rest: every other character in the font; browsers download it only when a page shows one of them.

The original WOFF stays in place because the frozen service workers (sw.js, professional/sw.js)
still list it. Requires fonttools and brotli:  pip install fonttools brotli
Run after adding new text with characters outside the core set, then commit the outputs.
"""
import re
import subprocess
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/study-round.woff"
CSS = ROOT / "assets/study-theme.css"
TEXT_SUFFIXES = (".html", ".js", ".json", ".css", ".md", ".txt")
BASE = (
    set(range(0x20, 0x7F)) | set(range(0xA0, 0x100)) | set(range(0x2000, 0x2070))
    | set(range(0x3000, 0x3040)) | set(range(0xFF00, 0xFFF0))
)
# Subsetting makes a Modified Version under the OFL, which may not use the Reserved Font Names
# 'open huninn' / 'huninn'; copyright (0) and license (13, 14) entries are kept.
FAMILY = "StudyRound Subset"
START, END = "/* font-subsets:start (scripts/build-font-subsets.py) */", "/* font-subsets:end */"


def repository_text() -> set:
    files = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True).stdout
    chars = set()
    for raw in files.split(b"\0"):
        path = raw.decode()
        if path.endswith(TEXT_SUFFIXES):
            try:
                chars |= {ord(c) for c in (ROOT / path).read_text(encoding="utf8")}
            except (UnicodeDecodeError, FileNotFoundError):
                pass
    return chars


def rename(font: TTFont, style: str) -> None:
    for record in list(font["name"].names):
        if record.nameID in (1, 3, 4, 6, 16, 17, 21, 22):
            value = {1: FAMILY, 3: FAMILY + " " + style, 4: FAMILY + " " + style,
                     6: FAMILY.replace(" ", "") + "-" + style, 16: FAMILY, 17: "Regular",
                     21: FAMILY, 22: "Regular"}[record.nameID]
            record.string = value


def build(codepoints: set, out: Path, style: str) -> None:
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    font = subset.load_font(str(SOURCE), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    rename(font, style)
    subset.save_font(font, str(out), options)


def ranges(codepoints: set) -> str:
    items, spans = sorted(codepoints), []
    start = prev = items[0]
    for c in items[1:]:
        if c != prev + 1:
            spans.append((start, prev))
            start = c
        prev = c
    spans.append((start, prev))
    return ",".join(f"U+{a:X}" if a == b else f"U+{a:X}-{b:X}" for a, b in spans)


def main() -> None:
    available = set(TTFont(str(SOURCE)).getBestCmap())
    core = (repository_text() | BASE) & available
    rest = available - core
    build(core, ROOT / "assets/study-round-core.woff2", "Core")
    build(rest, ROOT / "assets/study-round-rest.woff2", "Rest")
    # Both faces need an explicit range: without one, a character missing from the whole font
    # (icons such as ▤ or ✎) would make browsers fetch the rest file just to look for it.
    face = "@font-face{{font-family:StudyRound;src:url('./{}') format('woff2');font-style:normal;font-weight:400;font-display:swap;unicode-range:{}}}"
    faces = START + face.format("study-round-core.woff2", ranges(core)) + face.format("study-round-rest.woff2", ranges(rest)) + END
    css = CSS.read_text(encoding="utf8")
    block = re.compile(re.escape(START) + ".*?" + re.escape(END), re.S)
    if block.search(css):
        css = block.sub(lambda _: faces, css)
    else:
        css, count = re.subn(r"@font-face\{font-family:StudyRound;src:url\('\./study-round\.woff'\)[^}]*\}", lambda _: faces, css)
        if count != 1:
            raise SystemExit("could not find the StudyRound @font-face rule in " + str(CSS))
    CSS.write_text(css, encoding="utf8")
    print(f"core {len(core)} chars, rest {len(rest)} chars")


if __name__ == "__main__":
    main()
