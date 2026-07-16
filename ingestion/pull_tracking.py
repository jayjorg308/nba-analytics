"""Pull a player's tracking shot splits + the league baseline, and print the v2.0 spike report.

WHAT THIS DOES (per the grilled v2.0 plan — ADR-0029/0030/0031):
  For each hero, pull `playerdashptshots` (the NBA tracking dashboard: shots
  pre-aggregated into creation contexts — there are NO per-shot rows in Case 2
  data) and persist a verbatim, self-describing snapshot (ADR-0006 keying,
  append-only). Then pull the LEAGUE creation baseline: `leaguedashteamptshot`
  per context (30 team rows summed at derive — the ADR-0004 rule), because
  unlike v1's LeagueAverages frame the tracking baseline is NOT a free
  passenger of the player pull. Finally print the spike report that closes
  ADR-0030's open calls: exact context literals, the General reconciliation
  identity, the Shot Clock coverage gap, per-context volumes vs the <50
  small-sample constant, and the league filter mechanics.

WHY TEAM DASH FOR THE LEAGUE: the league dashboard has no "all contexts in one
  frame" mode — each call is filtered to ONE context (GeneralRange /
  ShotClockRange). Team grain returns 30 rows per call (vs ~550 player rows)
  and sums to the same league totals.

  ┌─ THE ONE FLAG THAT MATTERS ─────────────────────────────────────────────┐
  │ per_mode_simple='Totals'. The endpoint DEFAULTS to per-game averages,    │
  │ which are useless for the Σ-FGA reconciliation guard and would silently  │
  │ corrupt every rolled-up baseline. Do not change.                         │
  └──────────────────────────────────────────────────────────────────────────┘

LOCAL-ONLY (guardrail): stats.nba.com blocks cloud/data-center IPs and is a
  slow, unofficial endpoint. Run this on your own machine — never from the
  deployed app or CI. The deployed app reads persisted JSON, never the API.

USAGE:
  pip install -r ingestion/requirements.txt
  python ingestion/pull_tracking.py                      # both current heroes + league
  python ingestion/pull_tracking.py --players "Cody Williams" --skip-league
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
    from nba_api.stats.endpoints import leaguedashteamptshot, playerdashptshots
    from nba_api.stats.static import players
except ImportError:
    sys.exit("nba_api not installed. Run: pip install -r ingestion/requirements.txt")

# --- Context families (ADR-0030; defender added by the v2.1 fast-follow) ------
# Result-set names / context columns in the playerdashptshots response.
FAMILIES = {
    "general": {"result_set": "GeneralShooting", "context_col": "SHOT_TYPE"},
    "shot_clock": {"result_set": "ShotClockShooting", "context_col": "SHOT_CLOCK_RANGE"},
    "closest_defender": {
        "result_set": "ClosestDefenderShooting",
        "context_col": "CLOSE_DEF_DIST_RANGE",
    },
}

# League-dash filter literals are NOT guaranteed to match the player-dash row
# literals (the '16-24 ft.' lesson, ADR-0008: literals are traps). For each row
# literal we try candidates in order and record which one the endpoint accepts.
GENERAL_FILTER_CANDIDATES = {
    "Catch and Shoot": ["Catch and Shoot", "Catch And Shoot"],
    "Pull Ups": ["Pullups", "Pull Ups", "PullUps"],
    "Less than 10 ft": ["Less Than 10 ft", "Less than 10 ft", "Less Than 10ft"],
    "Other": ["Other"],
}

# The small-sample flag constant (mirrors SMALL_SAMPLE_MAKING_ATTEMPTS in
# src/domain/constants.ts). ADR-0031 proposes sharing it; the spike checks fit.
SMALL_SAMPLE = 50

STAT_COLS = ["FGA", "FGM", "FG2A", "FG2M", "FG3A", "FG3M"]


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


def result_set(raw: dict, name: str) -> pd.DataFrame:
    """Extract a named result set from the verbatim response as a DataFrame."""
    for rs in raw.get("resultSets", []):
        if rs.get("name") == name:
            return pd.DataFrame(rs["rowSet"], columns=rs["headers"])
    return pd.DataFrame()


def slugify(full_name: str) -> str:
    return full_name.lower().replace(" ", "-")


def recon_target(slug: str, season: str) -> tuple[int, int] | None:
    """The shot payload's pre-drop season FGA: totalShots + zoneConflictsDropped.

    The tracking dashboards know nothing of our ADR-0019 drops, so the General
    identity is stated against the PRE-drop total (ADR-0030). Reads the
    committed deployed copy — present for every hero that has ever shipped.
    """
    deployed = Path("public/data") / slug / f"{season}.json"
    if not deployed.exists():
        return None
    meta = json.loads(deployed.read_text(encoding="utf-8"))["_meta"]
    return int(meta["totalShots"]), int(meta["zoneConflictsDropped"])


def pull_player_tracking(player_id: int, season: str, season_type: str, timeout: int) -> dict:
    resp = playerdashptshots.PlayerDashPtShots(
        team_id=0,  # all teams — survives mid-season trades
        player_id=player_id,
        season=season,
        season_type_all_star=season_type,
        per_mode_simple="Totals",  # raw counts, not per-game. See header.
        timeout=timeout,
    )
    return resp.get_dict()


def pull_league_context(season: str, season_type: str, timeout: int,
                        general_range: str = "", shot_clock_range: str = "",
                        close_def_dist_range: str = "") -> dict:
    resp = leaguedashteamptshot.LeagueDashTeamPtShot(
        season=season,
        season_type_all_star=season_type,
        per_mode_simple="Totals",  # See header.
        general_range_nullable=general_range,
        shot_clock_range_nullable=shot_clock_range,
        close_def_dist_range_nullable=close_def_dist_range,
        timeout=timeout,
    )
    return resp.get_dict()


def league_frame(raw: dict) -> pd.DataFrame:
    """The league dash has one result set; take it by position, report by name."""
    sets = raw.get("resultSets", [])
    if not sets:
        return pd.DataFrame()
    return pd.DataFrame(sets[0]["rowSet"], columns=sets[0]["headers"])


def write_snapshot(path: Path, snapshot: dict) -> None:
    # Append-only — never overwrite (ADR-0006).
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        print(f"  ! snapshot already exists, not overwriting: {path}")
        return
    path.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
    print(f"  saved snapshot -> {path}")


def pps(row: pd.Series) -> float | None:
    return (2 * row["FG2M"] + 3 * row["FG3M"]) / row["FGA"] if row["FGA"] else None


def family_report(df: pd.DataFrame, context_col: str, target: int | None) -> None:
    """Print one family's rows, column sanity, Σ FGA, and the identity check."""
    if df.empty:
        print("    (empty result set)")
        return
    missing = [c for c in STAT_COLS if c not in df.columns]
    if missing:
        print(f"    !! missing expected columns: {missing}")
        return
    for _, row in df.iterrows():
        p = pps(row)
        flag = " †<50" if row["FGA"] < SMALL_SAMPLE else ""
        sane = "" if row["FGM"] == row["FG2M"] + row["FG3M"] and \
                     row["FGA"] == row["FG2A"] + row["FG3A"] else "  !! 2s+3s≠total"
        print(f"    {row[context_col]!r:<28} FGA={row['FGA']:>4}  FGM={row['FGM']:>4}  "
              f"2s {row['FG2M']:>3}/{row['FG2A']:<4} 3s {row['FG3M']:>3}/{row['FG3A']:<4} "
              f"PPS={p:.3f}{flag}{sane}" if p is not None else
              f"    {row[context_col]!r:<28} FGA=   0  (no PPS claim)")
    total = int(df["FGA"].sum())
    if target is None:
        print(f"    Σ FGA = {total}  (no shot payload found — identity unchecked)")
    elif total == target:
        print(f"    Σ FGA = {total}  == target {target}  >> EXACT MATCH")
    else:
        gap = target - total
        print(f"    Σ FGA = {total}  vs target {target}  >> gap {gap} "
              f"({gap / target:.1%} of attempts unattributed)")


def main() -> None:
    # Windows consoles default to cp1252, which can't print Σ/†/— (the report's
    # working vocabulary). UTF-8 out, unconditionally.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Pull tracking splits + league baseline; print the v2.0 spike report.")
    ap.add_argument("--players", nargs="*", default=["Cody Williams", "Keyonte George"])
    ap.add_argument("--season", default="2025-26")
    ap.add_argument("--season-type", default="Regular Season")
    ap.add_argument("--out", default="data/raw", help="raw landing layer root")
    ap.add_argument("--skip-league", action="store_true")
    ap.add_argument("--sleep", type=float, default=1.5,
                    help="seconds between API calls (be gentle; unofficial)")
    ap.add_argument("--timeout", type=int, default=60)
    args = ap.parse_args()

    pull_date = date.today().isoformat()
    out_root = Path(args.out)
    first_call = True

    def throttle() -> None:
        nonlocal first_call
        if not first_call:
            time.sleep(args.sleep)
        first_call = False

    # ---- Hero pulls -----------------------------------------------------------
    hero_frames: dict[str, dict[str, pd.DataFrame]] = {}
    for name in args.players:
        player = resolve_player(name)
        slug = slugify(player["full_name"])
        print(f"\n=== HERO: {player['full_name']} (id={player['id']})  {args.season} ".ljust(74, "="))
        throttle()
        try:
            raw = pull_player_tracking(player["id"], args.season, args.season_type, args.timeout)
        except Exception as exc:  # noqa: BLE001 — surface network/API issues plainly
            print(f"  PULL FAILED: {exc}\n  (If this is a connection/timeout error: run locally.)")
            continue

        names = [rs.get("name") for rs in raw.get("resultSets", [])]
        print(f"  result sets: {names}")
        snapshot = {
            "_meta": {
                "player": player["full_name"],
                "player_id": player["id"],
                "season": args.season,
                "season_type": args.season_type,
                "pull_date": pull_date,
                "pull_unit": "season",
                "per_mode": "Totals",
                "source": "stats.nba.com playerdashptshots (unofficial)",
            },
            "response": raw,
        }
        write_snapshot(out_root / slug / args.season / "tracking" / f"{pull_date}.json", snapshot)

        tgt = recon_target(slug, args.season)
        target = None
        if tgt:
            target = tgt[0] + tgt[1]
            print(f"  reconciliation target (pre-drop season FGA): {tgt[0]} totalShots "
                  f"+ {tgt[1]} zoneConflictsDropped = {target}")
        frames: dict[str, pd.DataFrame] = {}
        for family, spec in FAMILIES.items():
            df = result_set(raw, spec["result_set"])
            frames[family] = df
            label = "partition — must be exact (ADR-0030)" if family == "general" \
                else "coverage — gap reported, never guessed"
            print(f"  {family.upper()} [{spec['result_set']}]  ({label})")
            family_report(df, spec["context_col"], target)
        hero_frames[player["full_name"]] = frames

    # ---- League baseline ------------------------------------------------------
    if args.skip_league:
        print("\n(league pulls skipped)")
        return

    print(f"\n=== LEAGUE baseline  {args.season} ".ljust(74, "="))
    throttle()
    try:
        overall_raw = pull_league_context(args.season, args.season_type, args.timeout)
    except Exception as exc:  # noqa: BLE001
        sys.exit(f"  league Overall pull failed: {exc}")
    overall = league_frame(overall_raw)
    overall_fga = int(overall["FGA"].sum())
    print(f"  Overall: {len(overall)} team rows, league FGA = {overall_fga}")

    league_snapshot: dict = {
        "_meta": {
            "season": args.season,
            "season_type": args.season_type,
            "pull_date": pull_date,
            "per_mode": "Totals",
            "grain": "team (30 rows per context; summed at derive per ADR-0004)",
            "source": "stats.nba.com leaguedashteamptshot (unofficial)",
            "resolved_filters": {},  # row literal -> accepted filter literal
        },
        "overall": overall_raw,
        "general": {},
        "shot_clock": {},
        "closest_defender": {},
    }

    def sum_cols(df: pd.DataFrame) -> dict[str, int]:
        return {c: int(df[c].sum()) for c in STAT_COLS}

    # General: resolve each row literal (from a hero frame) to a filter literal.
    print("  GENERAL (per-context filtered calls; candidates tried in order):")
    row_literals: list[str] = []
    for frames in hero_frames.values():
        df = frames.get("general", pd.DataFrame())
        if not df.empty:
            row_literals = list(df["SHOT_TYPE"])
            break
    general_sums: dict[str, dict[str, int]] = {}
    for literal in row_literals:
        candidates = GENERAL_FILTER_CANDIDATES.get(literal, [literal])
        resolved = None
        for cand in candidates:
            throttle()
            try:
                raw = pull_league_context(args.season, args.season_type, args.timeout,
                                          general_range=cand)
                df = league_frame(raw)
                if not df.empty and int(df["FGA"].sum()) > 0:
                    resolved = cand
                    league_snapshot["general"][cand] = raw
                    general_sums[literal] = sum_cols(df)
                    break
                print(f"    {literal!r}: filter {cand!r} accepted but returned no data")
            except Exception as exc:  # noqa: BLE001
                print(f"    {literal!r}: filter {cand!r} FAILED ({exc})")
        if resolved:
            s = general_sums[literal]
            p = (2 * s["FG2M"] + 3 * s["FG3M"]) / s["FGA"]
            share = s["FGA"] / overall_fga
            print(f"    {literal!r:<28} -> filter {resolved!r:<28} "
                  f"FGA={s['FGA']:>6} share={share:.1%} PPS={p:.3f}")
            league_snapshot["_meta"]["resolved_filters"][literal] = resolved
        else:
            print(f"    {literal!r}: UNRESOLVED — derive computes it as the residual "
                  f"(Overall − Σ resolved), summing counts, never rates")
    if general_sums:
        g_total = sum(s["FGA"] for s in general_sums.values())
        print(f"    Σ resolved General FGA = {g_total} vs Overall {overall_fga} "
              f"(residual {overall_fga - g_total})")

    # Shot Clock: filter literals expected to match row literals; includes the
    # clock-off band if the dashboard exposes one.
    print("  SHOT CLOCK (per-context filtered calls):")
    sc_literals: list[str] = []
    for frames in hero_frames.values():
        df = frames.get("shot_clock", pd.DataFrame())
        if not df.empty:
            sc_literals = list(df["SHOT_CLOCK_RANGE"])
            break
    sc_total = 0
    for literal in sc_literals:
        throttle()
        try:
            raw = pull_league_context(args.season, args.season_type, args.timeout,
                                      shot_clock_range=literal)
            df = league_frame(raw)
            if df.empty or int(df["FGA"].sum()) == 0:
                print(f"    {literal!r}: accepted but returned no data")
                continue
            league_snapshot["shot_clock"][literal] = raw
            league_snapshot["_meta"]["resolved_filters"][literal] = literal
            s = sum_cols(df)
            sc_total += s["FGA"]
            p = (2 * s["FG2M"] + 3 * s["FG3M"]) / s["FGA"]
            share = s["FGA"] / overall_fga
            print(f"    {literal!r:<28} FGA={s['FGA']:>6} share={share:.1%} PPS={p:.3f}")
        except Exception as exc:  # noqa: BLE001
            print(f"    {literal!r}: FAILED ({exc})")
    if sc_literals:
        gap = overall_fga - sc_total
        print(f"    Σ Shot Clock FGA = {sc_total} vs Overall {overall_fga} "
              f">> league-wide unattributed: {gap} ({gap / overall_fga:.1%})")

    # Closest Defender (the v2.1 fast-follow): filter literals expected to
    # match row literals, same mechanics as the clock bands.
    print("  CLOSEST DEFENDER (per-context filtered calls):")
    cd_literals: list[str] = []
    for frames in hero_frames.values():
        df = frames.get("closest_defender", pd.DataFrame())
        if not df.empty:
            cd_literals = list(df["CLOSE_DEF_DIST_RANGE"])
            break
    cd_total = 0
    for literal in cd_literals:
        throttle()
        try:
            raw = pull_league_context(args.season, args.season_type, args.timeout,
                                      close_def_dist_range=literal)
            df = league_frame(raw)
            if df.empty or int(df["FGA"].sum()) == 0:
                print(f"    {literal!r}: accepted but returned no data")
                continue
            league_snapshot["closest_defender"][literal] = raw
            league_snapshot["_meta"]["resolved_filters"][literal] = literal
            s = sum_cols(df)
            cd_total += s["FGA"]
            p = (2 * s["FG2M"] + 3 * s["FG3M"]) / s["FGA"]
            share = s["FGA"] / overall_fga
            print(f"    {literal!r:<28} FGA={s['FGA']:>6} share={share:.1%} PPS={p:.3f}")
        except Exception as exc:  # noqa: BLE001
            print(f"    {literal!r}: FAILED ({exc})")
    if cd_literals:
        gap = overall_fga - cd_total
        print(f"    Σ Closest Defender FGA = {cd_total} vs Overall {overall_fga} "
              f">> league-wide unattributed: {gap} ({gap / overall_fga:.1%})")

    write_snapshot(out_root / "_league" / args.season / "tracking" / f"{pull_date}.json",
                   league_snapshot)

    print("\n" + "-" * 70)
    print("NEXT: these numbers close ADR-0030's open calls — context literals &")
    print("display labels, the General identity, the Shot Clock gap, shot-clock")
    print("band consolidation, and the <50 flag fit. Bring them back to the plan.")


if __name__ == "__main__":
    main()
