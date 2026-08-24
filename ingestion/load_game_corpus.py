"""Load one hero-season's game corpus into the record store and rebuild the
trip derivation (ADR-0080, second slice).

WHAT THIS DOES:
  For a (player, season) already loaded by load_hero_season.py:
  1. Load the league season-totals artifact (Gate 5's season oracle) into
     league_season_totals, league-wide.
  2. Resolve the reconstruction universe: the hero's shot games plus any
     corpus game whose box score credits the hero a free-throw attempt (the
     shotless free-throw game, ADR-0054's remedy) — then load each game's
     latest pbp/box pair: every action into pbp_event (all players,
     game-owned and shared per ADR-0045), every box line into
     box_score_line. A game whose pair is already cataloged with rows in
     place is skipped, so overlapping heroes (three Jazz heroes share most
     of a corpus) re-load nothing.
  3. Rebuild ft_trip for the hero-season from pbp_event rows, running the
     UNMODIFIED derive_freethrow grammar over action dicts reconstructed in
     source order — plus every oracle the file derive runs: taxonomy
     totality, the per-game box-score line, and-one sibling linkage, Gate
     5's exact season-total reconciliation, and the FGA oracle. A store
     contradicting an oracle is never committed (single transaction).

  Change detection and --allow-changed behave exactly as load_hero_season.

USAGE:
  python ingestion/load_game_corpus.py --player "Cody Williams" --season 2025-26
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import derive_freethrow as df
import derive_payload as dp
import derive_shot_context as dsc
import load_hero_season as lhs
import record_store as rs
from derive_shot_context import _load, validate_game_pair

# The season encoded in the NBA's own game-id grammar: digit 3 is the season
# type, digits 4-5 the season start year. Read as observed encoding, used
# only for corpus-only games no season-scoped source has described.
GAME_ID_SEASON_TYPE = {"1": "Preseason", "2": "Regular Season", "4": "Playoffs", "5": "PlayIn"}


def season_of_game_id(game_id: str) -> tuple[str, str]:
    start = 2000 + int(game_id[3:5])
    season_type = GAME_ID_SEASON_TYPE.get(game_id[2])
    if season_type is None:
        sys.exit(f"load-corpus: game id {game_id} has unknown season-type digit")
    return f"{start}-{str(start + 1)[-2:]}", season_type


def latest_pair(raw_root: Path, game_id: str) -> tuple[Path, Path] | None:
    """The game's latest common pbp/box pull-date pair (the derive's rule)."""
    pbp_dir = raw_root / "play-by-play" / game_id
    box_dir = raw_root / "box-score" / game_id
    pbp = {p.name: p for p in pbp_dir.glob("*.json")} if pbp_dir.exists() else {}
    box = {p.name: p for p in box_dir.glob("*.json")} if box_dir.exists() else {}
    common = sorted(set(pbp) & set(box))
    if not common:
        return None
    return pbp[common[-1]], box[common[-1]]


def _int_or_none(value) -> int | None:
    return None if value is None or value == "" else int(value)


def load_game_corpus(
    conn,
    player: str,
    season: str,
    *,
    season_type: str = "Regular Season",
    raw_root: Path = Path("data/raw"),
    pairs: list[tuple[Path, Path]] | None = None,
    totals_path: Path | None = None,
    allow_changed: bool = False,
    allow_missing_games: bool = False,
) -> dict:
    totals_path = totals_path or df._latest_league_totals(raw_root, season)
    totals_artifact = _load(totals_path)
    headers, totals_rows, _ = df._league_totals_rows(totals_artifact, season)
    col = {name: headers.index(name)
           for name in ("PLAYER_ID", "PLAYER_NAME", "GP", "FGM", "FGA", "FTM", "FTA", "PTS")
           if name in headers}
    for name in ("PLAYER_ID", "PLAYER_NAME", "GP", "FGM", "FGA", "FTM", "FTA", "PTS"):
        if name not in col:
            sys.exit(f"load-corpus: league totals artifact missing column {name}")

    try:
        with conn.cursor() as cur:
            cur.execute("SELECT player_id FROM player WHERE name = %s", (player,))
            hits = cur.fetchall()
            if len(hits) != 1:
                sys.exit(f"load-corpus: expected exactly one player named {player!r}, "
                         f"found {len(hits)} — run load_hero_season.py first")
            player_id = hits[0][0]
            cur.execute(
                "SELECT DISTINCT s.game_id FROM shot s JOIN game g USING (game_id)"
                " WHERE s.player_id = %s AND g.season = %s AND g.season_type = %s",
                (player_id, season, season_type),
            )
            shot_games = {row[0] for row in cur.fetchall()}
            if not shot_games:
                sys.exit(f"load-corpus: no shots for {player!r} {season} in the store")

            cur.execute("INSERT INTO load_run (kind) VALUES ('game-corpus') RETURNING run_id")
            run_id = cur.fetchone()[0]
            totals_snap = lhs.catalog_snapshot(
                cur, "league-totals", totals_path, totals_artifact["_meta"]
            )
            cur.execute(
                "INSERT INTO load_run_snapshot (run_id, snapshot_id) VALUES (%s, %s)"
                " ON CONFLICT DO NOTHING", (run_id, totals_snap),
            )

            players = lhs.TableUpsert("player", ("player_id",))
            teams = lhs.TableUpsert("team", ("team_id",))
            games = lhs.TableUpsert("game", ("game_id",))
            # Keyed by list position (0004): actionNumbers repeat in real
            # games, and collapsing them loses observed events.
            pbp_events = lhs.TableUpsert("pbp_event", ("game_id", "source_row"))
            box_lines = lhs.TableUpsert("box_score_line", ("game_id", "player_id"))
            box_team_lines = lhs.TableUpsert("box_team_line", ("game_id", "team_id"))
            totals = lhs.TableUpsert(
                "league_season_totals", ("player_id", "season", "season_type")
            )

            cur.execute("SELECT player_id FROM player")
            known_players = {row[0] for row in cur.fetchall()}
            cur.execute("SELECT game_id FROM game")
            known_games = {row[0] for row in cur.fetchall()}
            cur.execute("SELECT team_id FROM team")
            known_teams = {row[0] for row in cur.fetchall()}

            def stage_team_data(box_game: dict, game_id: str, box_snap: int) -> None:
                """box_team_line rows for both sides, plus any team the team
                table has never named (a team no hero shoots for is observed
                only here; the composed city+name matches stats.nba.com's
                TEAM_NAME form, and change detection arbitrates if a shot
                snapshot ever disagrees)."""
                for side, home in (("homeTeam", True), ("awayTeam", False)):
                    team = box_game.get(side)
                    if not isinstance(team, dict):
                        sys.exit(f"load-corpus: game {game_id} box missing {side}")
                    stats = team.get("statistics")
                    if not isinstance(stats, dict):
                        sys.exit(f"load-corpus: game {game_id} box {side} missing statistics")
                    team_id = int(team["teamId"])
                    city = str(team.get("teamCity", "")).strip()
                    name = str(team.get("teamName", "")).strip()
                    composed = f"{city} {name}".strip()
                    # A truncated fixture can state no name; a team row is
                    # only created when a name is actually observed.
                    if team_id not in known_teams and composed:
                        teams.stage({"team_id": team_id, "name": composed,
                                     "snapshot_id": box_snap, "run_id": run_id})
                        known_teams.add(team_id)
                    box_team_lines.stage({
                        "game_id": game_id, "team_id": team_id, "home": home,
                        "city": city, "name": name,
                        "tricode": str(team.get("teamTricode", "")),
                        # -1 default so an absent assist total fails the
                        # CHECK loudly instead of loading as a silent zero.
                        "assists": int(stats.get("assists", -1)),
                        "points": _int_or_none(stats.get("points")),
                        "snapshot_id": box_snap, "run_id": run_id,
                    })

            for row in totals_rows:
                pid = int(row[col["PLAYER_ID"]])
                if pid not in known_players:
                    players.stage({"player_id": pid, "name": str(row[col["PLAYER_NAME"]]),
                                   "snapshot_id": totals_snap, "run_id": run_id})
                    known_players.add(pid)
                totals.stage({
                    "player_id": pid, "season": season, "season_type": season_type,
                    "gp": int(row[col["GP"]]), "fgm": int(row[col["FGM"]]),
                    "fga": int(row[col["FGA"]]), "ftm": int(row[col["FTM"]]),
                    "fta": int(row[col["FTA"]]), "pts": int(row[col["PTS"]]),
                    "snapshot_id": totals_snap, "run_id": run_id,
                })

            # Resolve the game list: explicit fixture pairs, or the raw
            # corpus — shot games plus the box-scan free-throw games.
            game_pairs: list[tuple[str, Path, Path]] = []
            if pairs is not None:
                for pbp_path, box_path in pairs:
                    game_id = str(_load(pbp_path).get("_meta", {}).get("game_id", ""))
                    if not game_id:
                        sys.exit(f"load-corpus: {pbp_path} has no _meta.game_id")
                    game_pairs.append((game_id, pbp_path, box_path))
            else:
                for game_id in sorted(shot_games):
                    pair = latest_pair(raw_root, game_id)
                    if pair is None:
                        if allow_missing_games:
                            continue
                        sys.exit(f"load-corpus: no pbp/box pair for game {game_id} "
                                 f"(Gate 4) — pull it first")
                    game_pairs.append((game_id, *pair))
                box_root = raw_root / "box-score"
                if box_root.exists():
                    for box_dir in sorted(p for p in box_root.iterdir() if p.is_dir()):
                        game_id = box_dir.name
                        if game_id in shot_games:
                            continue
                        pair = latest_pair(raw_root, game_id)
                        if pair is None:
                            continue  # unpaired: Gate 5 names any real gap
                        box_snapshot = _load(pair[1])
                        response = box_snapshot.get("response", {})
                        box_game = response.get("boxScoreTraditional")
                        if not isinstance(box_game, dict):
                            sys.exit(f"load-corpus: game {game_id} box snapshot has "
                                     f"no boxScoreTraditional")
                        _, fta = df._hero_box_line(box_game, player_id, game_id)
                        if fta > 0:
                            game_pairs.append((game_id, *pair))

            skipped = 0
            for game_id, pbp_path, box_path in game_pairs:
                rel = dp.repo_relative(pbp_path)
                cur.execute(
                    "SELECT s.snapshot_id FROM snapshot s WHERE s.path = %s AND EXISTS"
                    " (SELECT 1 FROM pbp_event e WHERE e.snapshot_id = s.snapshot_id)",
                    (rel,),
                )
                pbp_loaded = cur.fetchone() is not None
                cur.execute("SELECT 1 FROM box_team_line WHERE game_id = %s LIMIT 1",
                            (game_id,))
                team_lines_loaded = cur.fetchone() is not None
                if pbp_loaded and team_lines_loaded:
                    skipped += 1  # shared-corpus game another hero already loaded
                    continue
                box_snapshot = _load(box_path)
                if pbp_loaded:
                    # Team-line backfill (0003): events and player lines are
                    # already in the store — only the team grain is new.
                    box_game = box_snapshot.get("response", {}).get("boxScoreTraditional")
                    if not isinstance(box_game, dict):
                        sys.exit(f"load-corpus: game {game_id} box snapshot has "
                                 f"no boxScoreTraditional")
                    if str(box_game.get("gameId", "")) != game_id:
                        sys.exit(f"load-corpus: directory {game_id} != box game ID")
                    box_snap = lhs.catalog_snapshot(cur, "box-score", box_path,
                                                    box_snapshot["_meta"])
                    stage_team_data(box_game, game_id, box_snap)
                    continue
                pbp_snapshot = _load(pbp_path)
                pbp_game, box_game, parsed_id = validate_game_pair(pbp_snapshot, box_snapshot)
                if parsed_id != game_id:
                    sys.exit(f"load-corpus: directory {game_id} != parsed game ID {parsed_id}")
                pbp_snap = lhs.catalog_snapshot(cur, "play-by-play", pbp_path,
                                                pbp_snapshot["_meta"])
                box_snap = lhs.catalog_snapshot(cur, "box-score", box_path,
                                                box_snapshot["_meta"])
                stage_team_data(box_game, game_id, box_snap)
                cur.executemany(
                    "INSERT INTO load_run_snapshot (run_id, snapshot_id) VALUES (%s, %s)"
                    " ON CONFLICT DO NOTHING",
                    [(run_id, pbp_snap), (run_id, box_snap)],
                )

                if game_id not in known_games:
                    game_season, game_season_type = season_of_game_id(game_id)
                    games.stage({
                        "game_id": game_id,
                        "game_date": None,  # no source here states it
                        "season": game_season,
                        "season_type": game_season_type,
                        "home_abbrev": str(box_game["homeTeam"]["teamTricode"]),
                        "visitor_abbrev": str(box_game["awayTeam"]["teamTricode"]),
                        "snapshot_id": box_snap, "run_id": run_id,
                    })
                    known_games.add(game_id)

                actions = pbp_game.get("actions")
                if not isinstance(actions, list):
                    sys.exit(f"load-corpus: game {game_id} has no actions list")
                for idx, action in enumerate(actions):
                    if not isinstance(action, dict):
                        sys.exit(f"load-corpus: game {game_id} action {idx} not an object")
                    pbp_events.stage({
                        "game_id": game_id,
                        "action_number": int(action["actionNumber"]),
                        "source_row": idx,
                        "action_id": _int_or_none(action.get("actionId")),
                        "period": _int_or_none(action.get("period")),
                        "clock": action.get("clock"),
                        "action_type": action.get("actionType"),
                        "sub_type": action.get("subType"),
                        "description": action.get("description"),
                        "person_id": _int_or_none(action.get("personId")),
                        "team_id": _int_or_none(action.get("teamId")),
                        "is_field_goal": _int_or_none(action.get("isFieldGoal")),
                        "shot_result": action.get("shotResult"),
                        "shot_value": _int_or_none(action.get("shotValue")),
                        "shot_distance": (None if action.get("shotDistance") is None
                                          else float(action["shotDistance"])),
                        "x_legacy": _int_or_none(action.get("xLegacy")),
                        "y_legacy": _int_or_none(action.get("yLegacy")),
                        "location": action.get("location"),
                        "score_home": action.get("scoreHome"),
                        "score_away": action.get("scoreAway"),
                        "points_total": _int_or_none(action.get("pointsTotal")),
                        "snapshot_id": pbp_snap, "run_id": run_id,
                    })

                for side, home in (("homeTeam", True), ("awayTeam", False)):
                    team = box_game.get(side)
                    if not isinstance(team, dict):
                        sys.exit(f"load-corpus: game {game_id} box missing {side}")
                    team_id = int(team["teamId"])
                    for box_player in team.get("players", []) or []:
                        stats = box_player.get("statistics")
                        if not isinstance(stats, dict):
                            continue
                        pid = int(box_player["personId"])
                        if pid not in known_players:
                            name = (f"{box_player.get('firstName', '')} "
                                    f"{box_player.get('familyName', '')}").strip()
                            players.stage({"player_id": pid, "name": name or f"#{pid}",
                                           "snapshot_id": box_snap, "run_id": run_id})
                            known_players.add(pid)
                        box_lines.stage({
                            "game_id": game_id, "player_id": pid,
                            "team_id": team_id, "home": home,
                            "minutes": str(stats.get("minutes") or ""),
                            "points": int(stats.get("points") or 0),
                            "fgm": int(stats.get("fieldGoalsMade") or 0),
                            "fga": int(stats.get("fieldGoalsAttempted") or 0),
                            "tpm": int(stats.get("threePointersMade") or 0),
                            "tpa": int(stats.get("threePointersAttempted") or 0),
                            "ftm": int(stats.get("freeThrowsMade") or 0),
                            "fta": int(stats.get("freeThrowsAttempted") or 0),
                            "reb": int(stats.get("reboundsTotal") or 0),
                            "ast": int(stats.get("assists") or 0),
                            "snapshot_id": box_snap, "run_id": run_id,
                        })

            report: dict = {}
            changed_detail: list[str] = []
            for table in (players, teams, games, pbp_events, box_lines,
                          box_team_lines, totals):
                table.flush(cur, report, changed_detail)
            total_changed = sum(c["changed"] for c in report.values())
            if total_changed and not allow_changed:
                raise lhs.LoadHalt(
                    f"{total_changed} row(s) changed against current state. First diffs:\n  "
                    + "\n  ".join(changed_detail[:10])
                    + "\nRe-run with --allow-changed to accept them."
                )

            trip_summary = rebuild_ft_trips(
                cur, player_id, season, season_type, run_id,
                allow_missing_games=allow_missing_games,
            )
            report["ft_trip"] = trip_summary
            report["shot_context"] = rebuild_shot_context(
                cur, player_id, season, season_type, run_id,
                allow_missing_games=allow_missing_games,
            )
            cur.execute("UPDATE load_run SET report = %s WHERE run_id = %s",
                        (lhs.Jsonb(report), run_id))
        conn.commit()
        report["_skipped_games"] = skipped
        return report
    except BaseException:
        conn.rollback()
        raise


def rebuild_ft_trips(
    cur, player_id: int, season: str, season_type: str, run_id: int,
    *, allow_missing_games: bool = False,
) -> dict:
    """Delete-and-rebuild the hero-season's trips from stored pbp events,
    holding them to every oracle the file derive runs."""
    cur.execute(
        "SELECT s.game_id, s.game_event_id, s.made, s.zone_basic, s.point_value"
        " FROM shot s JOIN game g USING (game_id)"
        " WHERE s.player_id = %s AND g.season = %s AND g.season_type = %s",
        (player_id, season, season_type),
    )
    shot_rows = cur.fetchall()
    pre_drop_fga = len(shot_rows)
    made_ids: dict[str, set[int]] = {}
    post_drop_games: set[str] = set()
    for game_id, event_id, made, zone_basic, point_value in shot_rows:
        if (zone_basic in dp.THREE_POINT_ZONES) != (point_value == 3):
            continue  # zone-point conflict: not in the payload universe
        post_drop_games.add(game_id)
        if made:
            made_ids.setdefault(game_id, set()).add(event_id)

    cur.execute(
        "SELECT b.game_id, b.ftm, b.fta FROM box_score_line b"
        " JOIN game g USING (game_id)"
        " WHERE b.player_id = %s AND g.season = %s AND g.season_type = %s",
        (player_id, season, season_type),
    )
    box_by_game = {row[0]: (row[1], row[2]) for row in cur.fetchall()}
    ft_games = {game_id for game_id, (_, fta) in box_by_game.items() if fta > 0}

    universe = sorted(post_drop_games | ft_games)
    all_trips: list[tuple] = []
    technical_ftm = technical_fta = 0
    games_loaded = 0
    for game_id in universe:
        cur.execute(
            "SELECT action_number, period, clock, action_type, sub_type,"
            " description, person_id, team_id FROM pbp_event"
            " WHERE game_id = %s ORDER BY source_row",
            (game_id,),
        )
        rows = cur.fetchall()
        if not rows:
            if allow_missing_games:
                continue
            sys.exit(f"trips: no pbp events for game {game_id} (Gate 4) — "
                     f"load the corpus first")
        games_loaded += 1
        actions = [
            {"actionNumber": an, "period": period or 0, "clock": clock or "",
             "actionType": action_type, "subType": sub_type or "",
             "description": description or "", "personId": person_id or 0,
             "teamId": team_id or 0}
            for an, period, clock, action_type, sub_type, description,
                person_id, team_id in rows
        ]
        trips, game_tftm, game_tfta = df.reconstruct_game_trips(
            game_id, actions, player_id, made_ids.get(game_id, set())
        )
        box_ftm, box_fta = box_by_game.get(game_id, (0, 0))
        game_ftm = sum(t.ftm for t in trips) + game_tftm
        game_fta = sum(t.fta for t in trips) + game_tfta
        if (game_ftm, game_fta) != (box_ftm, box_fta):
            sys.exit(f"trips: game {game_id} reconstructed line {game_ftm}/{game_fta}"
                     f" != box-score line {box_ftm}/{box_fta}")
        technical_ftm += game_tftm
        technical_fta += game_tfta
        for t in trips:
            all_trips.append((
                t.game_id, actions[t.first_ft_index]["actionNumber"],
                t.first_ft_index, player_id, t.period, t.clock, t.trip_class,
                t.ftm, t.fta, t.shot_id, run_id,
            ))

    cur.execute(
        "SELECT ftm, fta, fga FROM league_season_totals"
        " WHERE player_id = %s AND season = %s AND season_type = %s",
        (player_id, season, season_type),
    )
    totals_row = cur.fetchone()
    if totals_row is None:
        sys.exit("trips: no league_season_totals row for the hero (Gate 5 oracle)")
    season_ftm, season_fta, season_fga = totals_row
    total_ftm = sum(t[7] for t in all_trips) + technical_ftm
    total_fta = sum(t[8] for t in all_trips) + technical_fta
    if not allow_missing_games and (total_ftm, total_fta) != (season_ftm, season_fta):
        sys.exit(f"trips: Gate 5 — reconstructed season line {total_ftm}/{total_fta}"
                 f" != league artifact {season_ftm}/{season_fta}")
    if season_fga != pre_drop_fga:
        sys.exit(f"trips: league artifact FGA {season_fga} != pre-drop season"
                 f" FGA {pre_drop_fga}")

    cur.execute(
        "DELETE FROM ft_trip WHERE player_id = %s AND game_id IN"
        " (SELECT game_id FROM game WHERE season = %s AND season_type = %s)",
        (player_id, season, season_type),
    )
    cur.executemany(
        "INSERT INTO ft_trip (game_id, first_ft_action, first_ft_row, player_id,"
        " period, clock, trip_class, ftm, fta, shot_game_event_id, run_id)"
        " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
        all_trips,
    )
    return {"rebuilt": len(all_trips), "technicalFtm": technical_ftm,
            "technicalFta": technical_fta, "gamesLoaded": games_loaded,
            "gamesInUniverse": len(universe)}


def rebuild_shot_context(
    cur, player_id: int, season: str, season_type: str, run_id: int,
    *, allow_missing_games: bool = False,
) -> dict:
    """Delete-and-rebuild the hero-season's shot_context rows from stored
    pbp events and box team lines, via the unmodified derive_shot_context
    grammar — including the exact per-team assist reconciliation (ADR-0046),
    which hard-fails inside parse_actions."""
    cur.execute(
        "SELECT s.game_id, s.game_event_id, s.period, s.minutes_remaining,"
        " s.seconds_remaining, s.made, s.point_value, s.zone_basic"
        " FROM shot s JOIN game g USING (game_id)"
        " WHERE s.player_id = %s AND g.season = %s AND g.season_type = %s"
        " ORDER BY s.source_row",
        (player_id, season, season_type),
    )
    shots = [
        {"gameId": game_id, "gameEventId": event_id, "period": period,
         "minutesRemaining": minutes, "secondsRemaining": seconds,
         "made": made, "pointValue": point_value}
        for game_id, event_id, period, minutes, seconds, made, point_value,
            zone_basic in cur.fetchall()
        if (zone_basic in dp.THREE_POINT_ZONES) == (point_value == 3)
    ]
    game_ids = sorted({s["gameId"] for s in shots})

    parsed_games: dict[str, dsc.ParsedGame] = {}
    for game_id in game_ids:
        cur.execute("SELECT team_id, assists FROM box_team_line WHERE game_id = %s",
                    (game_id,))
        official_assists = dict(cur.fetchall())
        cur.execute(
            "SELECT action_number, clock, period, team_id, person_id,"
            " shot_result, description, shot_value FROM pbp_event"
            " WHERE game_id = %s AND is_field_goal = 1 ORDER BY source_row",
            (game_id,),
        )
        fg_rows = cur.fetchall()
        if not official_assists or not fg_rows:
            if allow_missing_games:
                continue  # classify_rows marks the game's shots missingGame
            sys.exit(f"shot-context: game {game_id} missing corpus data (Gate 4)")
        actions = [
            {"isFieldGoal": 1, "actionNumber": action_number,
             "clock": clock or "", "period": period or 0,
             "teamId": team_id or 0, "personId": person_id or 0,
             "shotResult": shot_result or "", "description": description or "",
             "shotValue": shot_value or 0}
            for action_number, clock, period, team_id, person_id,
                shot_result, description, shot_value in fg_rows
        ]
        parsed_games[game_id] = dsc.parse_actions(game_id, actions, official_assists)

    rows = dsc.classify_rows(shots, parsed_games, player_id)
    cur.execute(
        "DELETE FROM shot_context WHERE player_id = %s AND game_id IN"
        " (SELECT game_id FROM game WHERE season = %s AND season_type = %s)",
        (player_id, season, season_type),
    )
    cur.executemany(
        "INSERT INTO shot_context (game_id, game_event_id, player_id,"
        " event_match, assist_status, assist_evidence, failure_reason, run_id)"
        " VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
        [(r["gameId"], r["gameEventId"], player_id, r["eventMatch"],
          r["assistStatus"], r["assistEvidence"], r["failureReason"], run_id)
         for r in rows],
    )
    matched = sum(r["eventMatch"] == "matched" for r in rows)
    return {"rebuilt": len(rows), "matched": matched,
            "gamesParsed": len(parsed_games), "gamesExpected": len(game_ids)}


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Load a hero-season's game corpus and rebuild its trips."
    )
    ap.add_argument("--player", default="Cody Williams")
    ap.add_argument("--season", default="2025-26")
    ap.add_argument("--season-type", default="Regular Season")
    ap.add_argument("--raw-root", default="data/raw")
    ap.add_argument("--totals-file", help="explicit league totals artifact path")
    ap.add_argument("--db-url", help="Postgres DSN (default: NBA_DB_URL)")
    ap.add_argument("--allow-changed", action="store_true")
    ap.add_argument("--allow-missing-games", action="store_true",
                    help="fixture/audit mode only; registered heroes enforce Gate 4")
    args = ap.parse_args()

    with rs.connect(rs.resolve_dsn(args.db_url)) as conn:
        rs.apply_migrations(conn)
        try:
            report = load_game_corpus(
                conn, args.player, args.season,
                season_type=args.season_type,
                raw_root=Path(args.raw_root),
                totals_path=Path(args.totals_file) if args.totals_file else None,
                allow_changed=args.allow_changed,
                allow_missing_games=args.allow_missing_games,
            )
        except lhs.LoadHalt as halt:
            sys.exit(f"load-corpus: HALT — {halt}")

    skipped = report.pop("_skipped_games", 0)
    trips = report.pop("ft_trip")
    context = report.pop("shot_context")
    print(f"corpus loaded for {args.player} {args.season} "
          f"({skipped} shared game(s) already in store)")
    for table, counts in report.items():
        print(f"  {table:<22} inserted={counts['inserted']:<7} "
              f"unchanged={counts['unchanged']:<7} changed={counts['changed']}")
    print(f"  ft_trip rebuilt: {trips['rebuilt']} trips over "
          f"{trips['gamesLoaded']}/{trips['gamesInUniverse']} games, "
          f"technicals {trips['technicalFtm']}/{trips['technicalFta']}")
    print(f"  shot_context rebuilt: {context['rebuilt']} rows "
          f"({context['matched']} matched) over "
          f"{context['gamesParsed']}/{context['gamesExpected']} games")


if __name__ == "__main__":
    main()
