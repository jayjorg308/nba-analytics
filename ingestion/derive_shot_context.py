"""Derive normalized Case 3 shot context from NBA Stats V3 game artifacts.

The raw source is one verbatim play-by-play response plus its box-score
validation sibling per game (ADRs 0046/0050). This module owns the strict
source parser and, later in the file, the total shot-context payload derive.
No raw NBA description crosses the derived seam (ADR-0048).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

AssistStatus = Literal["assisted", "unassisted", "notApplicable", "unknown"]
AssistEvidence = Literal[
    "descriptionCredit", "validatedAbsence", "notApplicable", "unavailable"
]
EventMatch = Literal[
    "matched", "missingGame", "missingEvent", "duplicateEvent", "contradiction"
]
FailureReason = Literal[
    "missingGame", "missingEvent", "duplicateEvent", "identityContradiction"
]

# v2: _meta.dataThrough/gamesIncluded — the reconciled frontier, copied from
#     the sibling shot payload (ADR-0058; v3 Phase 2).
SCHEMA_VERSION = 2
PBP_SOURCE = "NBA Stats PlayByPlayV3"
BOX_SOURCE = "NBA Stats BoxScoreTraditionalV3"

# An explicit scorer credit, not inferred creation (ADR-0041). Anchored at the
# end so ordinary description text containing "AST" cannot create a credit.
ASSIST_CREDIT = re.compile(r"\([^()]+\s+\d+\s+AST\)$")


def fail(message: str) -> None:
    sys.exit(f"derive_shot_context: {message}")


def _response(snapshot: dict, label: str) -> dict:
    response = snapshot.get("response")
    if not isinstance(response, dict):
        fail(f"{label} snapshot missing response object")
    return response


@dataclass(frozen=True)
class ParsedEvent:
    action_number: int
    clock: str
    period: int
    team_id: int
    person_id: int
    made: bool
    shot_value: int
    assist_status: AssistStatus
    assist_evidence: AssistEvidence


@dataclass(frozen=True)
class ParsedGame:
    game_id: str
    events_by_number: dict[int, tuple[ParsedEvent, ...]]


def _clock_parts(clock: str) -> tuple[int, int] | None:
    match = re.fullmatch(r"PT(?P<minutes>\d+)M(?P<seconds>\d+)(?:\.\d+)?S", clock)
    if not match:
        return None
    return int(match.group("minutes")), int(match.group("seconds"))


def validate_game_pair(
    play_by_play_snapshot: dict, box_score_snapshot: dict
) -> tuple[dict, dict, str]:
    """Validate a raw source pair's identity; return (pbp_game, box_game, game_id).

    Shared with the free-throw derive (ADR-0053) — the Gate 4 corpus has one
    identity discipline, not one per consumer.
    """
    pbp = _response(play_by_play_snapshot, "play-by-play")
    box = _response(box_score_snapshot, "box-score")
    pbp_game = pbp.get("game")
    box_game = box.get("boxScoreTraditional")
    if not isinstance(pbp_game, dict) or not isinstance(box_game, dict):
        fail("source response missing game/boxScoreTraditional object")

    game_id = str(pbp_game.get("gameId", ""))
    if not game_id or str(box_game.get("gameId", "")) != game_id:
        fail("play-by-play and box-score game IDs disagree")

    pbp_meta = play_by_play_snapshot.get("_meta")
    box_meta = box_score_snapshot.get("_meta")
    if not isinstance(pbp_meta, dict) or not isinstance(box_meta, dict):
        fail("source pair missing wrapper metadata")
    if str(pbp_meta.get("game_id", "")) != game_id:
        fail("play-by-play wrapper game ID disagrees with response")
    if str(box_meta.get("game_id", "")) != game_id:
        fail("box-score wrapper game ID disagrees with response")
    if pbp_meta.get("source") != PBP_SOURCE or box_meta.get("source") != BOX_SOURCE:
        fail("source pair has unexpected endpoint identity")
    pbp_date = str(pbp_meta.get("pull_date", ""))
    box_date = str(box_meta.get("pull_date", ""))
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", pbp_date) or pbp_date != box_date:
        fail("play-by-play and box-score pull dates disagree")
    return pbp_game, box_game, game_id


def parse_game(play_by_play_snapshot: dict, box_score_snapshot: dict) -> ParsedGame:
    """Parse one game and reconcile every explicit assist to the box score.

    The returned index preserves duplicate action numbers as multiple values;
    the shot join classifies those as source ambiguity rather than picking one
    (ADR-0036). Marker-free makes become unassisted only after the full-game
    parsed assist totals reconcile exactly (ADR-0041/0046).
    """
    pbp_game, box_game, game_id = validate_game_pair(
        play_by_play_snapshot, box_score_snapshot
    )

    official_assists: dict[int, int] = {}
    for side in ("homeTeam", "awayTeam"):
        team = box_game.get(side)
        if not isinstance(team, dict):
            fail(f"box score missing {side}")
        stats = team.get("statistics")
        if not isinstance(stats, dict):
            fail(f"box score {side} missing statistics")
        team_id = int(team.get("teamId", 0))
        if team_id <= 0 or team_id in official_assists:
            fail(f"box score has invalid or duplicated team ID {team_id}")
        official_assists[team_id] = int(stats.get("assists", -1))

    parsed_assists = {team_id: 0 for team_id in official_assists}
    by_number: dict[int, list[ParsedEvent]] = {}
    actions = pbp_game.get("actions")
    if not isinstance(actions, list):
        fail("play-by-play game missing actions")

    for raw in actions:
        if not isinstance(raw, dict) or int(raw.get("isFieldGoal", 0)) != 1:
            continue
        action_number = int(raw.get("actionNumber", -1))
        team_id = int(raw.get("teamId", 0))
        if action_number < 0 or team_id not in official_assists:
            fail(f"field-goal event has invalid action/team identity: {raw!r}")
        result = str(raw.get("shotResult", ""))
        if result not in ("Made", "Missed"):
            fail(f"action {action_number} has unknown shotResult {result!r}")
        made = result == "Made"
        description = str(raw.get("description", ""))
        credited = bool(ASSIST_CREDIT.search(description)) if made else False
        if credited:
            parsed_assists[team_id] += 1

        event = ParsedEvent(
            action_number=action_number,
            clock=str(raw.get("clock", "")),
            period=int(raw.get("period", 0)),
            team_id=team_id,
            person_id=int(raw.get("personId", 0)),
            made=made,
            shot_value=int(raw.get("shotValue", 0)),
            assist_status=(
                "assisted" if credited else "unassisted" if made else "notApplicable"
            ),
            assist_evidence=(
                "descriptionCredit"
                if credited
                else "validatedAbsence"
                if made
                else "notApplicable"
            ),
        )
        by_number.setdefault(action_number, []).append(event)

    for team_id, expected in official_assists.items():
        actual = parsed_assists[team_id]
        if actual != expected:
            fail(
                f"game {game_id} team {team_id} parsed assists {actual} "
                f"!= official box-score assists {expected}"
            )

    return ParsedGame(
        game_id=game_id,
        events_by_number={number: tuple(events) for number, events in by_number.items()},
    )


def _failed_row(shot: dict, match: EventMatch, reason: FailureReason) -> dict:
    made = bool(shot["made"])
    return {
        "gameId": str(shot["gameId"]),
        "gameEventId": int(shot["gameEventId"]),
        "eventMatch": match,
        "assistStatus": "unknown" if made else "notApplicable",
        "assistEvidence": "unavailable" if made else "notApplicable",
        "failureReason": reason,
    }


def _event_agrees(shot: dict, event: ParsedEvent, player_id: int) -> bool:
    return (
        event.person_id == player_id
        and event.period == int(shot["period"])
        and _clock_parts(event.clock)
        == (int(shot["minutesRemaining"]), int(shot["secondsRemaining"]))
        and event.made == bool(shot["made"])
        and event.shot_value == int(shot["pointValue"])
    )


def derive(
    shot_payload: dict,
    game_snapshots: dict[str, tuple[dict, dict]],
    *,
    source_shot_payload: str,
) -> dict:
    """Derive one total normalized context row per sibling shot."""
    meta = shot_payload.get("_meta")
    shots = shot_payload.get("shots")
    if not isinstance(meta, dict) or not isinstance(shots, list):
        fail("shot payload missing _meta or shots")
    if int(meta.get("totalShots", -1)) != len(shots):
        fail("shot payload totalShots does not equal shots length")
    player_id = int(meta.get("playerId", 0))
    if player_id <= 0:
        fail("shot payload has invalid playerId")
    if "dataThrough" not in meta or "gamesIncluded" not in meta:
        fail("shot payload predates the frontier contract (no dataThrough/"
             "gamesIncluded) — re-run derive_payload.py first")

    parsed_games: dict[str, ParsedGame] = {}
    for game_id, (pbp, box) in sorted(game_snapshots.items()):
        parsed = parse_game(pbp, box)
        if parsed.game_id != game_id:
            fail(
                f"snapshot mapping key {game_id} != parsed game ID {parsed.game_id}"
            )
        parsed_games[game_id] = parsed
    expected_games = sorted({str(shot["gameId"]) for shot in shots})
    rows: list[dict] = []
    for shot in shots:
        game_id = str(shot["gameId"])
        game = parsed_games.get(game_id)
        if game is None:
            rows.append(_failed_row(shot, "missingGame", "missingGame"))
            continue
        events = game.events_by_number.get(int(shot["gameEventId"]), ())
        if not events:
            rows.append(_failed_row(shot, "missingEvent", "missingEvent"))
            continue
        if len(events) != 1:
            rows.append(_failed_row(shot, "duplicateEvent", "duplicateEvent"))
            continue
        event = events[0]
        if not _event_agrees(shot, event, player_id):
            rows.append(_failed_row(shot, "contradiction", "identityContradiction"))
            continue
        rows.append(
            {
                "gameId": game_id,
                "gameEventId": int(shot["gameEventId"]),
                "eventMatch": "matched",
                "assistStatus": event.assist_status,
                "assistEvidence": event.assist_evidence,
                "failureReason": None,
            }
        )

    match_values = ("matched", "missingGame", "missingEvent", "duplicateEvent", "contradiction")
    assist_values = ("assisted", "unassisted", "notApplicable", "unknown")
    source_games = []
    for game_id, (pbp, box) in sorted(game_snapshots.items()):
        pbp_meta = pbp.get("_meta", {})
        box_meta = box.get("_meta", {})
        source_games.append(
            {
                "gameId": game_id,
                "playByPlayPullDate": str(pbp_meta.get("pull_date", "")),
                "boxScorePullDate": str(box_meta.get("pull_date", "")),
            }
        )

    return {
        "_meta": {
            "schemaVersion": SCHEMA_VERSION,
            "player": str(meta.get("player", "")),
            "playerId": player_id,
            "season": str(meta.get("season", "")),
            # The reconciled frontier, copied from the sibling shot payload
            # (ADR-0058) — four-way equality by construction.
            "dataThrough": str(meta["dataThrough"]),
            "gamesIncluded": int(meta["gamesIncluded"]),
            "sourceShotPayload": source_shot_payload,
            "totalShots": len(shots),
            "gamesExpected": len(expected_games),
            "gamesLoaded": sum(game_id in parsed_games for game_id in expected_games),
            "eventMatchCounts": {
                value: sum(row["eventMatch"] == value for row in rows)
                for value in match_values
            },
            "assistStatusCounts": {
                value: sum(row["assistStatus"] == value for row in rows)
                for value in assist_values
            },
            "sourceGames": source_games,
        },
        "shots": rows,
    }


def _load(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"cannot read {path}: {exc}")


def load_game_snapshots(
    shot_payload: dict,
    raw_root: Path,
    *,
    allow_missing_games: bool,
) -> dict[str, tuple[dict, dict]]:
    game_ids = sorted({str(shot["gameId"]) for shot in shot_payload.get("shots", [])})
    snapshots: dict[str, tuple[dict, dict]] = {}
    missing: list[str] = []
    for game_id in game_ids:
        pbp_dir = raw_root / "play-by-play" / game_id
        box_dir = raw_root / "box-score" / game_id
        pbp_files = {path.name: path for path in pbp_dir.glob("*.json")} if pbp_dir.exists() else {}
        box_files = {path.name: path for path in box_dir.glob("*.json")} if box_dir.exists() else {}
        if not pbp_files and not box_files:
            missing.append(game_id)
            continue
        orphaned = sorted(set(pbp_files) ^ set(box_files))
        if orphaned:
            fail(f"game {game_id} has orphaned source snapshots: {', '.join(orphaned)}")
        pair_name = sorted(set(pbp_files) & set(box_files))[-1]
        snapshots[game_id] = (_load(pbp_files[pair_name]), _load(box_files[pair_name]))
    if missing and not allow_missing_games:
        fail(
            f"play-by-play gate failed: {len(missing)} games missing a canonical pair: "
            + ", ".join(missing)
        )
    return snapshots


def main() -> None:
    ap = argparse.ArgumentParser(description="Derive the normalized Case 3 shot context payload.")
    ap.add_argument("--shot-payload-file", required=True)
    ap.add_argument("--raw-root", default="data/raw")
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

    shot_path = Path(args.shot_payload_file)
    shot = _load(shot_path)
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

    payload = derive(shot, games, source_shot_payload=args.shot_payload_file)
    if args.out_file:
        out_path = Path(args.out_file)
    else:
        meta = payload["_meta"]
        slug = str(meta["player"]).lower().replace(" ", "-")
        dates = [game["playByPlayPullDate"] for game in meta["sourceGames"]]
        version_date = max(dates) if dates else "no-source-games"
        out_path = (
            Path(args.out_root)
            / slug
            / str(meta["season"])
            / "shot-context"
            / f"{version_date}.json"
        )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"derived shot context payload -> {out_path}")


if __name__ == "__main__":
    main()
