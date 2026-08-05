"""Compose per-hero social cards (1200x630) from committed assets.

THE CARD IS THE MARQUEE (ADR-0067): each hero's share card renders the
directory's poster grammar at og:image size — the radial-glow dark ground,
the B&W headshot cutout grounded bottom-right, the meta eyebrow over the
display-face name over the verdict cue, the wordmark as the site signature.
No new art direction per hero: every input is an asset the repo already
commits (headshot, wordmark) or copy the registry already carries.

FONTS come from the pinned @fontsource packages (ADR-0020) — the exact
webfont files the site ships, not a re-downloaded cousin that could drift.
@fontsource ships WOFF v1 beside WOFF2, and WOFF v1 is a zlib-wrapped SFNT,
so the stdlib unpacks it into the TTF form PIL reads; no new dependency.

Driven by scripts/generate-social-cards.ts (the registry lives in
TypeScript); specs arrive as JSON on stdin:
  [{"slug": ..., "playerName": ..., "meta": ..., "headshotPath": ...}]
Cards land at public/social-cards/<slug>.png, committed like every deployed
asset, so the build's HTML emission step can rely on them.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image

from card_common import (
    DISPLAY_900,
    INK,
    SANS_500,
    WORDMARK,
    draw_tracked,
    load_font,
    monochrome,
    radial_ground,
    read_specs,
)

CARD_W, CARD_H = 1200, 630
OUT_DIR = Path("public/social-cards")


def compose(spec: dict, display_woff: Path, sans_woff: Path) -> Image.Image:
    card = radial_ground((CARD_W, CARD_H)).convert("RGBA")

    # Headshot: contain in the marquee's 58%-width x 92%-height box,
    # grounded on the card's bottom edge, 2% right inset (the source PNG is
    # flush at its own bottom edge — ADR-0065's measured geometry).
    headshot = Image.open(Path("public") / spec["headshotPath"]).convert("RGBA")
    box_w, box_h = round(CARD_W * 0.58), round(CARD_H * 0.92)
    scale = min(box_w / headshot.width, box_h / headshot.height)
    size = (round(headshot.width * scale), round(headshot.height * scale))
    figure = monochrome(headshot.resize(size, Image.Resampling.LANCZOS))
    card.alpha_composite(figure, (CARD_W - round(CARD_W * 0.02) - size[0], CARD_H - size[1]))

    # Wordmark: the site signature, top-left in the navbar's position.
    wordmark = Image.open(WORDMARK).convert("RGBA")
    wm_h = 34
    wm = wordmark.resize((round(wordmark.width * wm_h / wordmark.height), wm_h),
                         Image.Resampling.LANCZOS)
    card.alpha_composite(wm, (64, 46))

    # Text column (the marquee stack): meta eyebrow / name / cue, left at
    # x=64, vertically centered as a block.
    name_lines = [w for w in spec["playerName"].upper().split(" ") if w]
    max_line_w = 470.0
    name_size = 112
    font = load_font(display_woff, name_size)
    widest = max(font.getlength(line) for line in name_lines)
    if widest > max_line_w:
        name_size = max(40, math.floor(name_size * max_line_w / widest))
        font = load_font(display_woff, name_size)
    line_h = round(name_size * 0.92)  # the marquee's 0.92 line-height

    meta_font = load_font(sans_woff, 17)
    cue_font = load_font(sans_woff, 15)
    meta_h, cue_h, gap = 22, 20, 20
    block_h = meta_h + gap + line_h * len(name_lines) + gap + cue_h
    y = round((CARD_H - block_h) / 2) + 8

    from PIL import ImageDraw

    draw = ImageDraw.Draw(card)
    draw_tracked(card, draw, spec["meta"], meta_font, 64, y, 17 * 0.18, 0.85)
    y += meta_h + gap
    for line in name_lines:
        # ascent-compensated: PIL anchors at the em box top; the display
        # face's tight line height wants lines set by cap height.
        draw.text((64, y - round(name_size * 0.14)), line, font=font, fill=INK)
        y += line_h
    y += gap
    draw_tracked(card, draw, "Is he taking good shots? → The verdict",
                 cue_font, 64, y, 15 * 0.22, 0.75)

    return card


def main() -> None:
    specs = read_specs(sys.stdin)
    for asset in (DISPLAY_900, SANS_500, WORDMARK):
        if not asset.exists():
            sys.exit(f"missing asset: {asset} (run npm install?)")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for spec in specs:
        out = OUT_DIR / f"{spec['slug']}.png"
        compose(spec, DISPLAY_900, SANS_500).convert("RGB").save(
            out, format="PNG", optimize=True
        )
        print(f"card -> {out} ({out.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
