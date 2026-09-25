"""The game ledger facts grammar (ADR-0084): one builder, two sources.

WHAT THIS IS: the exact box facts behind the Jazz surface's game ledger —
`public/data/_teams/<tricode>/<season>.ledger.json`. Per game: the matchup
(from the team shot payload's own rows), both scores, the team's field goal
and free throw lines, and the per-player lines of everyone who attempted a
field goal. Nothing derived: the decomposition per game is computed in the
browser by the unchanged aggregation over the team shot payload's rows
(ADR-0084), never persisted here.

`derive_ledger_facts.py` feeds this from raw box scores; `export_ledger_facts.py`
from the record store's box lines. Byte-identical output over the same
observations is the parity oracle.

THE ORACLES (hard-fail):
  - the ledger's game set IS the team shot payload's game set (built from
    it; a game without its box score fails);
  - the sum of the team's box FGA over the games equals the payload's
    totalShots + zoneConflictsDropped (the box oracle at season grain);
  - per game, the team's box FGA is at least the payload's post-drop rows.

Player identity is the id alone: names live in the team shot payload
(roster and rows), and only players WITH a field-goal attempt appear here,
so every ledger player has a name in the sibling payload by the box oracle.
Free-throw-only appearances stay in the team totals.
"""

from __future__ import annotations

import json
from pathlib import Path

SCHEMA_VERSION = 1


def fail(msg: str) -> None:
    raise SystemExit(f"ledger: {msg}")


def player_line(*, player_id: int, fgm: int, fga: int, ftm: int, fta: int, points: int) -> dict:
    return {"player_id": int(player_id), "fgm": int(fgm), "fga": int(fga),
            "ftm": int(ftm), "fta": int(fta), "points": int(points)}


def game_box(*, team_points: int, opponent_points: int, players: list[dict]) -> dict:
    """One game's box facts for the team's side, source-blind: both scores
    and every team player line (the builder filters and sorts)."""
    return {"team_points": int(team_points), "opponent_points": int(opponent_points),
            "players": players}


def game_box_from_box_game(box_game: dict, team_id: int, game_id: str) -> dict:
    """The builder's input from one raw BoxScoreTraditionalV3 game object."""
    if str(box_game.get("gameId", "")) != game_id:
        fail(f"box score is game {box_game.get('gameId')!r}, expected {game_id}")
    sides = {}
    for side in ("homeTeam", "awayTeam"):
        team = box_game.get(side)
        if not isinstance(team, dict):
            fail(f"game {game_id} box missing {side}")
        sides[int(team["teamId"])] = team
    if team_id not in sides or len(sides) != 2:
        fail(f"game {game_id} box has no side for team {team_id}")
    own = sides[team_id]
    other = next(t for tid, t in sides.items() if tid != team_id)
    own_stats = own.get("statistics") or {}
    other_stats = other.get("statistics") or {}
    if own_stats.get("points") is None or other_stats.get("points") is None:
        fail(f"game {game_id} box lacks team points")
    players = []
    for p in own.get("players", []) or []:
        stats = p.get("statistics")
        if not isinstance(stats, dict):
            continue
        players.append(player_line(
            player_id=int(p["personId"]),
            fgm=int(stats.get("fieldGoalsMade") or 0),
            fga=int(stats.get("fieldGoalsAttempted") or 0),
            ftm=int(stats.get("freeThrowsMade") or 0),
            fta=int(stats.get("freeThrowsAttempted") or 0),
            points=int(stats.get("points") or 0),
        ))
    return game_box(team_points=int(own_stats["points"]),
                    opponent_points=int(other_stats["points"]), players=players)


def build_ledger(*, team_payload: dict, boxes: dict[str, dict], source_team_payload: str) -> dict:
    meta = team_payload["_meta"]
    games: dict[str, dict] = {}
    for s in team_payload["shots"]:
        facts = {"game_date": s["gameDate"], "opponent": s["opponent"], "home": s["home"]}
        if games.setdefault(s["gameId"], facts) != facts:
            fail(f"team payload game {s['gameId']} rows disagree on date/matchup")
    if not games:
        fail("team payload has no shots — nothing to ledger")

    rows: list[dict] = []
    total_fga = 0
    for game_id in sorted(games, key=lambda g: (games[g]["game_date"], g)):
        box = boxes.get(game_id)
        if box is None:
            fail(f"game {game_id} has no box score — every ledger game needs its pair")
        players = box["players"]
        fgm = sum(p["fgm"] for p in players)
        fga = sum(p["fga"] for p in players)
        ftm = sum(p["ftm"] for p in players)
        fta = sum(p["fta"] for p in players)
        post_drop_rows = sum(1 for s in team_payload["shots"] if s["gameId"] == game_id)
        if fga < post_drop_rows:
            fail(f"game {game_id}: box FGA {fga} < {post_drop_rows} payload rows")
        total_fga += fga
        shooters = sorted(
            (p for p in players if p["fga"] > 0),
            key=lambda p: (-p["points"], -p["fga"], p["player_id"]),
        )
        rows.append({
            "gameId": game_id,
            "gameDate": games[game_id]["game_date"],
            "opponent": games[game_id]["opponent"],
            "home": games[game_id]["home"],
            "teamScore": box["team_points"],
            "opponentScore": box["opponent_points"],
            "fgm": fgm, "fga": fga, "ftm": ftm, "fta": fta,
            "players": [
                {"playerId": p["player_id"], "fgm": p["fgm"], "fga": p["fga"],
                 "ftm": p["ftm"], "fta": p["fta"], "points": p["points"]}
                for p in shooters
            ],
        })

    expected = int(meta["totalShots"]) + int(meta["zoneConflictsDropped"])
    if total_fga != expected:
        fail(f"box FGA over the ledger's games ({total_fga}) != payload pre-drop total "
             f"({expected}) — the box oracle at season grain")
    if int(meta["gamesIncluded"]) != len(rows):
        fail(f"payload gamesIncluded {meta['gamesIncluded']} != {len(rows)} ledger games")
    if meta["dataThrough"] != rows[-1]["gameDate"]:
        fail(f"payload dataThrough {meta['dataThrough']} != last ledger game "
             f"{rows[-1]['gameDate']}")

    return {
        "_meta": {
            "schemaVersion": SCHEMA_VERSION,
            "team": meta["team"],
            "teamId": meta["teamId"],
            "tricode": meta["tricode"],
            "season": meta["season"],
            "seasonType": meta["seasonType"],
            "dataThrough": meta["dataThrough"],
            "gamesIncluded": len(rows),
            "sourceTeamPayload": source_team_payload,
        },
        "games": rows,
    }


def payload_text(payload: dict) -> str:
    return json.dumps(payload, indent=2)


def write_payload(out_path: Path, payload: dict) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(payload_text(payload), encoding="utf-8", newline="\n")
