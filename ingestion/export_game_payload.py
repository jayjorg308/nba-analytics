"""Export game payloads and the team season index from the record store
(ADR-0088). Born DB-native: no file derive exists.

THE GAME PAYLOAD (schema v1): one immutable file per game, both teams, the
subject team first — everything a report card and a player's night read:
  { _meta, sides: [subject, opponent], zoneBaseline }
  - _meta: the game's identity, the subject and opponent, home, the ruler
    (ADR-0089: kind 'pre-game' or 'prior-season', its season, through-date,
    game count, and source snapshot), and the game's pbp/box pair.
  - a side: team identity, the box team line, every box line of a player
    who appeared (with his technical and split free throws), the enriched
    shot rows plus playerId and assistStatus (post-drop, chronological),
    the zone-point conflicts dropped (ADR-0019, listed so a receipt can
    strike them), and the trips (the ADR-0053 v3 trip row plus playerId).
  - zoneBaseline: the ruler rolled up (ADR-0004), so the file is
    self-contained.

THE ORACLES (hard-fail at export):
  - per player per side, pre-drop shot rows equal box FGA (the box oracle);
  - per player per side, trips + technicals + splits equal the box
    free-throw line (the v3 identity);
  - the receipt identity per player: made field-goal points (priced,
    heaves, and conflicts) + trip FTM + technical FTM + split FTM == box
    points; per side, the player points sum to the box team line;
  - per side, assist statuses bound the official team assists (assisted <=
    box assists <= assisted + unknown makes), after the grammar's own exact
    reconciliation of parsed credits to the box (ADR-0046);
  - the subject's shots equal the team shot payload's slice for the game,
    exactly (export_season, against the same store's team export);
  - the ruler is the recorded frame for the day before the game, complete
    in every evaluation zone, with a game count from the league game log;
    the prior season's baseline only when that count is zero.

THE SEASON INDEX (schema v1, <season>/index.json): the frontier fields and
one row per published game — slug, date, opponent, home, both scores, the
subject's box team line, and that game's ruler with its rolled-up zones —
small and living. Game files are immutable: export_season never rewrites a
published game file whose bytes would change (a correction travels by PR,
--allow-rewrite). The season loop's team session exports into data/derived
against the published directory and syncs from there (ADR-0091).

USAGE:
  python ingestion/export_game_payload.py --team "Utah Jazz" --season 2025-26 --out-dir public/data/_teams/uta/2025-26
  python ingestion/export_game_payload.py --team "Utah Jazz" --game-id 0022500087 --out-file <path>
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path

import derive_freethrow as df
import derive_payload as dp
import derive_shot_context as dsc
import export_team_shot_payload as etp
import load_game_corpus as lgc
import record_store as rs
import team_payload as tp
from load_rulers import GAME_LOG_SOURCE, RULER_SOURCE
from load_team_games import TEAM_GAME_SOURCE
from load_team_season import TEAM_SOURCE

# Pinned as literals on the TS side (src/domain/gamePayload.ts,
# src/domain/teamSeasonIndex.ts); bump both on any breaking change.
SCHEMA_VERSION = 1
INDEX_SCHEMA_VERSION = 1
THREE = dp.THREE_POINT_ZONES


def fail(msg: str) -> None:
    sys.exit(f"export-game: {msg}")


def prior_season(season: str) -> str:
    start = int(season[:4]) - 1
    return f"{start}-{str(start + 1)[-2:]}"


def game_slug(game_date: str, opponent_tricode: str) -> str:
    """The game's URL segment: date plus the opponent's lowercase tricode.
    A team never plays twice on one date, so it is unique per team."""
    return f"{game_date}-{opponent_tricode.lower()}"


def _head_path(cur, key: str) -> str | None:
    cur.execute("SELECT s.path FROM source_head h JOIN snapshot s USING (snapshot_id)"
                " WHERE h.scope_key = %s", (key,))
    row = cur.fetchone()
    return None if row is None else row[0]


# ----------------------------------------------------------------- ruler


def resolve_ruler(cur, season: str, season_type: str, game_date: date) -> tuple[dict, list]:
    """(ruler meta, fine-grain baseline rows) for a game: the frame through
    the day before (ADR-0089), or the prior season's full baseline when no
    league game had been played by then (the league's opening night)."""
    through = game_date - timedelta(days=1)
    log_head = _head_path(cur, rs.scope_key(GAME_LOG_SOURCE, season=season,
                                            season_type=season_type))
    if log_head is None:
        fail(f"no league game log loaded for {season} — run ingestion/load_rulers.py")
    cur.execute("SELECT count(*) FROM league_game WHERE season = %s AND season_type = %s"
                " AND game_date <= %s", (season, season_type, through))
    games = cur.fetchone()[0]
    cur.execute("SELECT zone_basic, zone_range, fga, fgm FROM league_ruler_zone"
                " WHERE season = %s AND season_type = %s AND through_date = %s",
                (season, season_type, through))
    rows = [(zb, zr, fga, fgm) for zb, zr, fga, fgm in cur.fetchall()]
    ruler_head = _head_path(cur, rs.scope_key(RULER_SOURCE, season=season,
                                              season_type=season_type,
                                              through=through.isoformat()))
    if games == 0:
        if rows and sum(r[2] for r in rows) > 0:
            fail(f"ruler through {through} has league attempts but the game log "
                 f"has no game by then — the two sources disagree")
        prior = prior_season(season)
        cur.execute("SELECT zone_basic, zone_range, fga, fgm FROM league_zone_baseline"
                    " WHERE season = %s AND season_type = %s", (prior, season_type))
        rows = [(zb, zr, fga, fgm) for zb, zr, fga, fgm in cur.fetchall()]
        if not rows:
            fail(f"game on {game_date} needs the prior-season ruler, but no {prior} "
                 f"league baseline is loaded")
        cur.execute("SELECT count(*), max(game_date) FROM league_game"
                    " WHERE season = %s AND season_type = %s", (prior, season_type))
        prior_games, prior_through = cur.fetchone()
        if not prior_games:
            fail(f"prior-season ruler needs the {prior} league game log — load it")
        meta = {"kind": "prior-season", "season": prior,
                "through": prior_through.isoformat(), "games": prior_games,
                "sourceSnapshot": _head_path(cur, rs.scope_key(
                    GAME_LOG_SOURCE, season=prior, season_type=season_type))}
        return meta, rows
    if ruler_head is None or not rows:
        fail(f"no ruler loaded through {through} for the game on {game_date} — "
             f"run ingestion/pull_rulers.py and ingestion/load_rulers.py")
    by_zone: dict[str, int] = {}
    for zone_basic, _, fga, _ in rows:
        by_zone[zone_basic] = by_zone.get(zone_basic, 0) + fga
    thin = [z for z in dp.EVAL_ZONES if by_zone.get(z, 0) == 0]
    if thin:
        fail(f"ruler through {through} has no league attempts in {thin} — it cannot "
             f"price a game")
    meta = {"kind": "pre-game", "season": season, "through": through.isoformat(),
            "games": games, "sourceSnapshot": ruler_head}
    return meta, rows


# ------------------------------------------------------------------ sides


def _side_rows(cur, game_id: str, team_id: int) -> list[dict]:
    cur.execute(
        """
        SELECT s.game_id, s.game_event_id, g.game_date, t.name, g.home_abbrev,
               g.visitor_abbrev, s.player_id, p.name, s.period, s.minutes_remaining,
               s.seconds_remaining, s.made, s.point_value, s.zone_basic, s.zone_area,
               s.zone_range, s.distance_ft, s.loc_x, s.loc_y
        FROM shot s
        JOIN game g USING (game_id)
        JOIN team t ON t.team_id = s.team_id
        JOIN player p ON p.player_id = s.player_id
        WHERE s.game_id = %s AND s.team_id = %s
        """,
        (game_id, team_id),
    )
    return [
        tp.observed_row(
            game_id=gid, game_event_id=event_id, game_date=game_date.isoformat(),
            team_name=team_name, htm=htm, vtm=vtm, player_id=player_id,
            player_name=player_name, period=period, minutes_remaining=minutes,
            seconds_remaining=seconds, made=made, point_value=point_value,
            zone_basic=zone_basic, zone_area=zone_area, zone_range=zone_range,
            distance_ft=distance_ft, loc_x=loc_x, loc_y=loc_y,
        )
        for (gid, event_id, game_date, team_name, htm, vtm, player_id, player_name,
             period, minutes, seconds, made, point_value, zone_basic, zone_area,
             zone_range, distance_ft, loc_x, loc_y) in cur.fetchall()
    ]


def _appeared(line: dict) -> bool:
    """A box line that records an appearance: minutes on the clock, or any
    counting stat (a line with neither is a DNP and carries nothing)."""
    minutes = (line["minutes"] or "").strip()
    played = minutes not in ("", "0:00", "00:00", "PT00M00.00S")
    return played or any(line[k] for k in ("points", "fga", "fta", "reb", "ast"))


def build_side(cur, game_id: str, team: dict, actions: list[dict],
               parsed: dsc.ParsedGame, season: str, season_type: str) -> dict:
    team_id = team["teamId"]
    rows = _side_rows(cur, game_id, team_id)
    cur.execute(
        "SELECT b.player_id, p.name, b.minutes, b.points, b.fgm, b.fga, b.tpm, b.tpa,"
        " b.ftm, b.fta, b.reb, b.ast FROM box_score_line b"
        " JOIN player p USING (player_id)"
        " WHERE b.game_id = %s AND b.team_id = %s ORDER BY b.player_id",
        (game_id, team_id),
    )
    cols = ("playerId", "name", "minutes", "points", "fgm", "fga", "tpm", "tpa",
            "ftm", "fta", "reb", "ast")
    lines = [dict(zip(cols, r)) for r in cur.fetchall()]
    if not lines:
        fail(f"game {game_id}: no box lines for {team['tricode']} — load the corpus")
    if not rows:
        fail(f"game {game_id}: no shot rows for {team['tricode']} — load its shots "
             f"(the team season pull, or ingestion/load_team_games.py for an opponent)")
    tp.reconcile_box(rows, {game_id: {ln["playerId"]: ln["fga"] for ln in lines}})

    conflict = lambda r: (r["zone_basic"] in THREE) != (r["point_value"] == 3)  # noqa: E731
    by_player: dict[int, list[dict]] = {}
    for r in rows:
        by_player.setdefault(r["player_id"], []).append(r)

    # Assist statuses: the grammar's classification per shooter over his
    # PRE-DROP rows (conflicts included, so the bound below sees every make).
    status: dict[int, str] = {}
    for pid, prow in by_player.items():
        classified = dsc.classify_rows(
            [{"gameId": r["game_id"], "gameEventId": r["game_event_id"], "period": r["period"],
              "minutesRemaining": r["minutes_remaining"],
              "secondsRemaining": r["seconds_remaining"], "made": r["made"],
              "pointValue": r["point_value"]} for r in prow],
            {game_id: parsed}, pid)
        for r, c in zip(prow, classified):
            status[r["game_event_id"]] = c["assistStatus"]
    assisted = sum(status[r["game_event_id"]] == "assisted" for r in rows)
    unknown_makes = sum(r["made"] and status[r["game_event_id"]] == "unknown" for r in rows)
    if not assisted <= team["assists"] <= assisted + unknown_makes:
        fail(f"game {game_id} {team['tricode']}: assist statuses ({assisted} assisted, "
             f"{unknown_makes} unknown makes) cannot reconcile to the box's "
             f"{team['assists']} assists")

    # Trips, technicals, and splits per player by the derive's own grammar.
    made_ids: dict[int, set[int]] = {}
    for r in rows:
        if r["made"] and not conflict(r):
            made_ids.setdefault(r["player_id"], set()).add(r["game_event_id"])
    trips: list[tuple[int, dict]] = []
    players: list[dict] = []
    for ln in lines:
        pid = ln["playerId"]
        tech_ftm = tech_fta = split_ftm = split_fta = 0
        player_trips: list = []
        if ln["fta"] > 0:
            (player_trips, tech_ftm, tech_fta,
             split_ftm, split_fta) = df.reconstruct_game_trips(
                game_id, actions, pid, made_ids.get(pid, set()))
        trip_ftm = sum(t.ftm for t in player_trips)
        trip_fta = sum(t.fta for t in player_trips)
        if (trip_ftm + tech_ftm + split_ftm, trip_fta + tech_fta + split_fta) != (ln["ftm"], ln["fta"]):
            fail(f"game {game_id} player {pid}: free-throw line does not reconcile with "
                 f"the box ({trip_ftm}+{tech_ftm}+{split_ftm} of {trip_fta}+{tech_fta}+"
                 f"{split_fta} vs {ln['ftm']}-{ln['fta']})")
        fg_points = sum(r["point_value"] for r in by_player.get(pid, []) if r["made"])
        if fg_points + trip_ftm + tech_ftm + split_ftm != ln["points"]:
            fail(f"game {game_id} player {pid}: receipt identity broken — FG {fg_points} + "
                 f"trips {trip_ftm} + technical {tech_ftm} + split {split_ftm} != box "
                 f"points {ln['points']}")
        for t in player_trips:
            trips.append((t.first_ft_index, {
                "gameId": game_id, "period": t.period, "clock": t.clock,
                "tripClass": t.trip_class, "ftm": t.ftm, "fta": t.fta,
                "shotId": t.shot_id, "playerId": pid,
            }))
        if _appeared(ln):
            players.append({**ln, "technicalFtm": tech_ftm, "technicalFta": tech_fta,
                            "splitFtm": split_ftm, "splitFta": split_fta})
    points = sum(ln["points"] for ln in lines)
    if team["points"] is not None and points != team["points"]:
        fail(f"game {game_id} {team['tricode']}: player points ({points}) != the box "
             f"team line ({team['points']})")

    shots: list[dict] = []
    conflicts: list[dict] = []
    for r in sorted(rows, key=tp.chronological_key):
        if conflict(r):
            conflicts.append({
                "gameEventId": r["game_event_id"], "playerId": r["player_id"],
                "period": r["period"], "minutesRemaining": r["minutes_remaining"],
                "secondsRemaining": r["seconds_remaining"], "made": r["made"],
                "pointValue": r["point_value"], "zoneBasic": r["zone_basic"],
            })
            continue
        opponent, home = dp.matchup(r["team_name"], r["htm"], r["vtm"])
        shots.append({
            "gameId": r["game_id"], "gameEventId": r["game_event_id"],
            "gameDate": r["game_date"], "opponent": opponent, "home": home,
            "period": r["period"], "minutesRemaining": r["minutes_remaining"],
            "secondsRemaining": r["seconds_remaining"], "made": r["made"],
            "pointValue": r["point_value"], "zoneBasic": r["zone_basic"],
            "zoneArea": r["zone_area"], "zoneRange": r["zone_range"],
            "distanceFt": r["distance_ft"], "locX": r["loc_x"], "locY": r["loc_y"],
            "playerId": r["player_id"], "assistStatus": status[r["game_event_id"]],
        })

    source = (_head_path(cur, rs.scope_key(TEAM_GAME_SOURCE, season=season,
                                           season_type=season_type, game_id=game_id,
                                           team_id=team_id))
              or _head_path(cur, rs.scope_key(TEAM_SOURCE, season=season,
                                              season_type=season_type, team_id=team_id)))
    if source is None:
        fail(f"game {game_id} {team['tricode']}: no recorded shot source for the side")
    return {
        "teamId": team_id,
        "tricode": team["tricode"],
        "team": team["name"],
        "home": team["home"],
        "box": {
            "points": points,
            "fgm": sum(ln["fgm"] for ln in lines), "fga": sum(ln["fga"] for ln in lines),
            "tpm": sum(ln["tpm"] for ln in lines), "tpa": sum(ln["tpa"] for ln in lines),
            "ftm": sum(ln["ftm"] for ln in lines), "fta": sum(ln["fta"] for ln in lines),
            "ast": team["assists"],
        },
        "sourceShotSnapshot": source,
        "players": players,
        "shots": shots,
        "zoneConflicts": conflicts,
        "trips": [t for _, t in sorted(trips, key=lambda x: x[0])],
    }


# ------------------------------------------------------------------- game


def export_game(conn, team: str, game_id: str) -> dict:
    with conn.cursor() as cur:
        cur.execute("SELECT team_id FROM team WHERE name = %s", (team,))
        hits = cur.fetchall()
        if len(hits) != 1:
            fail(f"expected exactly one team named {team!r}, found {len(hits)}")
        team_id = hits[0][0]
        cur.execute("SELECT game_date, season, season_type FROM game WHERE game_id = %s",
                    (game_id,))
        row = cur.fetchone()
        if row is None:
            fail(f"game {game_id} is not in the store")
        game_date, season, season_type = row
        if game_date is None:
            fail(f"game {game_id}: no loaded source states its date")

        cur.execute("SELECT game_date, team_a_id, team_b_id FROM league_game"
                    " WHERE game_id = %s", (game_id,))
        logged = cur.fetchone()
        if logged is None:
            fail(f"game {game_id} is not in the league game log — load a newer log")
        cur.execute("SELECT b.team_id, b.home, b.tricode, b.assists, b.points, t.name"
                    " FROM box_team_line b JOIN team t USING (team_id)"
                    " WHERE b.game_id = %s", (game_id,))
        teams = {r[0]: {"teamId": r[0], "home": r[1], "tricode": r[2], "assists": r[3],
                        "points": r[4], "name": r[5]} for r in cur.fetchall()}
        if team_id not in teams or len(teams) != 2:
            fail(f"game {game_id}: box team lines missing or not {team}'s game")
        subject = teams.pop(team_id)
        opponent = next(iter(teams.values()))
        if logged != (game_date, *sorted((team_id, opponent["teamId"]))):
            fail(f"game {game_id}: the league game log ({logged}) disagrees with the "
                 f"store's date and box teams ({game_date}, {team_id} v {opponent['teamId']})")

        pbp_path = _head_path(cur, rs.scope_key("play-by-play", game_id=game_id))
        box_path = _head_path(cur, rs.scope_key("box-score", game_id=game_id))
        if pbp_path is None or box_path is None:
            fail(f"game {game_id}: its pbp/box pair is not loaded")
        actions = lgc.fetch_game_actions(cur, game_id)
        cur.execute(
            "SELECT action_number, clock, period, team_id, person_id, shot_result,"
            " description, shot_value FROM pbp_event"
            " WHERE game_id = %s AND is_field_goal = 1 ORDER BY source_row", (game_id,))
        fg_actions = [
            {"isFieldGoal": 1, "actionNumber": an, "clock": clock or "", "period": period or 0,
             "teamId": tid or 0, "personId": pid or 0, "shotResult": result or "",
             "description": desc or "", "shotValue": value or 0}
            for an, clock, period, tid, pid, result, desc, value in cur.fetchall()
        ]
        parsed = dsc.parse_actions(game_id, fg_actions,
                                   {subject["teamId"]: subject["assists"],
                                    opponent["teamId"]: opponent["assists"]})

        ruler, baseline_rows = resolve_ruler(cur, season, season_type, game_date)
        sides = [build_side(cur, game_id, t, actions, parsed, season, season_type)
                 for t in (subject, opponent)]

    return {
        "_meta": {
            "schemaVersion": SCHEMA_VERSION,
            "gameId": game_id,
            "gameDate": game_date.isoformat(),
            "season": season,
            "seasonType": season_type,
            "teamId": subject["teamId"],
            "tricode": subject["tricode"],
            "opponentTeamId": opponent["teamId"],
            "opponentTricode": opponent["tricode"],
            "home": subject["home"],
            "ruler": ruler,
            "sourcePlayByPlay": pbp_path,
            "sourceBoxScore": box_path,
        },
        "sides": sides,
        "zoneBaseline": tp.rollup_baseline(baseline_rows),
    }


def check_subject_slice(game: dict, team_payload: dict) -> None:
    """The subject's shots equal the team shot payload's slice for the game,
    field for field and in order (the two grammars over one set of rows)."""
    game_id = game["_meta"]["gameId"]
    ours = [{k: v for k, v in s.items() if k != "assistStatus"}
            for s in game["sides"][0]["shots"]]
    theirs = [{k: v for k, v in s.items() if k != "playerName"}
              for s in team_payload["shots"] if s["gameId"] == game_id]
    if ours != theirs:
        fail(f"game {game_id}: the subject's shots ({len(ours)}) differ from the team "
             f"shot payload's slice ({len(theirs)})")


# ------------------------------------------------------------------ season


def index_row(game: dict) -> dict:
    meta = game["_meta"]
    subject, opponent = game["sides"]
    ruler = {k: v for k, v in meta["ruler"].items() if k != "sourceSnapshot"}
    return {
        "gameId": meta["gameId"],
        "slug": game_slug(meta["gameDate"], meta["opponentTricode"]),
        "gameDate": meta["gameDate"],
        "opponent": meta["opponentTricode"],
        "home": meta["home"],
        "teamScore": subject["box"]["points"],
        "opponentScore": opponent["box"]["points"],
        "box": subject["box"],
        "ruler": {**ruler, "zoneBaseline": game["zoneBaseline"]},
    }


def payload_text(payload: dict) -> str:
    return json.dumps(payload, indent=2)


def write_immutable(path: Path, text: str, *, allow_rewrite: bool,
                    published: Path | None = None) -> str:
    """Write a game file once. Identical bytes are a no-op; different bytes
    over a published file refuse unless the caller is a reviewed correction.
    `published` names the copy to compare against when it lives elsewhere
    (the season loop exports into data/derived, ADR-0091); it defaults to
    `path` itself."""
    current = published or path
    if current.exists():
        if current.read_text(encoding="utf-8") == text:
            return "unchanged"
        if not allow_rewrite:
            fail(f"{current} is published and would change — game files are immutable; "
                 f"a correction travels by PR with a note (--allow-rewrite)")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="\n")
        return "rewritten"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
    return "written"


def export_season(conn, team: str, season: str, out_dir: Path, *,
                  season_type: str = "Regular Season", allow_rewrite: bool = False,
                  published_dir: Path | None = None) -> dict:
    """Every game of the team shot payload's game set, then the index.
    Returns {written, unchanged, rewritten} counts.

    With `published_dir` (the season loop, ADR-0091), each game is checked
    against the published season directory instead of out_dir, and out_dir
    receives only what a sync must copy: the index, plus the games with no
    published file. A published game whose bytes would change still refuses."""
    team_payload = etp.export_payload(conn, team, season, season_type)
    # Chronological already (ADR-0082), so first appearance is game order.
    game_ids = list(dict.fromkeys(s["gameId"] for s in team_payload["shots"]))
    counts = {"written": 0, "unchanged": 0, "rewritten": 0}
    rows = []
    for game_id in game_ids:
        game = export_game(conn, team, game_id)
        check_subject_slice(game, team_payload)
        name = Path("games") / f"{game_id}.json"
        outcome = write_immutable(out_dir / name, payload_text(game),
                                  allow_rewrite=allow_rewrite,
                                  published=published_dir / name if published_dir else None)
        counts[outcome] += 1
        rows.append(index_row(game))
    pm = team_payload["_meta"]
    index = {
        "_meta": {
            "schemaVersion": INDEX_SCHEMA_VERSION,
            "team": pm["team"],
            "teamId": pm["teamId"],
            "tricode": pm["tricode"],
            "season": pm["season"],
            "seasonType": pm["seasonType"],
            "dataThrough": pm["dataThrough"],
            "gamesIncluded": len(rows),
        },
        "games": rows,
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "index.json").write_text(payload_text(index), encoding="utf-8", newline="\n")
    return counts


def load_season_sources(conn, team: str, season: str, raw_root: Path, *,
                        team_snapshot: Path, roster_snapshot: Path) -> None:
    """Load everything a team season's game payloads read into a store: the
    subject's pbp/box pairs, its season team pull and roster, the opponents'
    one-day pulls for its games, and the season's rulers and game log. The
    scratch-store path (--scratch) and the tests; production loads run from
    main against the record store, where the loaders' heads already exist."""
    import load_rulers as lr
    import load_team_games as ltg
    import load_team_season as lts

    rs.apply_migrations(conn)
    meta, shots, _ = tp.validate_team_snapshot(json.loads(team_snapshot.read_text(encoding="utf-8")))
    game_ids = sorted({str(g) for g in shots["GAME_ID"]})
    lgc.load_game_pairs(conn, game_ids, raw_root=raw_root)
    lts.load_team_season(conn, team_snapshot, roster_snapshot)
    tricode = tp.tricode_of(team)
    opponents = [p for p in ltg.opponent_snapshots(raw_root, season, tricode)
                 if p.parent.name in set(game_ids)]
    missing = sorted(set(game_ids) - {p.parent.name for p in opponents})
    if missing:
        fail(f"{len(missing)} game(s) have no opponent one-day pull: {missing[:5]} — run "
             f"ingestion/pull_opponent_games.py --team {tricode.lower()} --season {season}")
    ltg.load_team_games(conn, opponents)
    lr.load_rulers(conn, lr.latest_rulers(raw_root, season), lr.latest_game_log(raw_root, season))


def main() -> None:
    ap = argparse.ArgumentParser(description="Export game payloads and the season index.")
    ap.add_argument("--team", default="Utah Jazz")
    ap.add_argument("--season", help="export every game of the team season, plus the index")
    ap.add_argument("--season-type", default="Regular Season")
    ap.add_argument("--game-id", help="export one game")
    ap.add_argument("--out-dir", help="season mode: the season directory "
                                      "(public/data/_teams/<tricode>/<season>)")
    ap.add_argument("--out-file", help="game mode: write the payload here")
    ap.add_argument("--verify-against", help="game mode: compare byte-for-byte")
    ap.add_argument("--allow-rewrite", action="store_true",
                    help="a reviewed correction: rewrite published game files that changed")
    ap.add_argument("--db-url", help="Postgres DSN (default: NBA_DB_URL)")
    ap.add_argument("--scratch", action="store_true",
                    help="season mode: load the season's sources into a throwaway Dockerized "
                         "Postgres first (the deployed team payload's own snapshots), verify "
                         "the team export against the deployed copy, then export")
    ap.add_argument("--raw-root", default="data/raw")
    args = ap.parse_args()

    if args.scratch:
        if not (args.season and args.out_dir):
            fail("--scratch needs --season and --out-dir")
        import ephemeral_pg

        tricode = tp.tricode_of(args.team).lower()
        deployed = Path("public/data/_teams") / tricode / f"{args.season}.json"
        dmeta = json.loads(deployed.read_text(encoding="utf-8"))["_meta"]
        dsn, container = ephemeral_pg.start()
        try:
            with rs.connect(dsn) as conn:
                load_season_sources(conn, args.team, args.season, Path(args.raw_root),
                                    team_snapshot=Path(dmeta["sourceSnapshot"]),
                                    roster_snapshot=Path(dmeta["rosterSnapshot"]))
                team_text = etp.payload_text(etp.export_payload(conn, args.team, args.season,
                                                                args.season_type))
                if team_text != deployed.read_text(encoding="utf-8"):
                    fail(f"the scratch store's team export differs from {deployed} — the "
                         f"game files would not match the deployed season")
                counts = export_season(conn, args.team, args.season, Path(args.out_dir),
                                       season_type=args.season_type,
                                       allow_rewrite=args.allow_rewrite)
        finally:
            ephemeral_pg.stop(container)
        print(f"{args.team} {args.season} (scratch store): {sum(counts.values())} games "
              f"({counts['written']} written, {counts['unchanged']} unchanged, "
              f"{counts['rewritten']} rewritten) + index -> {args.out_dir}")
        return

    with rs.connect(rs.resolve_dsn(args.db_url)) as conn:
        if args.season:
            if not args.out_dir:
                fail("season mode needs --out-dir")
            counts = export_season(conn, args.team, args.season, Path(args.out_dir),
                                   season_type=args.season_type,
                                   allow_rewrite=args.allow_rewrite)
            print(f"{args.team} {args.season}: {sum(counts.values())} games "
                  f"({counts['written']} written, {counts['unchanged']} unchanged, "
                  f"{counts['rewritten']} rewritten) + index -> {args.out_dir}")
            return
        if not args.game_id:
            fail("pass --season (with --out-dir) or --game-id")
        game = export_game(conn, args.team, args.game_id)
    text = payload_text(game)
    if args.verify_against:
        committed = Path(args.verify_against).read_text(encoding="utf-8")
        if text != committed:
            fail(f"differs from {args.verify_against}")
        print(f"PARITY OK: export matches {args.verify_against}")
    if args.out_file:
        out = Path(args.out_file)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8", newline="\n")
        print(f"exported -> {out}")


if __name__ == "__main__":
    main()
