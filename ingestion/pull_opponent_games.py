"""Backfill the opponents' shots for a team season (docs/plans/jazz-first-site.md).

A report card shows both sides of a game. The team's own shots come from its
season team pull; each opponent's come from a team-wide pull windowed to the
game's date (live_pulls.pull_team_game_snapshot). This pulls one per game of
the team's deployed season, skipping games already on disk, so a rerun pulls
only what is missing. The opponent's identity is read from the game's own
box score, never looked up by abbreviation (ADR-0036's exact-identity rule).

Each pull is checked against the box score as it lands: rows for exactly one
game, and the opponent's row count equal to its box FGA. A mismatch is
reported, not fatal, because the raw layer stores what the source said; the
game payload's export oracles are where a mismatch halts.

LOCAL-ONLY: stats.nba.com blocks cloud IPs.

    python ingestion/pull_opponent_games.py --team uta --season 2025-26
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date
from pathlib import Path

import live_pulls

REPO = Path(__file__).resolve().parent.parent


def latest(path: Path) -> Path:
    return sorted(path.glob("*.json"))[-1]


def box_teams(game_id: str, raw_root: Path = REPO / "data" / "raw") -> tuple[dict, dict]:
    """(home, away) team objects from the game's latest box score."""
    box = json.loads(latest(raw_root / "box-score" / game_id).read_text(encoding="utf-8"))
    bs = box["response"]["boxScoreTraditional"]
    return bs["homeTeam"], bs["awayTeam"]


def box_fga(side: dict) -> int:
    """A side's field-goal attempts, summed over its box players."""
    return sum(p["statistics"]["fieldGoalsAttempted"] for p in side["players"])


def reconciles(meta: dict, game_id: str, side: dict) -> bool:
    """A one-day pull landed the whole game: rows for that game alone, as
    many as the side's box FGA. Also the season loop's readiness test
    (ADR-0091), where a pull that falls short is lag and defers the game."""
    return meta["games_in_rows"] == [game_id] and meta["shot_rows"] == box_fga(side)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--team", required=True, help="the subject team's tricode, e.g. uta")
    ap.add_argument("--season", required=True)
    ap.add_argument("--sleep", type=float, default=1.5)
    args = ap.parse_args()

    tricode = args.team.upper()
    payload = json.loads((REPO / "public" / "data" / "_teams" / tricode.lower()
                          / f"{args.season}.json").read_text(encoding="utf-8"))
    games = sorted({(s["gameDate"], s["gameId"]) for s in payload["shots"]})
    teams_root = REPO / "data" / "raw" / "_teams"
    pull_date = date.today().isoformat()

    todo = []
    for game_date, game_id in games:
        home, away = box_teams(game_id)
        if tricode not in (home["teamTricode"], away["teamTricode"]):
            sys.exit(f"{game_id}: box score has no {tricode} side")
        opp = away if home["teamTricode"] == tricode else home
        out_dir = teams_root / opp["teamTricode"].lower() / args.season / "games"
        if (out_dir / game_id).is_dir() and any((out_dir / game_id).glob("*.json")):
            continue
        todo.append((game_date, game_id, opp, out_dir))
    print(f"{tricode} {args.season}: {len(games)} games, {len(games) - len(todo)} opponent pulls "
          f"on disk, pulling {len(todo)}")

    mismatches = 0
    for i, (game_date, game_id, opp, out_dir) in enumerate(todo, 1):
        path = live_pulls.pull_team_game_snapshot(
            f"{opp['teamCity']} {opp['teamName']}", opp["teamId"], args.season, out_dir,
            game_id=game_id, game_date=game_date, stamp=live_pulls.stamp_now(),
            pull_date=pull_date)
        meta = json.loads(path.read_text(encoding="utf-8"))["_meta"]
        ok = reconciles(meta, game_id, opp)
        mismatches += 0 if ok else 1
        print(f"  [{i}/{len(todo)}] {game_date} {game_id} {opp['teamTricode']}: "
              f"{meta['shot_rows']} rows, box FGA {box_fga(opp)}{'' if ok else '  <-- MISMATCH'}",
              flush=True)
        time.sleep(args.sleep)
    print(f"done: {len(todo)} pulled, {mismatches} mismatch(es) against the box score")


if __name__ == "__main__":
    main()
