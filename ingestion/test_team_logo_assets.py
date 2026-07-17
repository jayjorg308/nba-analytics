"""Committed visual-footprint guard for hero-banner team marks."""

from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
LOGO_ASSETS = sorted((REPO_ROOT / "public" / "img").glob("*-logo.png"))
CANVAS_PX = 1024
MIN_CONTENT_RATIO = 0.58
MAX_CONTENT_RATIO = 0.62
MAX_CENTER_OFFSET_RATIO = 0.02


def test_team_logos_share_one_normalized_visual_footprint():
    """CSS owns one logo slot; asset padding cannot become per-team styling."""
    assert LOGO_ASSETS, "no normalized *-logo.png assets found"
    for path in LOGO_ASSETS:
        with Image.open(path).convert("RGBA") as image:
            assert image.size == (CANVAS_PX, CANVAS_PX), (
                f"{path.name} must use the {CANVAS_PX}px square transparent canvas; "
                "run scripts/normalize_team_logo.py"
            )
            alpha = image.getchannel("A")
            visible = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
            assert visible is not None, f"{path.name} has no visible mark"
            left, top, right, bottom = visible
            width = right - left
            height = bottom - top
            footprint = max(width, height) / CANVAS_PX
            assert MIN_CONTENT_RATIO <= footprint <= MAX_CONTENT_RATIO, (
                f"{path.name} visible footprint {footprint:.1%} must be "
                f"{MIN_CONTENT_RATIO:.0%}–{MAX_CONTENT_RATIO:.0%}; "
                "run scripts/normalize_team_logo.py"
            )
            center_x = (left + right) / 2
            center_y = (top + bottom) / 2
            assert abs(center_x - CANVAS_PX / 2) / CANVAS_PX <= MAX_CENTER_OFFSET_RATIO
            assert abs(center_y - CANVAS_PX / 2) / CANVAS_PX <= MAX_CENTER_OFFSET_RATIO
