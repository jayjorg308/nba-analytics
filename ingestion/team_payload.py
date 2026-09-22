"""The team shot payload grammar (ADR-0082): one builder, two sources.

WHAT THIS IS: the shared, source-blind assembly of the fifth contract —
the team shot payload behind the Jazz surface (docs/plans/jazz-surface.md).
`derive_team_payload.py` feeds it rows read from a raw team-wide
shotchartdetail snapshot plus the games' box scores (the golden path and the
`--engine files` fallback); `export_team_shot_payload.py` feeds it the same
observations read back from the record store. Both must produce
byte-identical output over the same observations — the parity oracle the
record-store tests hold.

THE CONTRACT (schema v1):
    { _meta, roster: RosterEntry[], shots: TeamShot[], zoneBaseline }
  - TeamShot is the hero contract's EnrichedShot plus playerId/playerName.
  - Row order is CHRONOLOGICAL (game date, game, period, clock, event) — a
    defined order, not the response's (ADR-0082): the ledger reads by game.
  - The roster is the same session's commonteamroster snapshot, verbatim
    fields, response order.
  - No usage field: usage is a player fact (ADR-0069).

THE ORACLE (hard-fail, at derive/load AND at export): for every game the
payload contains, every shooter's pre-drop row count equals that player's
field-goal attempts in the game's BoxScoreTraditionalV3 line, and every box
line with attempts has a shooter. A game without its box pair cannot be in
the payload — the pair is also what defines the frontier (ADR-0058).

Zone-point conflicts are dropped and counted (ADR-0019), Backcourt rows kept
(the aggregation excludes and reports them), exactly as the hero contract.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

import derive_payload as dp

# Pinned as a literal on the TS side (src/domain/teamShotPayload.ts); bump
# both on any breaking change.
SCHEMA_VERSION = 1

TEAM_META_KEYS = ["team", "team_id", "season", "season_type", "pull_date", "shot_rows"]
ROSTER_META_KEYS = ["team", "team_id", "season", "season_type", "pull_date"]
ROSTER_RESULT_SET = "CommonTeamRoster"
ROSTER_COLUMNS = ("PLAYER", "NUM", "POSITION", "EXP", "PLAYER_ID")


def fail(msg: str) -> None:
    raise SystemExit(f"team-payload: {msg}")


def tricode_of(team: str) -> str:
    """The team's abbreviation from the ADR-0028 static map — the payload's
    deployment key (public/data/_teams/<tricode lower>/) and _meta.tricode."""
    abbrev = dp.TEAM_ABBREV.get(team)
    if abbrev is None:
        fail(f"unknown team name {team!r} — update derive_payload.TEAM_ABBREV")
    return abbrev


# ------------------------------------------------------------ validation


def validate_team_snapshot(snapshot: dict) -> tuple[dict, pd.DataFrame, pd.DataFrame]:
    """Validate a raw team-wide shotchartdetail snapshot; exit loudly on
    contract violations. Returns (_meta, shots PRE-DROP, league).

    Reuses the hero snapshot's checks where the frames are the same shape,
    and adds the team-scope identity: every row's TEAM_ID is the snapshot's
    team and every row's TEAM_NAME is one name. Conflicts are NOT dropped
    here — the builder drops and counts them after the oracle, which
    reconciles the pre-drop count.
    """
    meta = snapshot.get("_meta")
    response = snapshot.get("response")
    if not isinstance(meta, dict) or not isinstance(response, dict):
        fail("snapshot missing _meta/response — not a raw-layer file")
    missing_meta = [k for k in TEAM_META_KEYS if k not in meta]
    if missing_meta:
        fail(f"_meta missing keys: {missing_meta}")

    shots = dp.result_set(response, "Shot_Chart_Detail")
    if shots is None:
        fail("result set Shot_Chart_Detail missing from response")
    league = dp.result_set(response, "LeagueAverages")
    if league is None:
        fail("result set LeagueAverages missing from response")
    if list(shots.columns) != dp.SHOT_HEADERS:
        fail(f"Shot_Chart_Detail headers changed: {list(shots.columns)}")
    if list(league.columns) != dp.LEAGUE_HEADERS:
        fail(f"LeagueAverages headers changed: {list(league.columns)}")
    if league.empty:
        fail("LeagueAverages frame is empty — Gate 1 (baseline) fails for this season")
    if int(meta["shot_rows"]) != len(shots):
        fail(f"shot rows ({len(shots)}) != _meta.shot_rows ({meta['shot_rows']}) — "
             f"snapshot inconsistent")
    if shots.empty:
        fail("no shot rows — a payload cannot state a frontier (ADR-0058)")

    if not (shots["SHOT_ATTEMPTED_FLAG"] == 1).all():
        fail("SHOT_ATTEMPTED_FLAG != 1 found — expected attempts only (context_measure FGA)")
    if not shots["SHOT_MADE_FLAG"].isin([0, 1]).all():
        fail("SHOT_MADE_FLAG outside {0,1} found")
    unknown_types = set(shots["SHOT_TYPE"]) - set(dp.SHOT_TYPE_POINTS)
    if unknown_types:
        fail(f"unknown SHOT_TYPE values: {sorted(unknown_types)}")
    for frame_name, df in (("Shot_Chart_Detail", shots), ("LeagueAverages", league)):
        unknown = set(df["SHOT_ZONE_BASIC"]) - set(dp.BASIC_ZONES)
        if unknown:
            fail(f"unknown SHOT_ZONE_BASIC in {frame_name}: {sorted(unknown)}")
        unknown = set(df["SHOT_ZONE_AREA"]) - set(dp.ZONE_AREAS)
        if unknown:
            fail(f"unknown SHOT_ZONE_AREA in {frame_name}: {sorted(unknown)}")
        unknown = ({dp.normalize_range(str(r)) for r in df["SHOT_ZONE_RANGE"]}
                   - set(dp.ZONE_RANGES))
        if unknown:
            fail(f"unknown SHOT_ZONE_RANGE in {frame_name}: {sorted(unknown)}")
    try:
        pd.to_datetime(shots["GAME_DATE"].astype(str), format="%Y%m%d")
    except ValueError:
        fail("unparseable GAME_DATE in shot rows (expected YYYYMMDD)")

    # Team-scope identity: one team, one name, matching the snapshot's meta.
    team_ids = set(int(t) for t in shots["TEAM_ID"])
    if team_ids != {int(meta["team_id"])}:
        fail(f"rows carry TEAM_ID {sorted(team_ids)}, snapshot is team {meta['team_id']}")
    team_names = set(str(n) for n in shots["TEAM_NAME"])
    if team_names != {str(meta["team"])}:
        fail(f"rows carry TEAM_NAME {sorted(team_names)}, snapshot is {meta['team']!r}")
    tricode_of(str(meta["team"]))

    with_fga = league[league["FGA"] > 0]
    diff = (with_fga["FGM"] / with_fga["FGA"] - with_fga["FG_PCT"]).abs()
    if (diff > 0.001).any():
        fail("LeagueAverages FG_PCT does not reconcile with FGM/FGA — frame corrupt")
    league_zones = set(league["SHOT_ZONE_BASIC"])
    missing = [z for z in dp.EVAL_ZONES if z not in league_zones]
    if missing:
        fail(f"league frame missing evaluation zones: {missing}")
    league_bands = {
        dp.normalize_range(str(r))
        for r in league.loc[league["SHOT_ZONE_BASIC"] == "Mid-Range", "SHOT_ZONE_RANGE"]
    }
    team_bands = {
        dp.normalize_range(str(r))
        for r in shots.loc[shots["SHOT_ZONE_BASIC"] == "Mid-Range", "SHOT_ZONE_RANGE"]
    }
    uncovered = team_bands - league_bands
    if uncovered:
        fail(f"team mid-range band(s) with no covering league rows: {sorted(uncovered)}")
    return meta, shots, league


def validate_roster_snapshot(snapshot: dict) -> tuple[dict, list[dict]]:
    """Validate a raw commonteamroster snapshot; return (_meta, entries) in
    response order. Entries carry the source's fields verbatim as strings
    (NUM can be empty for an unassigned number; EXP is 'R' or a count)."""
    meta = snapshot.get("_meta")
    response = snapshot.get("response")
    if not isinstance(meta, dict) or not isinstance(response, dict):
        fail("roster snapshot missing _meta/response — not a raw-layer file")
    missing_meta = [k for k in ROSTER_META_KEYS if k not in meta]
    if missing_meta:
        fail(f"roster _meta missing keys: {missing_meta}")
    frame = dp.result_set(response, ROSTER_RESULT_SET)
    if frame is None:
        fail(f"result set {ROSTER_RESULT_SET} missing from roster response")
    missing_cols = [c for c in ROSTER_COLUMNS if c not in frame.columns]
    if missing_cols:
        fail(f"roster frame missing columns: {missing_cols}")
    if frame.empty:
        fail("roster frame is empty")
    entries: list[dict] = []
    seen: set[int] = set()
    for idx, row in enumerate(frame.itertuples(index=False)):
        pid = int(getattr(row, "PLAYER_ID"))
        if pid in seen:
            fail(f"roster lists player {pid} twice")
        seen.add(pid)
        entries.append(roster_entry(
            player_id=pid,
            player_name=str(getattr(row, "PLAYER")),
            number=_text(getattr(row, "NUM")),
            position=_text(getattr(row, "POSITION")),
            experience=_text(getattr(row, "EXP")),
            source_row=idx,
        ))
    return meta, entries


def _text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value != value:  # NaN
        return ""
    return str(value)


def roster_entry(*, player_id: int, player_name: str, number: str, position: str,
                 experience: str, source_row: int) -> dict:
    """The one roster row shape both sources hand the builder."""
    return {
        "player_id": int(player_id),
        "player_name": str(player_name),
        "number": str(number),
        "position": str(position),
        "experience": str(experience),
        "source_row": int(source_row),
    }


# -------------------------------------------------------- observed rows


def observed_row(*, game_id: str, game_event_id: int, game_date: str, team_name: str,
                 htm: str, vtm: str, player_id: int, player_name: str, period: int,
                 minutes_remaining: int, seconds_remaining: int, made: bool,
                 point_value: int, zone_basic: str, zone_area: str, zone_range: str,
                 distance_ft: int, loc_x: int, loc_y: int) -> dict:
    """One pre-drop shot observation in the builder's source-blind form.
    game_date is ISO; zone_range is already normalized (period-free)."""
    return {
        "game_id": str(game_id), "game_event_id": int(game_event_id),
        "game_date": str(game_date), "team_name": str(team_name),
        "htm": str(htm), "vtm": str(vtm),
        "player_id": int(player_id), "player_name": str(player_name),
        "period": int(period), "minutes_remaining": int(minutes_remaining),
        "seconds_remaining": int(seconds_remaining), "made": bool(made),
        "point_value": int(point_value), "zone_basic": str(zone_basic),
        "zone_area": str(zone_area), "zone_range": str(zone_range),
        "distance_ft": int(distance_ft), "loc_x": int(loc_x), "loc_y": int(loc_y),
    }


def rows_from_snapshot(shots: pd.DataFrame) -> list[dict]:
    """Observed rows from a validated pre-drop snapshot frame."""
    rows: list[dict] = []
    for row in shots.itertuples(index=False):
        d = str(row.GAME_DATE)
        rows.append(observed_row(
            game_id=str(row.GAME_ID), game_event_id=int(row.GAME_EVENT_ID),
            game_date=f"{d[:4]}-{d[4:6]}-{d[6:]}", team_name=str(row.TEAM_NAME),
            htm=str(row.HTM), vtm=str(row.VTM),
            player_id=int(row.PLAYER_ID), player_name=str(row.PLAYER_NAME),
            period=int(row.PERIOD), minutes_remaining=int(row.MINUTES_REMAINING),
            seconds_remaining=int(row.SECONDS_REMAINING),
            made=bool(row.SHOT_MADE_FLAG == 1),
            point_value=dp.SHOT_TYPE_POINTS[str(row.SHOT_TYPE)],
            zone_basic=str(row.SHOT_ZONE_BASIC), zone_area=str(row.SHOT_ZONE_AREA),
            zone_range=dp.normalize_range(str(row.SHOT_ZONE_RANGE)),
            distance_ft=int(row.SHOT_DISTANCE), loc_x=int(row.LOC_X), loc_y=int(row.LOC_Y),
        ))
    return rows


def baseline_rows_from_frame(league: pd.DataFrame) -> list[tuple[str, str, int, int]]:
    """(zone_basic, zone_range normalized, fga, fgm) tuples from the frame."""
    return [
        (str(r.SHOT_ZONE_BASIC), dp.normalize_range(str(r.SHOT_ZONE_RANGE)),
         int(r.FGA), int(r.FGM))
        for r in league.itertuples(index=False)
    ]


def box_fga_from_box_game(box_game: dict, team_id: int, game_id: str) -> dict[int, int]:
    """{player_id: FGA} for the team's side of one BoxScoreTraditionalV3
    game object. Fails when neither side is the team."""
    if str(box_game.get("gameId", "")) != game_id:
        fail(f"box score is game {box_game.get('gameId')!r}, expected {game_id}")
    for side in ("homeTeam", "awayTeam"):
        team = box_game.get(side)
        if isinstance(team, dict) and int(team.get("teamId", -1)) == team_id:
            fga: dict[int, int] = {}
            for player in team.get("players", []) or []:
                stats = player.get("statistics")
                if not isinstance(stats, dict):
                    continue
                fga[int(player["personId"])] = int(stats.get("fieldGoalsAttempted") or 0)
            return fga
    fail(f"box score for game {game_id} has no side for team {team_id}")
    return {}


# ----------------------------------------------------------------- build


def rollup_baseline(baseline_rows: list[tuple[str, str, int, int]]) -> list[dict]:
    """The ADR-0004 rollup over (zone_basic, zone_range, fga, fgm) tuples —
    SUM pairs per target zone, never average rates. Same output as
    derive_payload.rollup_baseline over the equivalent frame."""
    by_basic: dict[str, list[tuple[str, int, int]]] = {}
    for zone_basic, zone_range, fga, fgm in baseline_rows:
        by_basic.setdefault(zone_basic, []).append((zone_range, fga, fgm))
    for zone in dp.EVAL_ZONES:
        if zone not in by_basic:
            fail(f"league baseline missing evaluation zone {zone!r}")
    entries: list[dict] = []
    for zone in dp.BASIC_ZONES:
        sub = by_basic.get(zone)
        if not sub:
            continue
        entries.append({"grain": "basic", "zone": zone,
                        "fga": sum(r[1] for r in sub), "fgm": sum(r[2] for r in sub)})
    mid = by_basic.get("Mid-Range", [])
    for band in dp.MID_RANGE_BANDS:
        sub = [r for r in mid if r[0] == band]
        if not sub:
            continue
        entries.append({"grain": "midRangeBand", "band": band,
                        "fga": sum(r[1] for r in sub), "fgm": sum(r[2] for r in sub)})
    return entries


def reconcile_box(rows: list[dict], box_fga: dict[str, dict[int, int]]) -> None:
    """The box oracle (ADR-0082): per game, per player, pre-drop rows equal
    box FGA; every box line with attempts has rows; every game has a box."""
    counts: dict[str, dict[int, int]] = {}
    for r in rows:
        game = counts.setdefault(r["game_id"], {})
        game[r["player_id"]] = game.get(r["player_id"], 0) + 1
    for game_id in sorted(counts):
        box = box_fga.get(game_id)
        if box is None:
            fail(f"game {game_id} has no box score — every game in the payload "
                 f"needs its pair (ADR-0082/0058)")
        for player_id, n in sorted(counts[game_id].items()):
            if player_id not in box:
                fail(f"game {game_id}: player {player_id} has {n} shot row(s) and no "
                     f"box line")
            if box[player_id] != n:
                fail(f"game {game_id}: player {player_id} box FGA {box[player_id]} != "
                     f"{n} shot row(s) — the record disagrees with itself")
        for player_id, fga in sorted(box.items()):
            if fga > 0 and player_id not in counts[game_id]:
                fail(f"game {game_id}: box credits player {player_id} {fga} FGA with "
                     f"no shot rows")


def chronological_key(r: dict) -> tuple:
    return (r["game_date"], r["game_id"], r["period"], -r["minutes_remaining"],
            -r["seconds_remaining"], r["game_event_id"])


def build_team_payload(
    *,
    meta: dict,
    source: str,
    roster_source: str,
    rows: list[dict],
    baseline_rows: list[tuple[str, str, int, int]],
    roster: list[dict],
    box_fga: dict[str, dict[int, int]],
) -> dict:
    """Assemble the payload from observations; every fence live.

    meta carries team/team_id/season/season_type/pull_date (the team
    snapshot's _meta). rows are PRE-DROP observed rows; roster entries are
    roster_entry() dicts; box_fga is {game_id: {player_id: FGA}} for the
    team's side of every game in rows.
    """
    if not rows:
        fail("no shot rows — a payload cannot state a frontier (ADR-0058)")
    reconcile_box(rows, box_fga)

    shots: list[dict] = []
    conflicts = 0
    for r in sorted(rows, key=chronological_key):
        if (r["zone_basic"] in dp.THREE_POINT_ZONES) != (r["point_value"] == 3):
            conflicts += 1
            continue
        opponent, home = dp.matchup(r["team_name"], r["htm"], r["vtm"])
        shots.append({
            "gameId": r["game_id"],
            "gameEventId": r["game_event_id"],
            "gameDate": r["game_date"],
            "opponent": opponent,
            "home": home,
            "playerId": r["player_id"],
            "playerName": r["player_name"],
            "period": r["period"],
            "minutesRemaining": r["minutes_remaining"],
            "secondsRemaining": r["seconds_remaining"],
            "made": r["made"],
            "pointValue": r["point_value"],
            "zoneBasic": r["zone_basic"],
            "zoneArea": r["zone_area"],
            "zoneRange": r["zone_range"],
            "distanceFt": r["distance_ft"],
            "locX": r["loc_x"],
            "locY": r["loc_y"],
        })
    if not shots:
        fail("every shot row is a zone-point conflict — nothing to export")
    if not roster:
        fail("empty roster — the payload requires the session's roster snapshot")

    team = str(meta["team"])
    return {
        "_meta": {
            "schemaVersion": SCHEMA_VERSION,
            "team": team,
            "teamId": int(meta["team_id"]),
            "tricode": tricode_of(team),
            "season": str(meta["season"]),
            "seasonType": str(meta["season_type"]),
            "pullDate": str(meta["pull_date"]),
            "dataThrough": max(s["gameDate"] for s in shots),
            "gamesIncluded": len({s["gameId"] for s in shots}),
            "sourceSnapshot": source,
            "rosterSnapshot": roster_source,
            "totalShots": len(shots),
            "zoneConflictsDropped": conflicts,
        },
        "roster": [
            {
                "playerId": e["player_id"],
                "playerName": e["player_name"],
                "number": e["number"],
                "position": e["position"],
                "experience": e["experience"],
            }
            for e in sorted(roster, key=lambda e: e["source_row"])
        ],
        "shots": shots,
        "zoneBaseline": rollup_baseline(baseline_rows),
    }


def payload_text(payload: dict) -> str:
    """Serialize exactly as the hero derives do (indent 2, LF at write)."""
    return json.dumps(payload, indent=2)


def write_payload(out_path: Path, payload: dict) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(payload_text(payload), encoding="utf-8", newline="\n")
