"""Pull a player's shot data and run the pre-build gate report.

WHAT THIS DOES (per the grilled v1 plan — see repo CONTEXT.md and docs/adr/):
  For a hero player, pull `shotchartdetail` for EVERY completed season and, for
  each, persist a verbatim, self-describing snapshot of the raw response — BOTH
  the player's shots AND the LeagueAverages frame (ADR-0006, ADR-0001). Then
  print the pre-build gate report that lets volume — not a guess — pick the
  launch season and settle the remaining data-dependent calls.

WHY BOTH FRAMES: shot quality is expected value vs a league zone baseline
  (ADR-0001). That baseline is the `LeagueAverages` result set returned in the
  SAME response as the shots. Persisting only the shot frame (the common
  mistake) throws the baseline away. We keep both, verbatim.

  ┌─ THE ONE FLAG THAT MATTERS ─────────────────────────────────────────────┐
  │ context_measure_simple='FGA'. The endpoint DEFAULTS to 'PTS', which      │
  │ returns MADE shots only. We need every ATTEMPT (made + missed) or the    │
  │ whole made/missed + selection analysis is silently wrong. Do not change. │
  └──────────────────────────────────────────────────────────────────────────┘

LOCAL-ONLY (guardrail): stats.nba.com blocks cloud/data-center IPs and is a
  slow, unofficial endpoint. Run this on your own machine — never from the
  deployed app or CI. The deployed app reads the persisted JSON, never the API.

USAGE:
  pip install -r ingestion/requirements.txt
  python ingestion/pull_shots.py                       # defaults to Cody Williams
  python ingestion/pull_shots.py --player "Keyonte George"
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date
from pathlib import Path

import pandas as pd

try:
    from nba_api.stats.endpoints import playercareerstats, shotchartdetail
    from nba_api.stats.static import players
except ImportError:
    sys.exit(
        "nba_api not installed. Run: pip install -r ingestion/requirements.txt"
    )

# --- Zone taxonomy (v1 evaluation grain = SHOT_ZONE_BASIC; see CONTEXT.md) -----
# The 7 basic zones the endpoint emits. Backcourt is EXCLUDED from evaluation
# (heaves — nominal 3-zones with ~0 real value that distort the diet weighting),
# but we still report its count so nothing is hidden.
BASIC_ZONES = [
    "Restricted Area",
    "In The Paint (Non-RA)",
    "Mid-Range",
    "Left Corner 3",
    "Right Corner 3",
    "Above the Break 3",
    "Backcourt",
]
EVAL_ZONES = [z for z in BASIC_ZONES if z != "Backcourt"]

# Provisional bars ONLY for displaying "clears vs suppresses" so the real Gate 2
# threshold can be SET from these counts. NOT a committed threshold (ADR-0003).
PROVISIONAL_THRESHOLDS = [10, 15, 20, 25]


def resolve_player(name: str) -> dict:
    matches = players.find_players_by_full_name(name)
    if not matches:
        sys.exit(f"No player found matching {name!r}.")
    if len(matches) > 1:
        exact = [m for m in matches if m["full_name"].lower() == name.lower()]
        if len(exact) == 1:
            return exact[0]
        listing = ", ".join(f"{m['full_name']} (id={m['id']})" for m in matches)
        sys.exit(f"Ambiguous player {name!r}. Candidates: {listing}")
    return matches[0]


def completed_seasons(player_id: int, timeout: int) -> pd.DataFrame:
    """Regular-season rows from career stats, aggregated per SEASON_ID.

    A traded player has multiple rows per season (one per team + a TOT row); we
    sum GP/MIN per SEASON_ID so 'highest-minutes season' is well defined for the
    launch-season pick.
    """
    career = playercareerstats.PlayerCareerStats(
        player_id=player_id, timeout=timeout
    )
    reg = career.get_data_frames()[0]  # SeasonTotalsRegularSeason
    if reg.empty:
        sys.exit("Player has no regular-season history — ineligible as a hero.")
    per_season = (
        reg.groupby("SEASON_ID", as_index=False)[["GP", "MIN"]]
        .sum()
        .sort_values("SEASON_ID")
    )
    return per_season


def result_set(raw: dict, name: str) -> pd.DataFrame:
    """Extract a named result set from the verbatim response as a DataFrame."""
    for rs in raw.get("resultSets", []):
        if rs.get("name") == name:
            return pd.DataFrame(rs["rowSet"], columns=rs["headers"])
    return pd.DataFrame()


def pull_season(player_id: int, season: str, season_type: str, timeout: int):
    resp = shotchartdetail.ShotChartDetail(
        team_id=0,  # all teams — survives mid-season trades
        player_id=player_id,
        season_nullable=season,
        season_type_all_star=season_type,
        context_measure_simple="FGA",  # ALL attempts, not just makes. See header.
        timeout=timeout,
    )
    raw = resp.get_dict()  # verbatim parsed response (both result sets)
    shots = result_set(raw, "Shot_Chart_Detail")
    league = result_set(raw, "LeagueAverages")
    return raw, shots, league


def build_snapshot(player: dict, season: str, season_type: str, raw: dict,
                   shots: pd.DataFrame, pull_date: str) -> dict:
    """Wrap the verbatim response with self-describing provenance (ADR-0006).

    The unmodified endpoint response lives under `response`; `_meta` records what
    the blob contains so it's knowable without re-deriving.
    """
    if not shots.empty and "GAME_DATE" in shots:
        dates = shots["GAME_DATE"].astype(str)
        date_range = [dates.min(), dates.max()]
        games_included = int(shots["GAME_ID"].nunique())
    else:
        date_range, games_included = [None, None], 0
    return {
        "_meta": {
            "player": player["full_name"],
            "player_id": player["id"],
            "season": season,
            "season_type": season_type,
            "pull_date": pull_date,
            "pull_unit": "season",  # ADR-0006: the season, not the game
            "games_included": games_included,
            "date_range": date_range,
            "shot_rows": int(len(shots)),
            "context_measure": "FGA",
            "source": "stats.nba.com shotchartdetail (unofficial)",
        },
        "response": raw,
    }


def write_snapshot(out_root: Path, player: dict, season: str,
                   snapshot: dict, pull_date: str) -> Path:
    slug = player["full_name"].lower().replace(" ", "-")
    # Key: (player, season, pull-date). Append-only — never overwrite (ADR-0006).
    path = out_root / slug / season.replace("/", "-") / f"{pull_date}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        print(f"  ! snapshot already exists, not overwriting: {path}")
        return path
    path.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
    return path


def gate_report(season: str, gp: int, minutes: float,
                shots: pd.DataFrame, league: pd.DataFrame) -> None:
    print(f"\n=== {season}  (GP={gp}, MIN={minutes:.0f}) ".ljust(70, "="))

    # --- Gate 1: baseline populated? -----------------------------------------
    g1_ok = not league.empty
    print(f"  Gate 1 (baseline): LeagueAverages "
          f"{'POPULATED — ' + str(len(league)) + ' rows' if g1_ok else 'EMPTY — FAILS'}")
    if not g1_ok:
        print("    !! (B) baseline rests on this frame. Flagging, not failing.")

    if shots.empty:
        print("  Gate 2: no shots returned — cannot evaluate volume.")
        return

    # --- Gate 2: per-zone attempt volume at SHOT_ZONE_BASIC -------------------
    counts = shots["SHOT_ZONE_BASIC"].value_counts()
    print(f"  Gate 2 (volume): {len(shots)} total attempts. Per-zone counts:")
    for zone in BASIC_ZONES:
        n = int(counts.get(zone, 0))
        tag = "" if zone in EVAL_ZONES else "  [excluded from evaluation]"
        print(f"    {zone:<24} {n:>5}{tag}")
    print("    clears vs suppresses among the "
          f"{len(EVAL_ZONES)} evaluation zones (provisional bars, NOT committed):")
    for t in PROVISIONAL_THRESHOLDS:
        clears = sum(int(counts.get(z, 0)) >= t for z in EVAL_ZONES)
        print(f"      >= {t:>2} attempts: {clears}/{len(EVAL_ZONES)} zones clear")

    # --- Mid-range long-two check --------------------------------------------
    mid = shots[shots["SHOT_ZONE_BASIC"] == "Mid-Range"]
    if len(mid):
        # NBA range literals carry a trailing period ('16-24 ft.'); normalize so
        # the match survives either form. (Matching the bare '16-24 ft' silently
        # counted 0 and would have wrongly deferred the mid-range split.)
        norm = mid["SHOT_ZONE_RANGE"].astype(str).str.rstrip(".").str.strip()
        long_two = int((norm == "16-24 ft").sum())
        share = long_two / len(mid)
        material = long_two >= 15  # same volume bar used for zone inclusion
        verdict = ("material (clears volume bar) — promote the range split"
                   if material
                   else f"below volume bar (<15, share {share:.0%}) — deferral stands")
        print(f"  Mid-range: {len(mid)} attempts; long-two (16-24 ft) = "
              f"{long_two} ({share:.0%}). >> {verdict}")
    else:
        print("  Mid-range: 0 attempts — split moot.")

    # --- Corner-3 split viability --------------------------------------------
    lc = int(counts.get("Left Corner 3", 0))
    rc = int(counts.get("Right Corner 3", 0))
    print(f"  Corner-3 split: left={lc}, right={rc} "
          f"(secondary split ships only if BOTH clear volume)")


def main() -> None:
    ap = argparse.ArgumentParser(description="Pull hero shot data + gate report.")
    ap.add_argument("--player", default="Cody Williams")
    ap.add_argument("--season-type", default="Regular Season")
    ap.add_argument("--out", default="data/raw", help="raw landing layer root")
    ap.add_argument("--sleep", type=float, default=1.5,
                    help="seconds between API calls (be gentle; unofficial)")
    ap.add_argument("--timeout", type=int, default=60)
    ap.add_argument("--seasons", nargs="*",
                    help="explicit season list (e.g. 2024-25); default = all completed")
    args = ap.parse_args()

    pull_date = date.today().isoformat()
    out_root = Path(args.out)

    player = resolve_player(args.player)
    print(f"Hero: {player['full_name']} (id={player['id']})  pull_date={pull_date}")

    try:
        seasons_df = completed_seasons(player["id"], args.timeout)
    except Exception as exc:  # noqa: BLE001 — surface network/API issues plainly
        sys.exit(f"Career-stats lookup failed ({exc}). "
                 "Run locally — stats.nba.com blocks cloud IPs.")

    wanted = args.seasons or list(seasons_df["SEASON_ID"])
    mins = dict(zip(seasons_df["SEASON_ID"], seasons_df["MIN"]))
    gps = dict(zip(seasons_df["SEASON_ID"], seasons_df["GP"]))
    print(f"Completed regular seasons: {', '.join(wanted)}")

    for i, season in enumerate(wanted):
        if i:
            time.sleep(args.sleep)
        try:
            raw, shots, league = pull_season(
                player["id"], season, args.season_type, args.timeout
            )
        except Exception as exc:  # noqa: BLE001
            print(f"\n=== {season}  PULL FAILED: {exc}")
            print("    (If this is a connection/timeout error: run locally.)")
            continue
        snapshot = build_snapshot(
            player, season, args.season_type, raw, shots, pull_date
        )
        path = write_snapshot(out_root, player, season, snapshot, pull_date)
        print(f"\nsaved snapshot -> {path}")
        gate_report(season, int(gps.get(season, 0)),
                    float(mins.get(season, 0)), shots, league)

    print("\n" + "-" * 70)
    print("NEXT: these numbers settle — launch season (highest MIN clearing "
          "gates), Gate 2 threshold, mid-range split, corner split, then the "
          "compute-location A/B. Bring them back to close the plan.")


if __name__ == "__main__":
    main()
