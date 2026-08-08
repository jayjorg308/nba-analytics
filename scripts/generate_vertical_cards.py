"""Compose per-hero VERTICAL cards from committed assets.

THE CARD IS THE PORTRAIT BANNER (ADR-0025): the hero page's full-viewport
landing screen, rendered as a still at the aspect ratios feed apps actually
want. Same art direction, same assets, same authored crop — the banner photo
under the site's B&W treatment, cover-cropped at the hero's own authored
`imagePosition`, graded at the bottom so the ink is guaranteed, carrying the
kicker over the thesis over the verdict cue.

Unlike the 1200x630 share cards (generate_social_cards.py, ADR-0067) these
are NOT deployed assets. Nothing on the site references them and no build
step requires them: they are export artifacts a human downloads and posts by
hand, regenerable from committed inputs at any time. So they land in a
gitignored directory, the derived layer's stance rather than the deployed
layer's.

Formats (both standard, both 1080 wide):
  feed  1080x1350 (4:5)  — the tallest a feed post is allowed
  story 1080x1920 (9:16) — stories and reels

Driven by scripts/generate-vertical-cards.ts (the registry lives in
TypeScript); specs arrive as JSON on stdin:
  [{"slug", "thesis", "kicker", "imagePath", "imagePosition"}]
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

from card_common import (
    DISPLAY_900,
    INK,
    SANS_500,
    WORDMARK,
    draw_tracked,
    load_font,
    monochrome,
    read_specs,
    tracked_width,
)

FORMATS = {"feed": (1080, 1350), "story": (1080, 1920)}
OUT_ROOT = Path("social-exports")

MARGIN = 72
# The banner's grade (ADR-0025): ink is guaranteed, never hoped for. The
# bottom ramp carries the text block; the short top scrim carries the
# wordmark over whatever the photo happens to put up there.
GRADE_START = 0.42  # fraction of height where the bottom ramp begins
GRADE_MAX = 0.90
TOP_SCRIM_END = 0.16
TOP_SCRIM_MAX = 0.38


def parse_position(value: str) -> tuple[float, float]:
    """CSS object-position ("55% 25%") as (x, y) fractions."""
    parts = value.replace("%", "").split()
    if len(parts) != 2:
        raise ValueError(f"expected two percentages, got {value!r}")
    return tuple(float(p) / 100.0 for p in parts)  # type: ignore[return-value]


def cover_crop(img: Image.Image, size: tuple[int, int], pos: str) -> Image.Image:
    """CSS `object-fit: cover` + `object-position`, so the still reproduces
    the crop the hero's authored focal point already produces on the site."""
    target_w, target_h = size
    px, py = parse_position(pos)
    scale = max(target_w / img.width, target_h / img.height)
    scaled = (round(img.width * scale), round(img.height * scale))
    img = img.resize(scaled, Image.Resampling.LANCZOS)
    off_x = round((scaled[0] - target_w) * px)
    off_y = round((scaled[1] - target_h) * py)
    return img.crop((off_x, off_y, off_x + target_w, off_y + target_h))


def grade(size: tuple[int, int]) -> Image.Image:
    """The vertical grade, computed one pixel wide and stretched."""
    w, h = size
    column = Image.new("L", (1, h))
    pixels = column.load()
    for y in range(h):
        t = y / (h - 1)
        alpha = 0.0
        if t > GRADE_START:
            ramp = (t - GRADE_START) / (1 - GRADE_START)
            alpha = GRADE_MAX * ramp * ramp  # eased, so the seam never bands
        if t < TOP_SCRIM_END:
            fade = 1 - t / TOP_SCRIM_END
            alpha = max(alpha, TOP_SCRIM_MAX * fade * fade)
        pixels[0, y] = round(255 * alpha)
    mask = column.resize((w, h), Image.Resampling.BILINEAR)
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    layer.putalpha(mask)
    return layer


def tokenize(text: str) -> list[tuple[str, bool]]:
    """(chunk, needs_leading_space) pairs. Hyphenated names are breakable at
    their hyphens, which is how the site wraps GILGEOUS-ALEXANDER."""
    out: list[tuple[str, bool]] = []
    for i, word in enumerate(text.split()):
        parts = word.split("-")
        for j, part in enumerate(parts):
            chunk = part + ("-" if j < len(parts) - 1 else "")
            out.append((chunk, j == 0 and i > 0))
    return out


def wrap(tokens, font, max_w: float) -> list[str]:
    lines: list[str] = []
    current = ""
    for chunk, space in tokens:
        candidate = current + (" " if space and current else "") + chunk
        if current and font.getlength(candidate) > max_w:
            lines.append(current)
            current = chunk
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def fit_thesis(text: str, display_woff: Path, max_w: float, max_lines: int):
    """Largest display size whose wrap fits the column in max_lines."""
    tokens = tokenize(text.upper())
    for size in range(104, 39, -2):
        font = load_font(display_woff, size)
        lines = wrap(tokens, font, max_w)
        if len(lines) <= max_lines and max(font.getlength(l) for l in lines) <= max_w:
            return font, lines, size
    font = load_font(display_woff, 40)
    return font, wrap(tokens, font, max_w), 40


def compose(spec: dict, size: tuple[int, int], display_woff: Path, sans_woff: Path):
    card_w, card_h = size

    photo = Image.open(Path("public") / spec["imagePath"]).convert("RGBA")
    card = monochrome(cover_crop(photo, size, spec["imagePosition"])).convert("RGBA")
    card.alpha_composite(grade(size))

    wordmark = Image.open(WORDMARK).convert("RGBA")
    wm_h = 40
    wm = wordmark.resize(
        (round(wordmark.width * wm_h / wordmark.height), wm_h),
        Image.Resampling.LANCZOS,
    )
    card.alpha_composite(wm, (MARGIN, MARGIN - 4))

    column = card_w - MARGIN * 2
    # A story frame is far taller than it is wide, so it can carry another
    # line before the type has to shrink.
    font, lines, size_px = fit_thesis(
        spec["thesis"], display_woff, column, 4 if card_h > 1500 else 3
    )
    line_h = round(size_px * 0.92)  # the banner's 0.92 line-height

    # The kicker is one unwrappable line carrying name + team + number +
    # season, so a long pair (Gilgeous-Alexander / Oklahoma City Thunder)
    # runs past the margin at the nominal size. Shrink it to fit rather than
    # letting it bleed off the frame.
    kicker_size = 20
    kicker_font = load_font(sans_woff, kicker_size)
    while (
        kicker_size > 12
        and tracked_width(spec["kicker"], kicker_font, kicker_size * 0.18) > column
    ):
        kicker_size -= 1
        kicker_font = load_font(sans_woff, kicker_size)

    cue_font = load_font(sans_woff, 18)
    kicker_h, cue_h = 26, 24
    gap_kicker, gap_cue = 26, 30

    block_h = kicker_h + gap_kicker + line_h * len(lines) + gap_cue + cue_h
    y = card_h - MARGIN - block_h

    draw = ImageDraw.Draw(card)
    draw_tracked(
        card, draw, spec["kicker"], kicker_font, MARGIN, y, kicker_size * 0.18, 0.85
    )
    y += kicker_h + gap_kicker
    for line in lines:
        # ascent-compensated: PIL anchors at the em box top; the display
        # face's tight line height wants lines set by cap height.
        draw.text((MARGIN, y - round(size_px * 0.14)), line, font=font, fill=INK)
        y += line_h
    y += gap_cue
    draw_tracked(card, draw, "↓ The verdict", cue_font, MARGIN, y, 18 * 0.22, 0.75)

    return card


def main() -> None:
    fmt = "feed"
    argv = sys.argv[1:]
    if "--format" in argv:
        fmt = argv[argv.index("--format") + 1]
    if fmt not in FORMATS:
        sys.exit(f"unknown format {fmt!r} (expected one of {', '.join(FORMATS)})")

    specs = read_specs(sys.stdin)
    for asset in (DISPLAY_900, SANS_500, WORDMARK):
        if not asset.exists():
            sys.exit(f"missing asset: {asset} (run npm install?)")

    size = FORMATS[fmt]
    out_dir = OUT_ROOT / fmt
    out_dir.mkdir(parents=True, exist_ok=True)
    for spec in specs:
        photo = Path("public") / spec["imagePath"]
        if not photo.exists():
            sys.exit(f"missing banner photo for {spec['slug']}: {photo}")
        out = out_dir / f"{spec['slug']}.png"
        compose(spec, size, DISPLAY_900, SANS_500).convert("RGB").save(
            out, format="PNG", optimize=True
        )
        print(f"{fmt} {size[0]}x{size[1]} -> {out} ({out.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
