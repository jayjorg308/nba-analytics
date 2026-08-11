"""Normalize a team mark for the shared hero-banner watermark slot.

The interface is deliberately asset-level: every ``*-logo.png`` is a centered
mark on the same transparent square canvas. CSS can then style one slot for
every team without knowing the logo's native aspect ratio or source padding.

Usage:
  python scripts/normalize_team_logo.py public/img/okc-logo.png
  python scripts/normalize_team_logo.py public/img/*-logo.png

GETTING THE PNG IN THE FIRST PLACE — read this before rasterizing.

The NBA CDN serves team logos as SVG only
(``cdn.nba.com/logos/nba/<teamId>/primary/L/logo.svg``; the PNG paths that
once served the Cavaliers mark have returned 403 since 2026-08). So a new
team mark starts as a browser rasterization, and there is exactly one way to
do it safely: **inline the SVG markup into the page**, never point an
``<img>`` at the file. An ``<img>`` whose source fails to load rasterizes as
the browser's broken-image placeholder, silently, and a centered white box
satisfies every geometric property this script produces. That is not
hypothetical — it shipped. On 2026-08-09 the Wizards mark was rasterized that
way, the 5.9KB white box was committed, and both Washington banners rendered
a blank watermark in production. Inline markup either renders or throws.

Then verify the raster BEFORE normalizing it, because normalizing a blank
produces a perfectly well-formed blank. Two cheap checks: the opaque pixels
should carry the colors the SVG's own ``<style>`` block declares, in
plausible proportions, and ``ingestion/test_team_logo_assets.py`` should pass
its ink-edge ratio (real marks have run 0.050 to 0.215; blanks sit near
0.0065). That guard is the backstop, not the plan — it was written after the
blank shipped, and it checks the committed asset rather than your process.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

CANVAS_PX = 1024
CONTENT_RATIO = 0.60


def normalize(path: Path) -> None:
    with Image.open(path).convert("RGBA") as source:
        alpha = source.getchannel("A")
        visible = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
        if visible is None:
            raise SystemExit(f"{path}: no visible mark")
        mark = source.crop(visible)

    target_long_side = round(CANVAS_PX * CONTENT_RATIO)
    scale = target_long_side / max(mark.size)
    target_size = tuple(max(1, round(dimension * scale)) for dimension in mark.size)
    mark = mark.resize(target_size, Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS_PX, CANVAS_PX), (0, 0, 0, 0))
    offset = ((CANVAS_PX - mark.width) // 2, (CANVAS_PX - mark.height) // 2)
    canvas.alpha_composite(mark, offset)
    canvas.save(path, format="PNG", optimize=True)
    print(
        f"normalized {path} -> {CANVAS_PX}x{CANVAS_PX}; "
        f"mark {mark.width}x{mark.height} ({CONTENT_RATIO:.0%} max footprint)"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", type=Path)
    args = parser.parse_args()
    for path in args.paths:
        if path.suffix.lower() != ".png":
            raise SystemExit(f"{path}: team marks must be PNG assets")
        normalize(path)


if __name__ == "__main__":
    main()
