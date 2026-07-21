"""Pull the league season-totals artifact (Gate 5 oracle + league FT baseline).

One verbatim `LeagueDashPlayerStats` (Totals) response per season, stored
append-only at `data/raw/_league/<season>/totals/<pull-date>.json`
(ADR-0054). The single artifact serves double duty for the free-throw derive
(ADR-0053): its hero rows are the Gate 5 season-total oracle, and its summed
FTM/FTA/FGA/PTS columns are the league free-throw baseline (the ADR-0004
rule — counts summed at derive, never rates averaged).

  ┌─ THE ONE FLAG THAT MATTERS ─────────────────────────────────────────────┐
  │ per_mode_detailed='Totals'. The endpoint DEFAULTS to per-game averages,  │
  │ which would silently corrupt the Gate 5 reconciliation and the baseline. │
  └──────────────────────────────────────────────────────────────────────────┘

LOCAL ONLY: stats.nba.com blocks cloud/data-center IPs. Run this on a
developer machine — never from the deployed app or CI.

USAGE:
  python ingestion/pull_league_totals.py                     # 2025-26
  python ingestion/pull_league_totals.py --season 2024-25
  python ingestion/pull_league_totals.py --repull            # add a dated snapshot
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

try:
    from nba_api.stats.endpoints import leaguedashplayerstats
except ImportError:
    sys.exit("nba_api not installed. Run: pip install -r ingestion/requirements.txt")

# Pinned to what derive_freethrow._league_totals_rows validates and reads.
SOURCE = "stats.nba.com leaguedashplayerstats (unofficial)"
RESULT_SET = "LeagueDashPlayerStats"
REQUIRED_COLUMNS = ("PLAYER_ID", "FTM", "FTA", "FGA", "PTS")

DEFAULT_HEROES = ["cody-williams", "keyonte-george", "shai-gilgeous-alexander"]


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(
        description="Pull the league season-totals artifact (Gate 5, ADR-0054)."
    )
    ap.add_argument("--season", default="2025-26")
    ap.add_argument("--season-type", default="Regular Season")
    ap.add_argument("--player-slugs", nargs="*", default=DEFAULT_HEROES)
    ap.add_argument("--public-data", default="public/data")
    ap.add_argument("--out", default="data/raw")
    ap.add_argument("--timeout", type=int, default=30)
    ap.add_argument(
        "--repull",
        action="store_true",
        help="add a new dated snapshot even when a completed-season snapshot exists",
    )
    args = ap.parse_args()

    totals_dir = Path(args.out) / "_league" / args.season / "totals"
    existing = sorted(totals_dir.glob("*.json")) if totals_dir.exists() else []
    if existing and not args.repull:
        sys.exit(
            f"season {args.season} already has a totals snapshot "
            f"({existing[-1].name}) — completed seasons are pulled once "
            f"(ADR-0006); use --repull to add a dated snapshot"
        )

    pull_date = date.today().isoformat()
    out_path = totals_dir / f"{pull_date}.json"
    if out_path.exists():
        sys.exit(f"refusing to overwrite append-only artifact: {out_path}")

    print(f"pulling {RESULT_SET} Totals for {args.season} ({args.season_type})")
    response = leaguedashplayerstats.LeagueDashPlayerStats(
        season=args.season,
        season_type_all_star=args.season_type,
        per_mode_detailed="Totals",
        timeout=args.timeout,
    ).get_dict()

    # Fail before writing anything the derive would reject (ADR-0028 ethos:
    # loud at the source boundary, never a bad artifact on disk).
    result_sets = response.get("resultSets")
    if not isinstance(result_sets, list) or not result_sets:
        sys.exit("response has no resultSets")
    result = result_sets[0]
    if result.get("name") != RESULT_SET:
        sys.exit(f"first result set is {result.get('name')!r}, expected {RESULT_SET!r}")
    headers = result.get("headers")
    rows = result.get("rowSet")
    if not isinstance(headers, list) or not isinstance(rows, list) or not rows:
        sys.exit("response has no headers/rows")
    missing = [column for column in REQUIRED_COLUMNS if column not in headers]
    if missing:
        sys.exit(f"response missing required columns: {', '.join(missing)}")

    snapshot = {
        "_meta": {
            "season": args.season,
            "season_type": args.season_type,
            "per_mode": "Totals",
            "pull_date": pull_date,
            "pull_unit": "season",
            "source": SOURCE,
        },
        "response": response,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
    print(f"saved snapshot -> {out_path}")

    # Report: the league line and each hero's line, read the way the derive
    # will read them.
    column = {name: headers.index(name) for name in REQUIRED_COLUMNS}
    league_ftm = sum(int(row[column["FTM"]]) for row in rows)
    league_fta = sum(int(row[column["FTA"]]) for row in rows)
    league_fga = sum(int(row[column["FGA"]]) for row in rows)
    league_pts = sum(int(row[column["PTS"]]) for row in rows)
    print(
        f"league {args.season}: {len(rows)} player rows · "
        f"FT {league_ftm}/{league_fta} ({league_ftm / league_fta:.3f}) · "
        f"FTA rate {league_fta / league_fga:.3f} · "
        f"FT share of points {league_ftm / league_pts:.3f}"
    )
    for slug in args.player_slugs:
        payload_path = Path(args.public_data) / slug / f"{args.season}.json"
        if not payload_path.exists():
            print(f"  {slug}: no deployed shot payload at {payload_path} — skipped")
            continue
        payload_meta = json.loads(payload_path.read_text(encoding="utf-8"))["_meta"]
        player_id = int(payload_meta["playerId"])
        hero_row = next(
            (row for row in rows if int(row[column["PLAYER_ID"]]) == player_id), None
        )
        if hero_row is None:
            print(f"  {slug}: NO ROW for player {player_id} — Gate 5 will fail")
            continue
        ftm = int(hero_row[column["FTM"]])
        fta = int(hero_row[column["FTA"]])
        fga = int(hero_row[column["FGA"]])
        print(
            f"  {slug}: FT {ftm}/{fta}"
            + (f" ({ftm / fta:.3f})" if fta else "")
            + f" · FGA {fga} · FTA rate {fta / fga:.3f}"
        )


if __name__ == "__main__":
    main()
