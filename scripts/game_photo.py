"""Write a game photograph's committed derivative (ADR-0094).

The committed image is always a web-sized derivative, never the
full-resolution source (ADR-0021's rule for banners): EXIF orientation
applied, then the metadata dropped, the longest side capped at the hero
banners' 2048 px, saved as a progressive JPEG. The photo ships in color;
the black-and-white treatment is the stylesheet's filter on the page and
the card generator's on the share card.

Driven by scripts/game-photo.ts:  python scripts/game_photo.py <source> <out>
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageOps

MAX_SIDE = 2048
QUALITY = 85


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit("usage: python scripts/game_photo.py <source-image> <out.jpg>")
    source, out = Path(sys.argv[1]), Path(sys.argv[2])
    image = ImageOps.exif_transpose(Image.open(source)).convert("RGB")
    image.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
    out.parent.mkdir(parents=True, exist_ok=True)
    image.save(out, format="JPEG", quality=QUALITY, optimize=True, progressive=True)
    print(f"{out.as_posix()}: {image.width}x{image.height}, {out.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
