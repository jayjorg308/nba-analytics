"""Committed footprint and content guards for hero-banner team marks.

Two independent questions, deliberately kept apart. The footprint guard is an
*interface* check: one CSS slot, so every mark arrives on the same canvas at
the same size in the same place. The ink guard is a *content* check: the thing
on that canvas has to actually depict something.

The content guard exists because the interface guard alone shipped a blank.
On 2026-08-09 a browser rasterization of the Wizards SVG captured the
broken-image placeholder instead of the mark, and the centered white box it
produced satisfied canvas size, footprint ratio, and centering — it passed,
was committed, and both Washington banners rendered a blank watermark. See the
`public/img/was-logo.png` entry in `docs/image-credits.md`.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from PIL import Image, ImageChops, ImageDraw, ImageFilter

REPO_ROOT = Path(__file__).resolve().parents[1]
LOGO_ASSETS = sorted((REPO_ROOT / "public" / "img").glob("*-logo.png"))
CANVAS_PX = 1024
MIN_CONTENT_RATIO = 0.58
MAX_CONTENT_RATIO = 0.62
MAX_CENTER_OFFSET_RATIO = 0.02

# A mark's ink edges: opaque pixels sitting on the silhouette's contour or on an
# internal tonal edge, over all opaque pixels. Two signals in one number because
# the committed marks split on which one carries them — the Jazz mark is a single
# flat color (91% of its opaque pixels are exactly #300370, internal edges 0.0000)
# and lives entirely on contour complexity, while the Kings and Wizards marks sit
# near the blank floor on contour (0.0103, 0.0083) and carry theirs internally.
# Neither signal alone clears the whole roster. A filled blob has neither:
# its ink is just its own perimeter, which at the pinned 60% footprint is ~0.0065
# whatever shape or color it is. Measured 2026-08-09: real marks 0.050 (Utah) to
# 0.215 (OKC), blanks 0.0065 (square) to 0.0083 (circle). The bar sits at the
# geometric midpoint of that gap, ~2.4x clear on both sides.
INK_CONTRAST = 24
MIN_INK_EDGE_RATIO = 0.02


def _assert_normalized_footprint(image: Image.Image, name: str) -> None:
    """CSS owns one logo slot; asset padding cannot become per-team styling."""
    assert image.size == (CANVAS_PX, CANVAS_PX), (
        f"{name} must use the {CANVAS_PX}px square transparent canvas; "
        "run scripts/normalize_team_logo.py"
    )
    alpha = image.getchannel("A")
    visible = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
    assert visible is not None, f"{name} has no visible mark"
    left, top, right, bottom = visible
    width = right - left
    height = bottom - top
    footprint = max(width, height) / CANVAS_PX
    assert MIN_CONTENT_RATIO <= footprint <= MAX_CONTENT_RATIO, (
        f"{name} visible footprint {footprint:.1%} must be "
        f"{MIN_CONTENT_RATIO:.0%}–{MAX_CONTENT_RATIO:.0%}; "
        "run scripts/normalize_team_logo.py"
    )
    center_x = (left + right) / 2
    center_y = (top + bottom) / 2
    assert abs(center_x - CANVAS_PX / 2) / CANVAS_PX <= MAX_CENTER_OFFSET_RATIO
    assert abs(center_y - CANVAS_PX / 2) / CANVAS_PX <= MAX_CENTER_OFFSET_RATIO


def _ink_edge_ratio(image: Image.Image) -> float:
    """Share of the mark's opaque pixels that sit on a contour or a tonal edge."""
    mask = image.getchannel("A").point(lambda value: 255 if value > 128 else 0)
    gray = image.convert("L")

    # Local tonal range over opaque neighbours only: transparent pixels are
    # pinned to 0 before the max filter and to 255 before the min filter, so
    # they can never widen the range they sit beside.
    opaque_high = ImageChops.multiply(gray, mask)
    opaque_low = ImageChops.lighter(gray, ImageChops.invert(mask))
    local_range = ImageChops.subtract(
        opaque_high.filter(ImageFilter.MaxFilter(3)),
        opaque_low.filter(ImageFilter.MinFilter(3)),
    )
    internal = local_range.point(lambda value: 255 if value > INK_CONTRAST else 0)

    # Contour: opaque pixels the erosion drops, i.e. those with a transparent
    # neighbour. The canvas margin keeps the mark clear of the image border.
    contour = ImageChops.subtract(mask, mask.filter(ImageFilter.MinFilter(3)))

    ink = ImageChops.multiply(ImageChops.lighter(contour, internal), mask)
    return ink.histogram()[255] / mask.histogram()[255]


def _blank_mark(shape: str) -> Image.Image:
    """A flat-color blob on the same normalized canvas the real marks use."""
    side = round(CANVAS_PX * 0.60)
    offset = (CANVAS_PX - side) // 2
    box = [offset, offset, offset + side - 1, offset + side - 1]
    image = Image.new("RGBA", (CANVAS_PX, CANVAS_PX), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    if shape == "square":
        draw.rectangle(box, fill=(255, 255, 255, 255))
    elif shape == "circle":
        draw.ellipse(box, fill=(255, 255, 255, 255))
    else:  # pragma: no cover - guards the parametrization itself
        raise ValueError(shape)
    return image


def test_team_logos_share_one_normalized_visual_footprint():
    """CSS owns one logo slot; asset padding cannot become per-team styling."""
    assert LOGO_ASSETS, "no normalized *-logo.png assets found"
    for path in LOGO_ASSETS:
        with Image.open(path).convert("RGBA") as image:
            _assert_normalized_footprint(image, path.name)


def test_team_logos_depict_a_mark_rather_than_a_blank():
    """A correctly sized, correctly centered blank is still a failed rasterization."""
    assert LOGO_ASSETS, "no normalized *-logo.png assets found"
    for path in LOGO_ASSETS:
        with Image.open(path).convert("RGBA") as image:
            ink = _ink_edge_ratio(image)
            assert ink >= MIN_INK_EDGE_RATIO, (
                f"{path.name} ink-edge ratio {ink:.4f} is below "
                f"{MIN_INK_EDGE_RATIO}: the canvas carries a flat blob, not a "
                "team mark. Re-render the source (inline the SVG rather than "
                "fetching it) and re-run scripts/normalize_team_logo.py"
            )


@pytest.mark.parametrize("shape", ["square", "circle"])
def test_the_content_guard_rejects_a_blank_the_footprint_guard_accepts(shape):
    """The 2026-08-09 placeholder, reconstructed: the teeth are the ink ratio's."""
    blank = _blank_mark(shape)

    # Reproduces the miss: every footprint assertion passes on the blank.
    _assert_normalized_footprint(blank, f"synthesized {shape}")

    ink = _ink_edge_ratio(blank)
    assert ink < MIN_INK_EDGE_RATIO, (
        f"synthesized flat {shape} scored {ink:.4f}, at or above the "
        f"{MIN_INK_EDGE_RATIO} bar — the content guard has lost its teeth"
    )
