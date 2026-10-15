"""Backfill a team season's pre-game rulers (docs/plans/jazz-first-site.md).

A game is priced against the league as it stood entering its day: the
LeagueAverages frame through the day before. For a completed team season
this pulls one ruler per game date (through the previous day) plus the
season-end ruler, skipping any through-date already in the raw layer, so a
rerun pulls only what is missing. Rulers land under
data/raw/_league/<season>/rulers/<through>/<pull-date>.json.

It also pulls the league game log (data/raw/_league/<season>/game-log/),
the source of each ruler's game count (ADR-0089): the frame states league
attempts, never how many games they came from. Skipped when a log already
on disk reaches the last ruler date; a living season's log grows, so a
rerun after new games pulls a fresh one beside the old (append-only).

LOCAL-ONLY: stats.nba.com blocks cloud IPs.

    python ingestion/pull_rulers.py --team uta --season 2025-26
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import live_pulls

REPO = Path(__file__).resolve().parent.parent


def day_before(iso: str) -> str:
    return (date.fromisoformat(iso) - timedelta(days=1)).isoformat()


def ruler_dates(game_dates: list[str]) -> list[str]:
    """Every through-date the season's cards and season views need: the day
    before each game, plus the last game day (the season-end ruler)."""
    return sorted({day_before(d) for d in game_dates} | {max(game_dates)})


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--team", required=True, help="tricode, e.g. uta")
    ap.add_argument("--season", required=True)
    ap.add_argument("--sleep", type=float, default=1.5)
    args = ap.parse_args()

    payload_path = REPO / "public" / "data" / "_teams" / args.team.lower() / f"{args.season}.json"
    payload = json.loads(payload_path.read_text(encoding="utf-8"))
    game_dates = sorted({s["gameDate"] for s in payload["shots"]})
    out_dir = REPO / "data" / "raw" / "_league" / args.season / "rulers"
    wanted = ruler_dates(game_dates)
    have = {p.name for p in out_dir.iterdir() if p.is_dir() and any(p.glob("*.json"))} if out_dir.exists() else set()
    todo = [d for d in wanted if d not in have]
    print(f"{args.team.upper()} {args.season}: {len(game_dates)} game dates -> {len(wanted)} rulers; "
          f"{len(wanted) - len(todo)} on disk, pulling {len(todo)}")
    pull_date = date.today().isoformat()
    for i, through in enumerate(todo, 1):
        path = live_pulls.pull_ruler_snapshot(args.season, out_dir, through=through,
                                              stamp=live_pulls.stamp_now(), pull_date=pull_date)
        meta = json.loads(path.read_text(encoding="utf-8"))["_meta"]
        print(f"  [{i}/{len(todo)}] through {through}: league FGA {meta['league_fga']}", flush=True)
        time.sleep(args.sleep)

    log_dir = REPO / "data" / "raw" / "_league" / args.season / "game-log"
    logs = sorted(log_dir.glob("*.json")) if log_dir.exists() else []
    if logs:
        meta = json.loads(logs[-1].read_text(encoding="utf-8"))["_meta"]
        reach = (meta["date_range"] or ["", ""])[1]
        if reach >= max(wanted):
            print(f"league game log on disk reaches {reach}: not pulled")
            return
    path = live_pulls.pull_league_game_log_snapshot(
        args.season, log_dir, stamp=live_pulls.stamp_now(), pull_date=pull_date)
    meta = json.loads(path.read_text(encoding="utf-8"))["_meta"]
    print(f"league game log: {meta['games_included']} games, {meta['date_range']}")


if __name__ == "__main__":
    main()
