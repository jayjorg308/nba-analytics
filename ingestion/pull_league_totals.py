"""Pull the league season artifacts: totals (Gate 5 oracle + league FT
baseline) and advanced (the usage-rate source).

Two verbatim `LeagueDashPlayerStats` responses per season, stored append-only:

  Base/Totals -> data/raw/_league/<season>/totals/<pull-date>.json   (ADR-0054)
  Advanced    -> data/raw/_league/<season>/advanced/<pull-date>.json (ADR-0069)

The totals artifact serves double duty for the free-throw derive (ADR-0053):
its hero rows are the Gate 5 season-total oracle, and its summed
FTM/FTA/FGA/PTS columns are the league free-throw baseline (the ADR-0004
rule — counts summed at derive, never rates averaged). The advanced artifact
carries each hero row's official USG_PCT — presented verbatim, never computed
(ADR-0069) — plus the FGA column the shot derive's FGA oracle reconciles
against the payload's pre-drop season FGA.

Each artifact class keeps its own append-only guard: one run pulls whichever
class the season is missing and skips the one it has, so a season whose
totals landed before ADR-0069 gains only the advanced artifact.

  ┌─ THE ONE FLAG THAT MATTERS ─────────────────────────────────────────────┐
  │ per_mode_detailed='Totals'. The endpoint DEFAULTS to per-game averages,  │
  │ which would silently corrupt the Gate 5 reconciliation and the baseline. │
  └──────────────────────────────────────────────────────────────────────────┘

LOCAL ONLY: stats.nba.com blocks cloud/data-center IPs. Run this on a
developer machine — never from the deployed app or CI.

USAGE:
  python ingestion/pull_league_totals.py                     # 2025-26
  python ingestion/pull_league_totals.py --season 2024-25
  python ingestion/pull_league_totals.py --repull            # add dated snapshots
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

SOURCE = "stats.nba.com leaguedashplayerstats (unofficial)"
RESULT_SET = "LeagueDashPlayerStats"
# Pinned to what derive_freethrow._league_totals_rows validates and reads.
REQUIRED_COLUMNS = ("PLAYER_ID", "FTM", "FTA", "FGA", "PTS")
# Pinned to what derive_payload's usage read validates (ADR-0069): USG_PCT is
# the presented value, FGA the oracle, GP the corruption sanity check.
REQUIRED_ADVANCED_COLUMNS = ("PLAYER_ID", "GP", "FGA", "USG_PCT")


def validated_result(response: dict, required_columns: tuple[str, ...]) -> tuple[list, list]:
    """Fail before writing anything a derive would reject (ADR-0028 ethos:
    loud at the source boundary, never a bad artifact on disk)."""
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
    missing = [column for column in required_columns if column not in headers]
    if missing:
        sys.exit(f"response missing required columns: {', '.join(missing)}")
    return headers, rows


def deployed_payload_metas(public_data: Path, season: str) -> dict[str, dict]:
    """slug -> deployed shot payload _meta for every hero with this season on
    file — the report reads the payloads the way the derives will."""
    metas: dict[str, dict] = {}
    if not public_data.exists():
        return metas
    for slug_dir in sorted(public_data.iterdir()):
        payload_path = slug_dir / f"{season}.json"
        if payload_path.exists():
            metas[slug_dir.name] = json.loads(payload_path.read_text(encoding="utf-8"))["_meta"]
    return metas


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(
        description="Pull the league totals + advanced artifacts (ADR-0054/0069)."
    )
    ap.add_argument("--season", default="2025-26")
    ap.add_argument("--season-type", default="Regular Season")
    ap.add_argument(
        "--player-slugs",
        nargs="*",
        default=None,
        help="hero slugs for the report lines (default: every deployed payload "
             "for the season under --public-data)",
    )
    ap.add_argument("--public-data", default="public/data")
    ap.add_argument("--out", default="data/raw")
    ap.add_argument("--timeout", type=int, default=30)
    ap.add_argument(
        "--repull",
        action="store_true",
        help="add new dated snapshots even when completed-season snapshots exist",
    )
    args = ap.parse_args()

    pull_date = date.today().isoformat()
    league_dir = Path(args.out) / "_league" / args.season
    metas = deployed_payload_metas(Path(args.public_data), args.season)
    slugs = args.player_slugs if args.player_slugs is not None else sorted(metas)

    def target_path(artifact_class: str) -> Path | None:
        """The append-only decision per class: None = skip (exists, no
        --repull); a path = pull and write there."""
        class_dir = league_dir / artifact_class
        existing = sorted(class_dir.glob("*.json")) if class_dir.exists() else []
        if existing and not args.repull:
            print(
                f"{artifact_class} artifact exists for {args.season} "
                f"({existing[-1].name}) — skip (ADR-0006; --repull to add a snapshot)"
            )
            return None
        out_path = class_dir / f"{pull_date}.json"
        if out_path.exists():
            sys.exit(f"refusing to overwrite append-only artifact: {out_path}")
        return out_path

    # -- Base/Totals: the Gate 5 oracle + league FT baseline (ADR-0054) --------
    totals_path = target_path("totals")
    if totals_path is not None:
        print(f"pulling {RESULT_SET} Totals for {args.season} ({args.season_type})")
        response = leaguedashplayerstats.LeagueDashPlayerStats(
            season=args.season,
            season_type_all_star=args.season_type,
            per_mode_detailed="Totals",
            timeout=args.timeout,
        ).get_dict()
        headers, rows = validated_result(response, REQUIRED_COLUMNS)
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
        totals_path.parent.mkdir(parents=True, exist_ok=True)
        totals_path.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
        print(f"saved snapshot -> {totals_path}")

        # Report: the league line and each hero's line, read the way the
        # free-throw derive will read them.
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
        for slug in slugs:
            meta = metas.get(slug)
            if meta is None:
                print(f"  {slug}: no deployed shot payload for {args.season} — skipped")
                continue
            player_id = int(meta["playerId"])
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

    # -- Advanced: the usage-rate source (ADR-0069) -----------------------------
    advanced_path = target_path("advanced")
    if advanced_path is not None:
        print(f"pulling {RESULT_SET} Advanced Totals for {args.season} ({args.season_type})")
        response = leaguedashplayerstats.LeagueDashPlayerStats(
            season=args.season,
            season_type_all_star=args.season_type,
            per_mode_detailed="Totals",
            measure_type_detailed_defense="Advanced",
            timeout=args.timeout,
        ).get_dict()
        headers, rows = validated_result(response, REQUIRED_ADVANCED_COLUMNS)
        snapshot = {
            "_meta": {
                "season": args.season,
                "season_type": args.season_type,
                "per_mode": "Totals",
                "measure_type": "Advanced",
                "pull_date": pull_date,
                "pull_unit": "season",
                "source": SOURCE,
            },
            "response": response,
        }
        advanced_path.parent.mkdir(parents=True, exist_ok=True)
        advanced_path.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
        print(f"saved snapshot -> {advanced_path}")

        # Report: each hero's row read the way the shot derive will read it —
        # USG_PCT verbatim, FGA against the payload's pre-drop season FGA
        # (the ADR-0069 oracle), GP beside gamesIncluded for context (GP may
        # legitimately exceed it: zero-FGA appearances).
        column = {name: headers.index(name) for name in REQUIRED_ADVANCED_COLUMNS}
        for slug in slugs:
            meta = metas.get(slug)
            if meta is None:
                print(f"  {slug}: no deployed shot payload for {args.season} — skipped")
                continue
            player_id = int(meta["playerId"])
            hero_row = next(
                (row for row in rows if int(row[column["PLAYER_ID"]]) == player_id), None
            )
            if hero_row is None:
                print(f"  {slug}: NO ROW for player {player_id} — the usage derive will fail")
                continue
            usg = hero_row[column["USG_PCT"]]
            gp = int(hero_row[column["GP"]])
            fga = int(hero_row[column["FGA"]])
            pre_drop = int(meta["totalShots"]) + int(meta["zoneConflictsDropped"])
            oracle = "exact" if fga == pre_drop else f"MISMATCH (payload pre-drop {pre_drop})"
            print(
                f"  {slug}: USG_PCT {usg} · FGA {fga} ({oracle}) · "
                f"GP {gp} (payload games {meta['gamesIncluded']})"
            )


if __name__ == "__main__":
    main()
