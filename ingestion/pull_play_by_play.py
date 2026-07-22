"""Pull shared per-game Case 3 artifacts for the registered hero payloads.

The NBA Stats V3 endpoints' natural unit is one game. Each verbatim
PlayByPlayV3 response and its BoxScoreTraditionalV3 validation sibling are
stored once by game ID and pull date, shared across every hero
(ADRs 0045/0046/0050).

LOCAL ONLY: run from a developer machine.  The deployed app and CI consume
committed derived payloads and never call NBA endpoints.

Usage:
  python ingestion/pull_play_by_play.py
  python ingestion/pull_play_by_play.py --player-slugs cody-williams
  python ingestion/pull_play_by_play.py --repull
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date
from pathlib import Path

try:
    from nba_api.stats.endpoints import boxscoretraditionalv3, playbyplayv3
except ImportError:
    sys.exit("nba_api not installed. Run: pip install -r ingestion/requirements.txt")

DEFAULT_HEROES = ["cody-williams", "keyonte-george", "shai-gilgeous-alexander"]


def shot_payload(root: Path, slug: str, season: str) -> dict:
    path = root / slug / f"{season}.json"
    if not path.exists():
        sys.exit(f"missing deployed shot payload: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def game_ids(root: Path, slugs: list[str], season: str) -> list[str]:
    ids: set[str] = set()
    for slug in slugs:
        payload = shot_payload(root, slug, season)
        payload_season = payload.get("_meta", {}).get("season")
        if payload_season != season:
            sys.exit(f"{slug} payload season {payload_season!r} != requested {season!r}")
        ids.update(str(shot["gameId"]) for shot in payload.get("shots", []))
    return sorted(ids)


def snapshot(game_id: str, pull_date: str, source: str, response: dict) -> dict:
    return {
        "_meta": {
            "game_id": game_id,
            "pull_date": pull_date,
            "pull_unit": "game",
            "source": source,
        },
        "response": response,
    }


def write_new(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        sys.exit(f"refusing to overwrite append-only artifact: {path}")
    path.write_text(json.dumps(value, indent=2), encoding="utf-8")


def paired_snapshot_exists(root: Path, game_id: str) -> bool:
    pbp_dir = root / "play-by-play" / game_id
    box_dir = root / "box-score" / game_id
    pbp_dates = {path.name for path in pbp_dir.glob("*.json")} if pbp_dir.exists() else set()
    box_dates = {path.name for path in box_dir.glob("*.json")} if box_dir.exists() else set()
    orphaned = sorted(pbp_dates ^ box_dates)
    if orphaned:
        sys.exit(f"game {game_id} has orphaned raw snapshots: {', '.join(orphaned)}")
    return bool(pbp_dates)


def main() -> None:
    ap = argparse.ArgumentParser(description="Pull shared NBA Stats V3 game artifacts.")
    ap.add_argument("--player-slugs", nargs="*", default=DEFAULT_HEROES)
    ap.add_argument("--season", default="2025-26")
    ap.add_argument("--public-data", default="public/data")
    ap.add_argument("--out", default="data/raw")
    ap.add_argument("--sleep", type=float, default=0.4)
    ap.add_argument("--timeout", type=int, default=30)
    ap.add_argument("--retries", type=int, default=3)
    ap.add_argument(
        "--repull",
        action="store_true",
        help="add a new dated snapshot even when a completed-game snapshot exists",
    )
    ap.add_argument(
        "--game-ids",
        nargs="*",
        default=None,
        help="explicit game IDs to pull, bypassing payload discovery — the "
             "ADR-0054 remedy path (a named missing game) and the pre-deploy "
             "hero-add path (games for a hero with no deployed payload yet)",
    )
    args = ap.parse_args()

    pull_date = date.today().isoformat()
    out_root = Path(args.out)
    if args.game_ids:
        ids = sorted(args.game_ids)
        print(f"{len(ids)} explicit game(s): {', '.join(ids)}")
    else:
        ids = game_ids(Path(args.public_data), args.player_slugs, args.season)
        print(
            f"{len(ids)} unique games for {len(args.player_slugs)} hero payloads "
            f"({', '.join(args.player_slugs)})"
        )

    pulled = skipped = 0
    for index, game_id in enumerate(ids, start=1):
        have_pair = paired_snapshot_exists(out_root, game_id)
        if not args.repull and have_pair:
            skipped += 1
            print(f"[{index:>3}/{len(ids)}] {game_id} already complete — skip")
            continue

        if pulled:
            time.sleep(args.sleep)
        print(f"[{index:>3}/{len(ids)}] {game_id} pull", flush=True)
        for attempt in range(1, args.retries + 1):
            try:
                pbp_raw = playbyplayv3.PlayByPlayV3(
                    game_id=game_id,
                    start_period=0,
                    end_period=14,
                    timeout=args.timeout,
                ).get_dict()
                box_raw = boxscoretraditionalv3.BoxScoreTraditionalV3(
                    game_id=game_id,
                    timeout=args.timeout,
                ).get_dict()
                break
            except Exception as exc:  # noqa: BLE001 — source/network boundary
                if attempt == args.retries:
                    sys.exit(
                        f"game {game_id} pull failed after {args.retries} attempts: {exc}"
                    )
                delay = args.sleep * (2**attempt)
                print(f"  attempt {attempt} failed: {exc} — retry in {delay:.1f}s")
                time.sleep(delay)

        # Fetch both before writing either: a normal failure cannot leave a
        # half-pair that looks complete to the next run.
        pbp_path = out_root / "play-by-play" / game_id / f"{pull_date}.json"
        box_path = out_root / "box-score" / game_id / f"{pull_date}.json"
        write_new(
            pbp_path,
            snapshot(game_id, pull_date, "NBA Stats PlayByPlayV3", pbp_raw),
        )
        write_new(
            box_path,
            snapshot(game_id, pull_date, "NBA Stats BoxScoreTraditionalV3", box_raw),
        )
        pulled += 1

    print(f"done: {pulled} game pairs pulled · {skipped} existing pairs skipped")


if __name__ == "__main__":
    main()
