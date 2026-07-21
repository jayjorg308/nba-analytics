"""Derive the free-throw payload (fourth contract, ADR-0053) from the shared
Case 3 game corpus plus the league season-totals artifact (Gate 5, ADR-0054).

Trips are reconstructed from play-by-play free-throw events under a versioned
grammar, classified by their causing foul, and reconciled before persisting:
every hero free-throw event must classify into exactly one trip class or
technical (taxonomy totality), every game must match the hero's box-score
free-throw line, every and-one must link to a made shot in the sibling shot
payload, and the season must reconcile exactly with the league artifact's
hero line. A payload contradicting an oracle is never written.

LOCAL ONLY: run from a developer machine. The deployed app and CI consume
committed derived payloads and never call NBA endpoints.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

from derive_shot_context import _load, load_game_snapshots, validate_game_pair

SCHEMA_VERSION = 1
LEAGUE_TOTALS_SOURCE = "stats.nba.com leaguedashplayerstats (unofficial)"

# Pinned on both sides like the schema version: src/domain/freethrowPayload.ts
TRIP_CLASSES = (
    "shootingFoul2",
    "shootingFoul3",
    "bonus",
    "andOne",
    "flagrant",
    "awayFromPlay",
    "transitionTake",
    "clearPath",
)

# The versioned free-throw grammar (ADR-0053). The closed subtype vocabulary
# observed across the full 146-game corpus; anything outside it is drift.
FT_SUBTYPE = re.compile(
    r"Free Throw(?: (?P<kind>Technical|Flagrant|Clear Path))?"
    r"(?: (?P<n>\d) of (?P<m>\d))?"
)

SHOOTING_FOULS = frozenset({"Shooting"})
BONUS_FOULS = frozenset({"Personal", "Loose Ball", "Personal Take", "Double Personal"})

# Actions scanned backward from a trip's first free throw to find the causing
# foul and any and-one made shot; covers the interleaved substitutions and
# timeouts observed in the corpus (zero unresolved trips at this window).
FOUL_SEARCH_WINDOW = 12


def fail(message: str) -> None:
    sys.exit(f"derive_freethrow: {message}")


@dataclass(frozen=True)
class Trip:
    game_id: str
    period: int
    clock: str
    trip_class: str
    ftm: int
    fta: int
    shot_id: int | None


def _trip_context(
    actions: list, first_index: int, period: int, clock: str, player_id: int, hero_team: int
) -> tuple[dict | None, str | None]:
    """Find the trip's same-clock and-one made shot and causing opponent foul.

    Technical-family fouls and flopping never cause a trip's free throws, so
    they are skipped rather than accepted as the causing foul.
    """
    and_one_shot: dict | None = None
    foul_subtype: str | None = None
    for j in range(first_index - 1, max(-1, first_index - 1 - FOUL_SEARCH_WINDOW), -1):
        action = actions[j]
        if not isinstance(action, dict) or int(action.get("period", 0)) != period:
            break
        action_type = action.get("actionType")
        if (
            and_one_shot is None
            and action_type == "Made Shot"
            and int(action.get("personId", 0)) == player_id
            and str(action.get("clock", "")) == clock
        ):
            and_one_shot = action
        if (
            foul_subtype is None
            and action_type == "Foul"
            and str(action.get("clock", "")) == clock
            and int(action.get("teamId", 0)) != hero_team
        ):
            subtype = str(action.get("subType", ""))
            if "Technical" not in subtype and subtype != "Flopping":
                foul_subtype = subtype
        if and_one_shot is not None and foul_subtype is not None:
            break
    return and_one_shot, foul_subtype


def reconstruct_game_trips(
    game_id: str, actions: list, player_id: int, made_shot_ids: set[int]
) -> tuple[list[Trip], int, int]:
    """Reconstruct one game's hero trips plus its technical free-throw line."""
    hero_team = 0
    for action in actions:
        if (
            isinstance(action, dict)
            and int(action.get("personId", 0)) == player_id
            and int(action.get("teamId", 0))
        ):
            hero_team = int(action["teamId"])
            break

    groups: dict[tuple[int, str, str], list[tuple[int, bool, int, int]]] = {}
    technical_ftm = technical_fta = 0
    for index, action in enumerate(actions):
        if not isinstance(action, dict) or action.get("actionType") != "Free Throw":
            continue
        if int(action.get("personId", 0)) != player_id:
            continue
        subtype = str(action.get("subType", ""))
        match = FT_SUBTYPE.fullmatch(subtype)
        if not match:
            fail(
                f"game {game_id} action {action.get('actionNumber')}: "
                f"unknown free-throw subtype {subtype!r}"
            )
        description = str(action.get("description", ""))
        if "Free Throw" not in description:
            fail(
                f"game {game_id} action {action.get('actionNumber')}: "
                f"free-throw description grammar drift: {description!r}"
            )
        made = not description.startswith("MISS")
        kind = match.group("kind") or "regular"
        if kind == "Technical":
            # Technical free throws are never trips (CONTEXT.md): the shooter
            # is a designated taker, not the player who earned the visit.
            technical_fta += 1
            technical_ftm += int(made)
            continue
        if match.group("n") is None:
            fail(
                f"game {game_id} action {action.get('actionNumber')}: "
                f"non-technical free throw without an N-of-M sequence: {subtype!r}"
            )
        key = (int(action.get("period", 0)), str(action.get("clock", "")), kind)
        groups.setdefault(key, []).append(
            (index, made, int(match.group("n")), int(match.group("m")))
        )

    if groups and hero_team == 0:
        fail(f"game {game_id}: hero has free throws but no team identity")

    trips: list[Trip] = []
    for key in sorted(groups, key=lambda k: groups[k][0][0]):
        period, clock, kind = key
        events = groups[key]
        declared_sizes = {declared for (_, _, _, declared) in events}
        if len(declared_sizes) != 1:
            fail(f"game {game_id} P{period} {clock}: trip mixes declared sizes {sorted(declared_sizes)}")
        declared = declared_sizes.pop()
        numbers = sorted(number for (_, _, number, _) in events)
        if numbers != list(range(1, declared + 1)):
            fail(
                f"game {game_id} P{period} {clock}: partial or duplicated trip "
                f"sequence {numbers} of {declared} — investigate before persisting"
            )
        ftm = sum(1 for (_, made, _, _) in events if made)
        first_index = events[0][0]

        shot_id: int | None = None
        if kind == "Flagrant":
            trip_class = "flagrant"
        elif kind == "Clear Path":
            trip_class = "clearPath"
        else:
            and_one_shot, foul_subtype = _trip_context(
                actions, first_index, period, clock, player_id, hero_team
            )
            if declared == 1 and and_one_shot is not None:
                trip_class = "andOne"
                shot_id = int(and_one_shot.get("actionNumber", -1))
                if shot_id not in made_shot_ids:
                    fail(
                        f"game {game_id}: and-one linkage failed — made shot "
                        f"{shot_id} absent from the sibling shot payload "
                        f"(zone-conflict drop?)"
                    )
            elif foul_subtype in SHOOTING_FOULS and declared == 2:
                trip_class = "shootingFoul2"
            elif foul_subtype in SHOOTING_FOULS and declared == 3:
                trip_class = "shootingFoul3"
            elif foul_subtype in BONUS_FOULS and declared == 2:
                trip_class = "bonus"
            elif foul_subtype == "Away From Play" and declared == 1:
                trip_class = "awayFromPlay"
            elif foul_subtype == "Transition Take" and declared == 1:
                trip_class = "transitionTake"
            else:
                fail(
                    f"game {game_id} P{period} {clock}: unclassifiable trip "
                    f"(M={declared}, causing foul {foul_subtype!r}) — "
                    f"taxonomy totality (ADR-0053)"
                )
        trips.append(
            Trip(
                game_id=game_id,
                period=period,
                clock=clock,
                trip_class=trip_class,
                ftm=ftm,
                fta=declared,
                shot_id=shot_id,
            )
        )
    return trips, technical_ftm, technical_fta


def _hero_box_line(box_game: dict, player_id: int, game_id: str) -> tuple[int, int]:
    """The hero's official box-score free-throw line; 0/0 when no row exists
    (a nonzero reconstruction then fails the oracle loudly, never silently)."""
    for side in ("homeTeam", "awayTeam"):
        team = box_game.get(side)
        if not isinstance(team, dict):
            fail(f"game {game_id}: box score missing {side}")
        for player in team.get("players", []) or []:
            if not isinstance(player, dict) or int(player.get("personId", 0)) != player_id:
                continue
            stats = player.get("statistics")
            if not isinstance(stats, dict):
                fail(f"game {game_id}: hero box-score row missing statistics")
            try:
                return int(stats["freeThrowsMade"]), int(stats["freeThrowsAttempted"])
            except (KeyError, TypeError, ValueError) as exc:
                fail(f"game {game_id}: hero box-score free-throw line unreadable: {exc}")
    return 0, 0


def _league_totals_rows(league_snapshot: dict, season: str) -> tuple[list, list, str]:
    """Validate the Gate 5 season-totals artifact; return (headers, rows, pull date)."""
    lt_meta = league_snapshot.get("_meta")
    if not isinstance(lt_meta, dict):
        fail("league totals artifact missing _meta")
    if lt_meta.get("source") != LEAGUE_TOTALS_SOURCE:
        fail(f"league totals artifact has unexpected source {lt_meta.get('source')!r}")
    if str(lt_meta.get("season", "")) != season:
        fail(
            f"league totals artifact season {lt_meta.get('season')!r} "
            f"!= payload season {season!r}"
        )
    if lt_meta.get("per_mode") != "Totals":
        fail("league totals artifact is not Totals per-mode")
    pull_date = str(lt_meta.get("pull_date", ""))
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", pull_date):
        fail("league totals artifact has an invalid pull date")

    response = league_snapshot.get("response")
    result_sets = response.get("resultSets") if isinstance(response, dict) else None
    if not isinstance(result_sets, list) or not result_sets:
        fail("league totals artifact missing resultSets")
    result = result_sets[0]
    if not isinstance(result, dict) or result.get("name") != "LeagueDashPlayerStats":
        fail("league totals artifact first result set is not LeagueDashPlayerStats")
    headers = result.get("headers")
    rows = result.get("rowSet")
    if not isinstance(headers, list) or not isinstance(rows, list) or not rows:
        fail("league totals artifact has no headers/rows")
    return headers, rows, pull_date


def derive(
    shot_payload: dict,
    game_snapshots: dict[str, tuple[dict, dict]],
    league_totals: dict,
    *,
    source_shot_payload: str,
    source_league_totals: str,
) -> dict:
    """Derive the free-throw payload; every oracle breach is a hard fail."""
    meta = shot_payload.get("_meta")
    shots = shot_payload.get("shots")
    if not isinstance(meta, dict) or not isinstance(shots, list):
        fail("shot payload missing _meta or shots")
    if int(meta.get("totalShots", -1)) != len(shots):
        fail("shot payload totalShots does not equal shots length")
    player_id = int(meta.get("playerId", 0))
    if player_id <= 0:
        fail("shot payload has invalid playerId")
    season = str(meta.get("season", ""))
    pre_drop_fga = int(meta.get("totalShots", 0)) + int(meta.get("zoneConflictsDropped", 0))

    made_ids_by_game: dict[str, set[int]] = {}
    for shot in shots:
        if shot.get("made"):
            made_ids_by_game.setdefault(str(shot["gameId"]), set()).add(
                int(shot["gameEventId"])
            )
    expected_games = sorted({str(shot["gameId"]) for shot in shots})

    all_trips: list[Trip] = []
    technical_ftm = technical_fta = 0
    source_games: list[dict] = []
    for game_id, (pbp_snapshot, box_snapshot) in sorted(game_snapshots.items()):
        pbp_game, box_game, parsed_id = validate_game_pair(pbp_snapshot, box_snapshot)
        if parsed_id != game_id:
            fail(f"snapshot mapping key {game_id} != parsed game ID {parsed_id}")
        actions = pbp_game.get("actions")
        if not isinstance(actions, list):
            fail(f"game {game_id}: play-by-play game missing actions")
        trips, game_technical_ftm, game_technical_fta = reconstruct_game_trips(
            game_id, actions, player_id, made_ids_by_game.get(game_id, set())
        )
        box_ftm, box_fta = _hero_box_line(box_game, player_id, game_id)
        game_ftm = sum(trip.ftm for trip in trips) + game_technical_ftm
        game_fta = sum(trip.fta for trip in trips) + game_technical_fta
        if (game_ftm, game_fta) != (box_ftm, box_fta):
            fail(
                f"game {game_id}: reconstructed free-throw line {game_ftm}/{game_fta} "
                f"!= box-score line {box_ftm}/{box_fta}"
            )
        all_trips.extend(trips)
        technical_ftm += game_technical_ftm
        technical_fta += game_technical_fta
        source_games.append(
            {
                "gameId": game_id,
                "playByPlayPullDate": str(pbp_snapshot.get("_meta", {}).get("pull_date", "")),
                "boxScorePullDate": str(box_snapshot.get("_meta", {}).get("pull_date", "")),
            }
        )

    headers, rows, league_pull_date = _league_totals_rows(league_totals, season)
    column = {}
    for name in ("PLAYER_ID", "FTM", "FTA", "FGA", "PTS"):
        if name not in headers:
            fail(f"league totals artifact missing column {name}")
        column[name] = headers.index(name)
    hero_row = next(
        (row for row in rows if int(row[column["PLAYER_ID"]]) == player_id), None
    )
    if hero_row is None:
        fail(f"league totals artifact has no row for player {player_id}")
    season_ftm = int(hero_row[column["FTM"]])
    season_fta = int(hero_row[column["FTA"]])
    season_fga = int(hero_row[column["FGA"]])
    season_points = int(hero_row[column["PTS"]])

    total_ftm = sum(trip.ftm for trip in all_trips) + technical_ftm
    total_fta = sum(trip.fta for trip in all_trips) + technical_fta
    if (total_ftm, total_fta) != (season_ftm, season_fta):
        fail(
            f"free-throw gate (Gate 5): reconstructed season line "
            f"{total_ftm}/{total_fta} != league artifact line "
            f"{season_ftm}/{season_fta} — a game outside the corpus contained "
            f"free throws, or the grammar drifted"
        )
    if season_fga != pre_drop_fga:
        fail(
            f"league artifact FGA {season_fga} != shot payload pre-drop season "
            f"FGA {pre_drop_fga}"
        )

    league_ftm = sum(int(row[column["FTM"]]) for row in rows)
    league_fta = sum(int(row[column["FTA"]]) for row in rows)
    league_fga = sum(int(row[column["FGA"]]) for row in rows)
    league_points = sum(int(row[column["PTS"]]) for row in rows)

    return {
        "_meta": {
            "schemaVersion": SCHEMA_VERSION,
            "player": str(meta.get("player", "")),
            "playerId": player_id,
            "season": season,
            "sourceShotPayload": source_shot_payload,
            "sourceLeagueTotals": source_league_totals,
            "leagueTotalsPullDate": league_pull_date,
            "seasonFga": pre_drop_fga,
            "seasonPoints": season_points,
            "seasonFtm": total_ftm,
            "seasonFta": total_fta,
            "technicalFtm": technical_ftm,
            "technicalFta": technical_fta,
            "totalTrips": len(all_trips),
            "tripClassCounts": {
                trip_class: sum(1 for trip in all_trips if trip.trip_class == trip_class)
                for trip_class in TRIP_CLASSES
            },
            "gamesExpected": len(expected_games),
            "gamesLoaded": len(source_games),
            "sourceGames": source_games,
        },
        "trips": [
            {
                "gameId": trip.game_id,
                "period": trip.period,
                "clock": trip.clock,
                "tripClass": trip.trip_class,
                "ftm": trip.ftm,
                "fta": trip.fta,
                "shotId": trip.shot_id,
            }
            for trip in all_trips
        ],
        "leagueBaseline": {
            "ftm": league_ftm,
            "fta": league_fta,
            "fga": league_fga,
            "points": league_points,
        },
    }


def _latest_league_totals(raw_root: Path, season: str) -> Path:
    totals_dir = raw_root / "_league" / season / "totals"
    files = sorted(totals_dir.glob("*.json")) if totals_dir.exists() else []
    if not files:
        fail(
            f"no league season-totals artifact under {totals_dir} — "
            f"run: python ingestion/pull_league_totals.py --season {season}"
        )
    return files[-1]


def main() -> None:
    ap = argparse.ArgumentParser(description="Derive the free-throw payload (fourth contract).")
    ap.add_argument("--shot-payload-file", required=True)
    ap.add_argument("--raw-root", default="data/raw")
    ap.add_argument("--league-totals-file")
    ap.add_argument("--play-by-play-file")
    ap.add_argument("--box-score-file")
    ap.add_argument("--out-file")
    ap.add_argument("--out-root", default="data/derived")
    ap.add_argument(
        "--allow-missing-games",
        action="store_true",
        help="fixture/audit mode only; registered hero derives enforce Gate 4",
    )
    args = ap.parse_args()

    shot = _load(Path(args.shot_payload_file))
    season = str(shot.get("_meta", {}).get("season", ""))
    if bool(args.play_by_play_file) != bool(args.box_score_file):
        fail("--play-by-play-file and --box-score-file must be supplied together")
    if args.play_by_play_file:
        pbp = _load(Path(args.play_by_play_file))
        box = _load(Path(args.box_score_file))
        game_id = str(pbp.get("_meta", {}).get("game_id", ""))
        if not game_id:
            fail("explicit play-by-play fixture has no _meta.game_id")
        games = {game_id: (pbp, box)}
    else:
        games = load_game_snapshots(
            shot,
            Path(args.raw_root),
            allow_missing_games=args.allow_missing_games,
        )

    league_path = (
        Path(args.league_totals_file)
        if args.league_totals_file
        else _latest_league_totals(Path(args.raw_root), season)
    )
    league = _load(league_path)

    payload = derive(
        shot,
        games,
        league,
        source_shot_payload=args.shot_payload_file,
        source_league_totals=str(league_path).replace("\\", "/"),
    )
    if args.out_file:
        out_path = Path(args.out_file)
    else:
        payload_meta = payload["_meta"]
        slug = str(payload_meta["player"]).lower().replace(" ", "-")
        dates = [game["playByPlayPullDate"] for game in payload_meta["sourceGames"]]
        version_date = max(dates) if dates else "no-source-games"
        out_path = (
            Path(args.out_root)
            / slug
            / str(payload_meta["season"])
            / "freethrow"
            / f"{version_date}.json"
        )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"derived free-throw payload -> {out_path}")


if __name__ == "__main__":
    main()
