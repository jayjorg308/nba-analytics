"""Shared composition primitives for the generated card families.

Two card families render from committed assets: the 1200x630 share cards
(generate_social_cards.py, ADR-0067) and the vertical export cards
(generate_vertical_cards.py). They are different art directions over the
SAME product identity, so the font loading, the B&W treatment, and the
tracked-smallcaps text routine live here once rather than being copied.

FONTS come from the pinned @fontsource packages (ADR-0020) — the exact
webfont files the site ships, not a re-downloaded cousin that could drift.
@fontsource ships WOFF v1 beside WOFF2, and WOFF v1 is a zlib-wrapped SFNT,
so the stdlib unpacks it into the TTF form PIL reads; no new dependency.
"""

from __future__ import annotations

import io
import math
import struct
import zlib
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps

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


def radial_ground(size: tuple[int, int], small: tuple[int, int] = (300, 158)):
    """The marquee gradient, computed small and upscaled (smooth, cheap).

    `small` is the sampling grid, not a detail knob: changing it changes the
    output pixels, so the share card's historical (300, 158) stays the
    default and a new card family passes its own aspect-matched grid."""
    small_w, small_h = small
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
    return img.resize(size, Image.Resampling.BILINEAR)


def monochrome(cutout: Image.Image) -> Image.Image:
    """The site's photo treatment, applied to an RGBA image."""
    gray = ImageOps.grayscale(cutout.convert("RGB"))
    gray = ImageEnhance.Contrast(gray).enhance(BW_CONTRAST)
    gray = ImageEnhance.Brightness(gray).enhance(BW_BRIGHTNESS)
    return Image.merge("RGBA", (gray, gray, gray, cutout.getchannel("A")))


def draw_tracked(card, draw, text, font, x, y, tracking, opacity):
    """Uppercase tracked smallcaps line (letter-spacing has no PIL native)."""
    layer = Image.new("RGBA", card.size, (0, 0, 0, 0))
    layer_draw = ImageDraw.Draw(layer)
    fill = INK + (round(255 * opacity),)
    cursor = x
    for ch in text.upper():
        if ch in ("→", "↓"):
            # The latin webfont subset has no U+2192/U+2193 — draw the cue's
            # arrow as strokes instead of shipping a tofu box.
            stroke = max(2, round(font.size / 9))
            head = font.size * 0.26
            if ch == "→":
                width = font.size * 0.9
                mid = y + font.size * 0.62
                tip = cursor + width
                layer_draw.line([(cursor, mid), (tip, mid)], fill=fill, width=stroke)
                layer_draw.line(
                    [(tip - head, mid - head), (tip, mid)], fill=fill, width=stroke
                )
                layer_draw.line(
                    [(tip - head, mid + head), (tip, mid)], fill=fill, width=stroke
                )
                cursor += width + tracking
            else:
                width = font.size * 0.5
                mid = cursor + width / 2
                top, bottom = y + font.size * 0.18, y + font.size * 0.92
                layer_draw.line([(mid, top), (mid, bottom)], fill=fill, width=stroke)
                layer_draw.line(
                    [(mid - head, bottom - head), (mid, bottom)],
                    fill=fill,
                    width=stroke,
                )
                layer_draw.line(
                    [(mid + head, bottom - head), (mid, bottom)],
                    fill=fill,
                    width=stroke,
                )
                cursor += width + tracking
            continue
        layer_draw.text((cursor, y), ch, font=font, fill=fill)
        cursor += layer_draw.textlength(ch, font=font) + tracking
    card.alpha_composite(layer)
    return cursor - tracking - x


def tracked_width(text: str, font, tracking: float) -> float:
    """The width draw_tracked will occupy, measurable BEFORE drawing so a
    caller can shrink to fit. Mirrors that routine's advance rules,
    including the two stroke-drawn arrows the latin subset lacks."""
    chars = text.upper()
    if not chars:
        return 0.0
    total = 0.0
    for ch in chars:
        if ch == "→":
            total += font.size * 0.9 + tracking
        elif ch == "↓":
            total += font.size * 0.5 + tracking
        else:
            total += font.getlength(ch) + tracking
    return total - tracking


def read_specs(stdin) -> list:
    """Load the TS driver's JSON specs, with the UTF-8 guarantee both card
    families depend on. Windows defaults sys.stdin to the locale codepage
    (cp1252), which silently decodes the kicker's "·" and "º" into mojibake
    and bakes it into a committed PNG nobody re-reads. Load-bearing."""
    import json
    import sys

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(stdin, "reconfigure"):
        stdin.reconfigure(encoding="utf-8")
    specs = json.load(stdin)
    if not isinstance(specs, list) or not specs:
        sys.exit("expected a non-empty JSON list of card specs on stdin")
    # Loud tripwire for the regression above: U+00C2 never legitimately
    # appears in a kicker, so its presence means stdin was decoded wrong.
    for spec in specs:
        for field, text in spec.items():
            if isinstance(text, str) and "Â" in text:
                sys.exit(
                    f"mojibake in {spec.get('slug', '?')}.{field}: {text!r} "
                    "— stdin decoded as something other than UTF-8"
                )
    return specs
