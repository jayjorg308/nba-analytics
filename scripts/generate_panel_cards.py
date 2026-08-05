"""Frame captured page panels onto branded 1080x1350 export cards.

THE CHART IS NEVER REDRAWN HERE. The court and the zone table are React
components rendered from the deployed payloads, and reimplementing either in
Python would be a second implementation that drifts from the site the first
time a bin edge or a zone label moves (the ADR-0009 rule, applied to
pixels). So the browser renders them — scripts/generate-panel-cards.ts
drives real Chromium over the real page — and this step only COMPOSES: a
captured PNG onto the card family's ground, under the wordmark, over the
hero's kicker.

Captures arrive with transparent backgrounds (Playwright omitBackground), so
the panel sits on the shared radial ground rather than on a visible rectangle
of a slightly different dark.

Driven by scripts/generate-panel-cards.ts; specs arrive as JSON on stdin:
  [{"slug", "capturePath", "kicker", "label", "outName"}]
Output: social-exports/panels/<slug>-<panel>.png — gitignored, like every
vertical export card.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

from card_common import (
    DISPLAY_900,
    SANS_500,
    WORDMARK,
    draw_tracked,
    load_font,
    radial_ground,
    read_specs,
    tracked_width,
)

CARD_W, CARD_H = 1080, 1350
MARGIN = 72
OUT_DIR = Path("social-exports/panels")

SITE = "nbagoodshots.com"


def compose(spec: dict, sans_woff: Path) -> Image.Image:
    # An aspect-matched sampling grid: the share card's historical grid is
    # tuned to a landscape frame and would smear across a portrait one.
    card = radial_ground((CARD_W, CARD_H), small=(240, 300)).convert("RGBA")

    wordmark = Image.open(WORDMARK).convert("RGBA")
    wm_h = 40
    wm = wordmark.resize(
        (round(wordmark.width * wm_h / wordmark.height), wm_h),
        Image.Resampling.LANCZOS,
    )
    card.alpha_composite(wm, (MARGIN, MARGIN - 4))

    draw = ImageDraw.Draw(card)
    label_font = load_font(sans_woff, 18)
    draw_tracked(card, draw, spec["label"], label_font, MARGIN, 136, 18 * 0.22, 0.70)

    # Caption block, bottom-aligned: the hero's kicker over the site line.
    kicker_size = 20
    kicker_font = load_font(sans_woff, kicker_size)
    column = CARD_W - MARGIN * 2
    while (
        kicker_size > 12
        and tracked_width(spec["kicker"], kicker_font, kicker_size * 0.18) > column
    ):
        kicker_size -= 1
        kicker_font = load_font(sans_woff, kicker_size)
    site_font = load_font(sans_woff, 17)
    kicker_h, gap, site_h = 26, 12, 22
    caption_top = CARD_H - MARGIN - (kicker_h + gap + site_h)

    # The panel fills what the chrome leaves, contained (never cropped — a
    # cropped axis label is a lie the frame tells).
    capture = Image.open(spec["capturePath"]).convert("RGBA")
    region_top = 200
    region_h = caption_top - 48 - region_top
    scale = min(column / capture.width, region_h / capture.height)
    size = (round(capture.width * scale), round(capture.height * scale))
    panel = capture.resize(size, Image.Resampling.LANCZOS)
    card.alpha_composite(
        panel,
        (round((CARD_W - size[0]) / 2), region_top + round((region_h - size[1]) / 2)),
    )

    draw_tracked(
        card, draw, spec["kicker"], kicker_font, MARGIN, caption_top,
        kicker_size * 0.18, 0.85,
    )
    draw_tracked(
        card, draw, SITE, site_font, MARGIN, caption_top + kicker_h + gap,
        17 * 0.22, 0.55,
    )
    return card


def main() -> None:
    specs = read_specs(sys.stdin)
    for asset in (DISPLAY_900, SANS_500, WORDMARK):
        if not asset.exists():
            sys.exit(f"missing asset: {asset} (run npm install?)")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for spec in specs:
        capture = Path(spec["capturePath"])
        if not capture.exists():
            sys.exit(f"missing capture for {spec['slug']}: {capture}")
        out = OUT_DIR / spec["outName"]
        compose(spec, SANS_500).convert("RGB").save(out, format="PNG", optimize=True)
        print(f"panel {CARD_W}x{CARD_H} -> {out} ({out.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
