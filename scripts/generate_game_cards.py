"""Compose per-game share cards (1200x630) from committed data and assets.

THE CARD IS THE REPORT CARD'S HEADER (docs/plans/jazz-first-site.md, "Share
cards"): the marquee's dark ground, the wordmark as the site signature, the
kicker (team, date, matchup) over the score at poster scale, the two
answers (question, number, words), and the game's court with every shot,
made filled and missed ringed, the shot chart's own treatment. No new art
direction per game: every input is committed (the game file, the wordmark,
the pinned @fontsource faces, ADR-0020) or derived from it by the TS driver.

THE COURT mirrors src/chart/geometry.ts: stats.nba.com units (tenths of
feet), hoop at the origin, the offense's perspective (hoop at the top), the
baseline at y = -52.5 and half court at 417.5, NBA line-work dimensions.
Off-court shots (heaves past half court) are skipped, never clamped, as on
the page.

A GAME WITH A PHOTOGRAPH (ADR-0094) is drawn with it in the court's place,
as the page banner's wide layout: the site's black-and-white treatment, a
right-anchored panel cropped at the photo's wide focal point and fading in
from its left edge, the credit small in the bottom-right corner. Its PNG
carries a text chunk naming the photo (PHOTO_MARKER_KEY), which the photo
guard reads to prove the card was redrawn. A card without a photo is drawn
exactly as before, with no chunk, so the loop's cards never change.

Driven by scripts/generate-game-cards.ts; specs arrive as JSON on stdin:
  [{"slug", "out", "kicker", "score", "answers": [{"question", "number",
    "words"}], "shots": [{"x", "y", "made"}],
    "photo"?: {"path", "position", "credit"}}]
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw
from PIL.PngImagePlugin import PngInfo

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
ACCENT = (192, 132, 252)  # --accent
MUTED = (156, 163, 175)  # --text
BG = (22, 23, 29)  # --bg

# Must match PHOTO_MARKER_KEY in src/teams/gamePhotoAuthoring.ts.
PHOTO_MARKER_KEY = "goodshots:photo"
# The banner's wide layout (src/App.css .hero-banner-photo): the photo as a
# right-anchored panel, transparent at its left edge, opaque from 32% in.
# The card's panel runs wider than the page's 60% because a card has no
# title to clear, only the text column.
PHOTO_PANEL_W = 700
PHOTO_FADE = 0.32
PHOTO_TEXT_COLUMN = 600

# The court frame in stats units (geometry.ts COURT plus its 2 ft pad).
COURT_MIN_X, COURT_MAX_X = -250, 250
COURT_MIN_Y, COURT_MAX_Y = -52.5, 417.5
PAD = 20
CORNER_ARC_JUNCTION_Y = math.sqrt(237.5**2 - 220**2)


class Court:
    """Stats units -> card pixels for a court box at (left, top) of `width`."""

    def __init__(self, left: float, top: float, width: float):
        self.scale = width / (COURT_MAX_X - COURT_MIN_X + 2 * PAD)
        self.left, self.top = left, top
        self.height = (COURT_MAX_Y - COURT_MIN_Y + 2 * PAD) * self.scale

    def xy(self, x: float, y: float) -> tuple[float, float]:
        return (self.left + (x - COURT_MIN_X + PAD) * self.scale,
                self.top + (y - COURT_MIN_Y + PAD) * self.scale)

    def box(self, cx: float, cy: float, r: float) -> list[float]:
        x, y = self.xy(cx, cy)
        r *= self.scale
        return [x - r, y - r, x + r, y + r]


def draw_court(card: Image.Image, court: Court, shots: list[dict]) -> None:
    layer = Image.new("RGBA", card.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    line = INK + (90,)  # --text-h at ~0.35, the court-lines stroke
    w = 2
    draw.rectangle([*court.xy(COURT_MIN_X, COURT_MIN_Y), *court.xy(COURT_MAX_X, COURT_MAX_Y)],
                   outline=line, width=w)
    draw.rectangle([*court.xy(-80, COURT_MIN_Y), *court.xy(80, COURT_MIN_Y + 190)],
                   outline=line, width=w)
    draw.ellipse(court.box(0, 137.5, 60), outline=line, width=w)
    # PIL angles run clockwise from +x in image space; the hoop is at the
    # top, so the arcs that open toward half court sweep 0..180 degrees.
    draw.arc(court.box(0, 0, 40), 0, 180, fill=line, width=w)
    draw.ellipse(court.box(0, 0, 7.5), outline=line, width=w)
    draw.line([court.xy(-30, -12.5), court.xy(30, -12.5)], fill=line, width=w)
    for x in (-220, 220):
        draw.line([court.xy(x, COURT_MIN_Y), court.xy(x, CORNER_ARC_JUNCTION_Y)], fill=line, width=w)
    start = math.degrees(math.atan2(CORNER_ARC_JUNCTION_Y, 220))
    draw.arc(court.box(0, 0, 237.5), start, 180 - start, fill=line, width=w)
    draw.arc(court.box(0, COURT_MAX_Y, 60), 180, 360, fill=line, width=w)

    r = 5 * court.scale  # DOT_R, half a foot
    on_court = [s for s in shots if COURT_MIN_X <= s["x"] <= COURT_MAX_X
                and COURT_MIN_Y <= s["y"] <= COURT_MAX_Y]
    # Misses first, makes on top: the page's draw order.
    for shot in sorted(on_court, key=lambda s: s["made"]):
        x, y = court.xy(shot["x"], shot["y"])
        if shot["made"]:
            draw.ellipse([x - r, y - r, x + r, y + r], fill=ACCENT + (217,), outline=BG + (255,))
        else:
            draw.ellipse([x - r, y - r, x + r, y + r], outline=MUTED + (140,), width=2)
    card.alpha_composite(layer)


def focal(position: str) -> tuple[float, float]:
    """An "x% y%" focal point as fractions (CSS object-position)."""
    x, y = position.split()
    return float(x.rstrip("%")) / 100, float(y.rstrip("%")) / 100


def draw_photo(card: Image.Image, photo: dict) -> None:
    """The game's photograph as the banner's wide panel: cover-cropped at
    its focal point the way object-position crops it, in the site's B&W,
    fading in from the panel's left edge."""
    source = Image.open(Path("public") / photo["path"]).convert("RGBA")
    pw, ph = PHOTO_PANEL_W, CARD_H
    scale = max(pw / source.width, ph / source.height)
    sw, sh = math.ceil(source.width * scale), math.ceil(source.height * scale)
    scaled = source.resize((sw, sh), Image.Resampling.LANCZOS)
    fx, fy = focal(photo["position"])
    left, top = round((sw - pw) * fx), round((sh - ph) * fy)
    panel = monochrome(scaled.crop((left, top, left + pw, top + ph)))
    ramp = Image.new("L", (pw, 1))
    ramp.putdata([min(255, round(255 * x / (PHOTO_FADE * pw))) for x in range(pw)])
    panel.putalpha(ramp.resize((pw, ph)))
    card.alpha_composite(panel, (CARD_W - pw, 0))


def draw_credit(card: Image.Image, credit: str) -> None:
    """The photograph's credit, small in the bottom-right corner, haloed so
    it reads over any part of the frame."""
    draw = ImageDraw.Draw(card)
    font = load_font(SANS_500, 14)
    x = CARD_W - 24 - font.getlength(credit)
    draw.text((x, CARD_H - 34), credit, font=font, fill=INK + (215,),
              stroke_width=2, stroke_fill=(0, 0, 0, 200))


def fit(font_path: Path, text: str, size: int, max_width: float, floor: int):
    font = load_font(font_path, size)
    while font.getlength(text) > max_width and size > floor:
        size -= 2
        font = load_font(font_path, size)
    return font


def compose(spec: dict) -> Image.Image:
    card = radial_ground((CARD_W, CARD_H)).convert("RGBA")
    wordmark = Image.open(WORDMARK).convert("RGBA")
    wm_h = 34
    card.alpha_composite(
        wordmark.resize((round(wordmark.width * wm_h / wordmark.height), wm_h),
                        Image.Resampling.LANCZOS), (64, 46))

    photo = spec.get("photo")
    if photo:
        draw_photo(card, photo)
        column = PHOTO_TEXT_COLUMN
    else:
        court = Court(left=CARD_W - 64 - 400, top=0, width=400)
        court.top = (CARD_H - court.height) / 2 + 12
        draw_court(card, court, spec["shots"])
        column = court.left - 64 - 48

    draw = ImageDraw.Draw(card)
    y = 128
    draw_tracked(card, draw, spec["kicker"], load_font(SANS_500, 17), 64, y, 17 * 0.18, 0.85)
    y += 40
    score_font = fit(DISPLAY_900, spec["score"], 132, column, 72)
    draw.text((64, y - round(score_font.size * 0.14)), spec["score"], font=score_font, fill=INK)
    y += round(score_font.size * 0.92) + 36

    half = (column - 32) / 2
    q_font = load_font(SANS_500, 15)
    # One size per row across both answers: a long answer shrinks its
    # neighbor with it, so the two read as a pair.
    number_size = min(fit(DISPLAY_900, a["number"], 84, half, 48).size for a in spec["answers"])
    words_size = min(fit(SANS_500, a["words"], 22, half, 14).size for a in spec["answers"])
    number_font = load_font(DISPLAY_900, number_size)
    words_font = load_font(SANS_500, words_size)
    for i, answer in enumerate(spec["answers"]):
        x = 64 + i * (half + 32)
        draw_tracked(card, draw, answer["question"], q_font, x, y, 15 * 0.22, 0.75)
        draw.text((x, y + 30 - round(number_size * 0.14)), answer["number"], font=number_font, fill=INK)
        draw.text((x, y + 30 + round(number_size * 0.92) + 12), answer["words"],
                  font=words_font, fill=MUTED + (255,))
    if photo:
        draw_credit(card, photo["credit"])
    return card


def main() -> None:
    specs = read_specs(sys.stdin)
    for asset in (DISPLAY_900, SANS_500, WORDMARK):
        if not asset.exists():
            sys.exit(f"missing asset: {asset} (run npm install?)")
    for spec in specs:
        out = Path("public") / spec["out"]
        out.parent.mkdir(parents=True, exist_ok=True)
        extra = {}
        if spec.get("photo"):
            info = PngInfo()
            info.add_text(PHOTO_MARKER_KEY, spec["photo"]["path"])
            extra["pnginfo"] = info
        compose(spec).convert("RGB").save(out, format="PNG", optimize=True, **extra)
    total = sum((Path("public") / s["out"]).stat().st_size for s in specs)
    print(f"{len(specs)} game card(s) -> public/{Path(specs[0]['out']).parent.as_posix()}/ "
          f"({total:,} bytes)")


if __name__ == "__main__":
    main()
