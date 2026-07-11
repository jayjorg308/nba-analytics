"""Derive the typed payload from the latest raw snapshot (ADR-0007).

WHAT THIS DOES:
  For a (player, season), read the LATEST raw snapshot from the append-only
  landing layer (data/raw/<slug>/<season>/<pull-date>.json — ADR-0006),
  validate it, enrich each shot row into the typed shape, roll the
  LeagueAverages frame up to the evaluation grain (ADR-0004), and persist the
  derived payload the frontend consumes:

      { _meta, shots: EnrichedShot[], zoneBaseline: ZoneBaselineEntry[] }

  The payload deliberately contains NO headline metrics (ADR-0007): those are
  computed by the single pure aggregation function (src/domain/aggregate.ts).
  Derived files are overwritable — append-only is a property of the RAW layer
  only; derived data recomputes from the latest snapshot.

DETERMINISM: same snapshot in -> byte-identical payload out (stable field and
  array order, no derived-at timestamp, LF newlines). The committed golden
  fixture under tests/fixtures/ depends on this.

USAGE:
  python ingestion/derive_payload.py                        # Cody Williams, 2025-26
  python ingestion/derive_payload.py --player "Keyonte George" --season 2024-25
  # golden-fixture regeneration (run from the repo root):
  python ingestion/derive_payload.py --snapshot-file tests/fixtures/snapshot.truncated.json --out-file tests/fixtures/derived.golden.json
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

import pandas as pd

# Bump on any breaking payload change; pinned as a literal on the TS side
# (src/domain/payload.ts) so a mismatch fails loudly at the load boundary.
# v2: _meta.zoneConflictsDropped (ADR-0019).
SCHEMA_VERSION = 2

# --- Zone taxonomy (v1 evaluation grain = SHOT_ZONE_BASIC; see CONTEXT.md) -----
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
THREE_POINT_ZONES = {"Left Corner 3", "Right Corner 3", "Above the Break 3", "Backcourt"}

ZONE_AREAS = [
    "Left Side(L)",
    "Left Side Center(LC)",
    "Center(C)",
    "Right Side Center(RC)",
    "Right Side(R)",
    "Back Court(BC)",
]
# Normalized (period-free) range literals — see normalize_range.
ZONE_RANGES = ["Less Than 8 ft", "8-16 ft", "16-24 ft", "24+ ft", "Back Court Shot"]
# Deterministic band order for the mid-range rollup (ADR-0008 range split).
MID_RANGE_BANDS = ["Less Than 8 ft", "8-16 ft", "16-24 ft"]

SHOT_TYPE_POINTS = {"2PT Field Goal": 2, "3PT Field Goal": 3}

# Exact expected headers — any drift in the (unofficial) endpoint shape must
# fail loudly here, never flow silently into the payload.
SHOT_HEADERS = [
    "GRID_TYPE", "GAME_ID", "GAME_EVENT_ID", "PLAYER_ID", "PLAYER_NAME",
    "TEAM_ID", "TEAM_NAME", "PERIOD", "MINUTES_REMAINING", "SECONDS_REMAINING",
    "EVENT_TYPE", "ACTION_TYPE", "SHOT_TYPE", "SHOT_ZONE_BASIC",
    "SHOT_ZONE_AREA", "SHOT_ZONE_RANGE", "SHOT_DISTANCE", "LOC_X", "LOC_Y",
    "SHOT_ATTEMPTED_FLAG", "SHOT_MADE_FLAG", "GAME_DATE", "HTM", "VTM",
]
LEAGUE_HEADERS = [
    "GRID_TYPE", "SHOT_ZONE_BASIC", "SHOT_ZONE_AREA", "SHOT_ZONE_RANGE",
    "FGA", "FGM", "FG_PCT",
]

META_KEYS = ["player", "player_id", "season", "season_type", "pull_date", "shot_rows"]


def fail(msg: str) -> None:
    sys.exit(f"derive: {msg}")


def normalize_range(literal: str) -> str:
    """Strip the trailing period from NBA range literals ('16-24 ft.' -> '16-24 ft').

    The NBA emits '16-24 ft.' with a trailing period; matching the bare form
    silently counted zero long twos and nearly killed the mid-range split
    (ADR-0008 record correction). Normalize once here so nothing downstream
    ever sees the dotted form.
    """
    return literal.rstrip(".").strip()


def result_set(response: dict, name: str) -> pd.DataFrame | None:
    """Extract a named result set as a DataFrame; None if the set is absent.

    Duplicated from pull_shots.py deliberately (keep the working puller
    untouched; extract a shared module when a third consumer appears).
    """
    for rs in response.get("resultSets", []):
        if rs.get("name") == name:
            return pd.DataFrame(rs["rowSet"], columns=rs["headers"])
    return None


def latest_snapshot_path(raw_root: Path, slug: str, season: str) -> Path:
    season_dir = raw_root / slug / season
    candidates = sorted(season_dir.glob("*.json"))
    if not candidates:
        fail(f"no raw snapshot under {season_dir} — run ingestion/pull_shots.py first")
    # ISO pull-date filenames sort lexicographically == chronologically, so
    # max is the latest snapshot (ADR-0006: derived recomputes from latest).
    return candidates[-1]


def validate_snapshot(snapshot: dict) -> tuple[dict, pd.DataFrame, pd.DataFrame, int]:
    """Validate a raw snapshot; exit loudly on contract violations.

    Returns (_meta, shots, league, zone_conflicts_dropped). Zone-point
    conflicts (ADR-0019) are the one non-fatal finding: the offending rows
    are dropped from `shots` and counted, never guessed or swallowed.
    """
    meta = snapshot.get("_meta")
    response = snapshot.get("response")
    if not isinstance(meta, dict) or not isinstance(response, dict):
        fail("snapshot missing _meta/response — not a raw-layer file")
    missing_meta = [k for k in META_KEYS if k not in meta]
    if missing_meta:
        fail(f"_meta missing keys: {missing_meta}")

    shots = result_set(response, "Shot_Chart_Detail")
    if shots is None:
        fail("result set Shot_Chart_Detail missing from response")
    league = result_set(response, "LeagueAverages")
    if league is None:
        fail("result set LeagueAverages missing from response")

    if list(shots.columns) != SHOT_HEADERS:
        fail(f"Shot_Chart_Detail headers changed: {list(shots.columns)}")
    if list(league.columns) != LEAGUE_HEADERS:
        fail(f"LeagueAverages headers changed: {list(league.columns)}")

    # Gate 1 (ADR-0003): the league baseline must be populated for the season.
    if league.empty:
        fail("LeagueAverages frame is empty — Gate 1 (baseline) fails for this season")

    if int(meta["shot_rows"]) != len(shots):
        fail(f"shot rows ({len(shots)}) != _meta.shot_rows ({meta['shot_rows']}) — snapshot inconsistent")

    if not (shots["SHOT_ATTEMPTED_FLAG"] == 1).all():
        fail("SHOT_ATTEMPTED_FLAG != 1 found — expected attempts only (context_measure FGA)")
    if not shots["SHOT_MADE_FLAG"].isin([0, 1]).all():
        fail("SHOT_MADE_FLAG outside {0,1} found")

    unknown_types = set(shots["SHOT_TYPE"]) - set(SHOT_TYPE_POINTS)
    if unknown_types:
        fail(f"unknown SHOT_TYPE values: {sorted(unknown_types)}")

    for frame_name, df in (("Shot_Chart_Detail", shots), ("LeagueAverages", league)):
        unknown = set(df["SHOT_ZONE_BASIC"]) - set(BASIC_ZONES)
        if unknown:
            fail(f"unknown SHOT_ZONE_BASIC in {frame_name}: {sorted(unknown)}")
        unknown = set(df["SHOT_ZONE_AREA"]) - set(ZONE_AREAS)
        if unknown:
            fail(f"unknown SHOT_ZONE_AREA in {frame_name}: {sorted(unknown)}")
        unknown = {normalize_range(str(r)) for r in df["SHOT_ZONE_RANGE"]} - set(ZONE_RANGES)
        if unknown:
            fail(f"unknown SHOT_ZONE_RANGE in {frame_name}: {sorted(unknown)}")

    # Zone-point conflicts (ADR-0019): pointValue comes from SHOT_TYPE (the
    # scorer's call — what the shot was actually worth); the zone comes from
    # tracking coordinates, and the NBA occasionally disagrees with itself
    # (e.g. a foot-on-the-line step-back scored 2PT but zoned Above the
    # Break 3 at ~24 ft of coordinates). Zone boundaries ARE point-value
    # boundaries at the evaluation grain, so such rows are unrepresentable:
    # DROP them and COUNT them — never guess them into a zone, never swallow
    # them silently. The count rides in _meta and the UI reports it whenever
    # nonzero.
    is_three_zone = shots["SHOT_ZONE_BASIC"].isin(THREE_POINT_ZONES)
    is_three_type = shots["SHOT_TYPE"] == "3PT Field Goal"
    conflict = is_three_zone != is_three_type
    zone_conflicts_dropped = int(conflict.sum())
    if zone_conflicts_dropped:
        shots = shots[~conflict]

    try:
        pd.to_datetime(shots["GAME_DATE"].astype(str), format="%Y%m%d")
    except ValueError:
        fail("unparseable GAME_DATE in shot rows (expected YYYYMMDD)")

    # FG_PCT is used ONLY as this cross-check, then discarded: the payload
    # stores summed fgm/fga pairs, never rates (ADR-0004).
    with_fga = league[league["FGA"] > 0]
    diff = (with_fga["FGM"] / with_fga["FGA"] - with_fga["FG_PCT"]).abs()
    if (diff > 0.001).any():
        fail("LeagueAverages FG_PCT does not reconcile with FGM/FGA — frame corrupt")

    # The baseline must cover everything the aggregation needs: all six
    # evaluation zones, plus every mid-range band the player actually used.
    league_zones = set(league["SHOT_ZONE_BASIC"])
    missing = [z for z in EVAL_ZONES if z not in league_zones]
    if missing:
        fail(f"league frame missing evaluation zones: {missing}")
    league_bands = {
        normalize_range(str(r))
        for r in league.loc[league["SHOT_ZONE_BASIC"] == "Mid-Range", "SHOT_ZONE_RANGE"]
    }
    player_bands = {
        normalize_range(str(r))
        for r in shots.loc[shots["SHOT_ZONE_BASIC"] == "Mid-Range", "SHOT_ZONE_RANGE"]
    }
    uncovered = player_bands - league_bands
    if uncovered:
        fail(f"player mid-range band(s) with no covering league rows: {sorted(uncovered)}")

    return meta, shots, league, zone_conflicts_dropped


def enrich_shots(shots: pd.DataFrame) -> list[dict]:
    """Map validated shot rows to the typed EnrichedShot shape, order preserved.

    Omitted on purpose: PLAYER_*/TEAM_*/HTM/VTM (provenance lives in _meta),
    GRID_TYPE, SHOT_ATTEMPTED_FLAG (validated ==1, then dropped), EVENT_TYPE
    (redundant with `made`), and ACTION_TYPE — excluded because it is
    creation-flavored data whose presence would invite the Case-1 creation
    proxy ADR-0005 forbids. The raw layer retains it for a legitimate v2.
    """
    enriched = []
    for row in shots.itertuples(index=False):
        d = str(row.GAME_DATE)
        enriched.append({
            "gameId": str(row.GAME_ID),
            "gameEventId": int(row.GAME_EVENT_ID),
            "gameDate": f"{d[:4]}-{d[4:6]}-{d[6:]}",
            "period": int(row.PERIOD),
            "minutesRemaining": int(row.MINUTES_REMAINING),
            "secondsRemaining": int(row.SECONDS_REMAINING),
            "made": bool(row.SHOT_MADE_FLAG == 1),
            "pointValue": SHOT_TYPE_POINTS[str(row.SHOT_TYPE)],
            "zoneBasic": str(row.SHOT_ZONE_BASIC),
            "zoneArea": str(row.SHOT_ZONE_AREA),
            "zoneRange": normalize_range(str(row.SHOT_ZONE_RANGE)),
            "distanceFt": int(row.SHOT_DISTANCE),
            "locX": int(row.LOC_X),
            "locY": int(row.LOC_Y),
        })
    return enriched


def rollup_baseline(league: pd.DataFrame) -> list[dict]:
    """Roll the fine-grain LeagueAverages frame up to the evaluation grains.

    ADR-0004 INVARIANT — DO NOT "SIMPLIFY": each target zone's numbers come
    from SUMMING FGM and FGA across its fine-grain sub-zones. Never average
    the sub-zones' FG_PCT values — an unweighted mean over unequal volumes
    produces a silently wrong baseline (the number looks plausible). Guarded
    by the reconciliation tests in test_derive_payload.py. The payload stores
    only the summed fgm/fga pair — no rate — so the averaging mistake is
    structurally impossible downstream.

    Note: basic-grain membership decides the rollup. The league frame contains
    an 'Above the Break 3' row with area Back Court(BC)/range Back Court Shot;
    it legitimately sums into Above the Break 3 — do not "clean" it into
    the Backcourt zone.
    """
    entries: list[dict] = []
    for zone in BASIC_ZONES:  # deterministic order
        sub = league[league["SHOT_ZONE_BASIC"] == zone]
        if sub.empty:
            continue  # zone absent this season (eval-zone presence already validated)
        entries.append({
            "grain": "basic",
            "zone": zone,
            "fga": int(sub["FGA"].sum()),
            "fgm": int(sub["FGM"].sum()),
        })
    mid = league[league["SHOT_ZONE_BASIC"] == "Mid-Range"]
    bands = mid["SHOT_ZONE_RANGE"].astype(str).map(normalize_range)
    for band in MID_RANGE_BANDS:
        sub = mid[bands == band]
        if sub.empty:
            continue  # band absent (e.g. no 'Less Than 8 ft' mid-range rows in 2025-26)
        entries.append({
            "grain": "midRangeBand",
            "band": band,
            "fga": int(sub["FGA"].sum()),
            "fgm": int(sub["FGM"].sum()),
        })
    return entries


def build_payload(
    meta: dict,
    source: str,
    shots: list[dict],
    baseline: list[dict],
    zone_conflicts_dropped: int,
) -> dict:
    return {
        "_meta": {
            "schemaVersion": SCHEMA_VERSION,
            "player": meta["player"],
            "playerId": int(meta["player_id"]),
            "season": meta["season"],
            "seasonType": meta["season_type"],
            "pullDate": meta["pull_date"],
            "sourceSnapshot": source,
            # Post-drop count: totalShots is what the payload carries.
            "totalShots": len(shots),
            "zoneConflictsDropped": zone_conflicts_dropped,
        },
        "shots": shots,
        "zoneBaseline": baseline,
    }


def repo_relative(path: Path) -> str:
    """Repo-relative, forward-slash form for _meta.sourceSnapshot (deterministic
    across machines as long as the derive runs from the repo root)."""
    try:
        return path.resolve().relative_to(Path.cwd().resolve()).as_posix()
    except ValueError:
        return path.as_posix()


def write_payload(out_path: Path, payload: dict) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # LF newline keeps output byte-identical across platforms (golden fixture).
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8", newline="\n")


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Derive the typed payload from the latest raw snapshot."
    )
    ap.add_argument("--player", default="Cody Williams")
    ap.add_argument("--season", default="2025-26", help="launch season (CONTEXT.md)")
    ap.add_argument("--raw-root", default="data/raw")
    ap.add_argument("--out-root", default="data/derived")
    ap.add_argument("--snapshot-file",
                    help="explicit snapshot path, bypassing the raw-root lookup "
                         "(golden-fixture workflow)")
    ap.add_argument("--out-file",
                    help="explicit output path (golden-fixture workflow)")
    args = ap.parse_args()

    if args.snapshot_file:
        snapshot_path = Path(args.snapshot_file)
        if not snapshot_path.exists():
            fail(f"snapshot not found: {snapshot_path}")
    else:
        slug = args.player.lower().replace(" ", "-")  # same slug rule as pull_shots.py
        snapshot_path = latest_snapshot_path(Path(args.raw_root), slug, args.season)

    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    meta, shots_df, league_df, conflicts = validate_snapshot(snapshot)
    enriched = enrich_shots(shots_df)
    baseline = rollup_baseline(league_df)
    payload = build_payload(meta, repo_relative(snapshot_path), enriched, baseline, conflicts)

    if args.out_file:
        out_path = Path(args.out_file)
    else:
        # Key derived output by the snapshot's own identity, not the CLI args.
        slug = str(meta["player"]).lower().replace(" ", "-")
        season_dir = str(meta["season"]).replace("/", "-")
        out_path = Path(args.out_root) / slug / season_dir / f"{meta['pull_date']}.json"
    write_payload(out_path, payload)

    counts = Counter(s["zoneBasic"] for s in enriched)
    print(f"derived payload -> {out_path}")
    print(f"  {meta['player']} {meta['season']}  shots={len(enriched)}  "
          f"baseline entries={len(baseline)}")
    if conflicts:
        print(f"  zone-point conflicts dropped (ADR-0019): {conflicts}")
    for zone in BASIC_ZONES:
        if counts.get(zone):
            print(f"    {zone:<24}{counts[zone]:>5}")


if __name__ == "__main__":
    main()
