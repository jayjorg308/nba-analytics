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

import io
import json
import math
import struct
import sys
import zlib
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFont, ImageOps

CARD_W, CARD_H = 1200, 630

# The marquee's ground: radial-gradient(120% 100% at 72% 55%, #191b23 0%,
# #0a0a0c 62%) — src/App.css .index-marquee.
GROUND_INNER = (25, 27, 35)
GROUND_OUTER = (10, 10, 12)
GROUND_CENTER = (0.72, 0.55)
GROUND_STOP = 0.62

# The product's B&W identity: grayscale(1) contrast(1.08) brightness(0.94).
BW_CONTRAST = 1.08
BW_BRIGHTNESS = 0.94

INK = (255, 255, 255)

FONT_DIR_DISPLAY = Path("node_modules/@fontsource/big-shoulders-display/files")
FONT_DIR_SANS = Path("node_modules/@fontsource/public-sans/files")
DISPLAY_900 = FONT_DIR_DISPLAY / "big-shoulders-display-latin-900-normal.woff"
SANS_500 = FONT_DIR_SANS / "public-sans-latin-500-normal.woff"
WORDMARK = Path("public/img/goodshots-wordmark.png")
OUT_DIR = Path("public/social-cards")


def woff_to_sfnt(woff: bytes) -> bytes:
    """Unpack a WOFF v1 file into its SFNT (TTF/OTF) form (stdlib only)."""
    signature, flavor, _length, num_tables, _reserved, _sfnt_size = struct.unpack(
        ">IIIHHI", woff[:20]
    )
    if signature != 0x774F4646:  # 'wOFF'
        raise ValueError("not a WOFF v1 file")
    entries = []
    offset = 44  # fixed WOFF header size
    for _ in range(num_tables):
        tag, table_offset, comp_len, orig_len, checksum = struct.unpack(
            ">4sIIII", woff[offset : offset + 20]
        )
        offset += 20
        data = woff[table_offset : table_offset + comp_len]
        if comp_len < orig_len:
            data = zlib.decompress(data)
        if len(data) != orig_len:
            raise ValueError(f"table {tag!r} decompressed to the wrong length")
        entries.append((tag, checksum, data))

    n = len(entries)
    search_range = (2 ** (n.bit_length() - 1)) * 16
    header = struct.pack(
        ">IHHHH", flavor, n, search_range, n.bit_length() - 1, n * 16 - search_range
    )
    records, blobs = b"", b""
    data_offset = 12 + 16 * n
    for tag, checksum, data in entries:
        records += struct.pack(">4sIII", tag, checksum, data_offset, len(data))
        padding = (4 - len(data) % 4) % 4
        blobs += data + b"\0" * padding
        data_offset += len(data) + padding
    return header + records + blobs


def load_font(woff_path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(io.BytesIO(woff_to_sfnt(woff_path.read_bytes())), size)


def radial_ground() -> Image.Image:
    """The marquee gradient, computed small and upscaled (smooth, cheap)."""
    small_w, small_h = 300, 158
    img = Image.new("RGB", (small_w, small_h))
    pixels = img.load()
    cx, cy = small_w * GROUND_CENTER[0], small_h * GROUND_CENTER[1]
    rx, ry = small_w * 1.2, small_h * 1.0  # the CSS 120% / 100% radii
    for y in range(small_h):
        for x in range(small_w):
            d = math.hypot((x - cx) / rx, (y - cy) / ry)
            t = min(d / GROUND_STOP, 1.0)
            pixels[x, y] = tuple(
                round(i + (o - i) * t) for i, o in zip(GROUND_INNER, GROUND_OUTER)
            )
    return img.resize((CARD_W, CARD_H), Image.Resampling.BILINEAR)


def monochrome(cutout: Image.Image) -> Image.Image:
    """The site's photo treatment, applied to an RGBA cutout."""
    gray = ImageOps.grayscale(cutout.convert("RGB"))
    gray = ImageEnhance.Contrast(gray).enhance(BW_CONTRAST)
    gray = ImageEnhance.Brightness(gray).enhance(BW_BRIGHTNESS)
    return Image.merge("RGBA", (gray, gray, gray, cutout.getchannel("A")))


def draw_tracked(card, draw, text, font, x, y, tracking, opacity):
    """Uppercase tracked smallcaps line (letter-spacing has no PIL native)."""
    layer = Image.new("RGBA", card.size, (0, 0, 0, 0))
    from PIL import ImageDraw

    layer_draw = ImageDraw.Draw(layer)
    fill = INK + (round(255 * opacity),)
    cursor = x
    for ch in text.upper():
        if ch == "→":
            # The latin webfont subset has no U+2192 — draw the cue's arrow
            # as strokes instead of shipping a tofu box.
            width = font.size * 0.9
            mid = y + font.size * 0.62
            stroke = max(2, round(font.size / 9))
            head = font.size * 0.26
            tip = cursor + width
            layer_draw.line([(cursor, mid), (tip, mid)], fill=fill, width=stroke)
            layer_draw.line([(tip - head, mid - head), (tip, mid)], fill=fill, width=stroke)
            layer_draw.line([(tip - head, mid + head), (tip, mid)], fill=fill, width=stroke)
            cursor += width + tracking
            continue
        layer_draw.text((cursor, y), ch, font=font, fill=fill)
        cursor += layer_draw.textlength(ch, font=font) + tracking
    card.alpha_composite(layer)
    return cursor - tracking - x


def compose(spec: dict, display_woff: Path, sans_woff: Path) -> Image.Image:
    card = radial_ground().convert("RGBA")

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
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    specs = json.load(sys.stdin)
    if not isinstance(specs, list) or not specs:
        sys.exit("expected a non-empty JSON list of card specs on stdin")
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
