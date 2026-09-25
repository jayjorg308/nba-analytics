"""Export the game ledger facts from the record store (ADR-0084).

Reads the team shot payload the session just exported (the ledger's game
set), then the store's box team lines (both scores) and box player lines
(the team's lines), and hands them to ledger_facts.build_ledger — one
grammar with derive_ledger_facts.py, byte parity as the oracle.

USAGE:
  python ingestion/export_ledger_facts.py --team "Utah Jazz" --season 2026-27 --team-payload-file <exported team payload> --out-file <path>
  python ingestion/export_ledger_facts.py --team "Utah Jazz" --season 2025-26 --team-payload-file public/data/_teams/uta/2025-26.json --verify-against public/data/_teams/uta/2025-26.ledger.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import derive_payload as dp
import ledger_facts as lf
import record_store as rs


def fail(msg: str) -> None:
    sys.exit(f"export-ledger: {msg}")


def export_ledger(conn, team: str, season: str, team_payload_path: Path) -> dict:
    payload = json.loads(team_payload_path.read_text(encoding="utf-8"))
    meta = payload["_meta"]
    if meta["team"] != team or meta["season"] != season:
        fail(f"team payload is {meta['team']} {meta['season']}, requested {team} {season}")
    team_id = int(meta["teamId"])
    game_ids = sorted({s["gameId"] for s in payload["shots"]})
    boxes: dict[str, dict] = {}
    with conn.cursor() as cur:
        cur.execute(
            "SELECT game_id, team_id, points FROM box_team_line WHERE game_id = ANY(%s)",
            (game_ids,),
        )
        points: dict[str, dict[int, int | None]] = {}
        for game_id, tid, pts in cur.fetchall():
            points.setdefault(game_id, {})[tid] = pts
        cur.execute(
            "SELECT game_id, player_id, fgm, fga, ftm, fta, points FROM box_score_line"
            " WHERE team_id = %s AND game_id = ANY(%s)",
            (team_id, game_ids),
        )
        lines: dict[str, list[dict]] = {}
        for game_id, pid, fgm, fga, ftm, fta, pts in cur.fetchall():
            lines.setdefault(game_id, []).append(lf.player_line(
                player_id=pid, fgm=fgm, fga=fga, ftm=ftm, fta=fta, points=pts))
    for game_id in game_ids:
        sides = points.get(game_id)
        if not sides or team_id not in sides or len(sides) != 2:
            continue  # the builder names the missing game
        own = sides[team_id]
        other = next(p for tid, p in sides.items() if tid != team_id)
        if own is None or other is None:
            fail(f"game {game_id} box team lines lack points")
        boxes[game_id] = lf.game_box(team_points=own, opponent_points=other,
                                     players=lines.get(game_id, []))
    return lf.build_ledger(team_payload=payload, boxes=boxes,
                           source_team_payload=dp.repo_relative(team_payload_path))


payload_text = lf.payload_text


def main() -> None:
    ap = argparse.ArgumentParser(description="Export the game ledger facts from the record store.")
    ap.add_argument("--team", default="Utah Jazz")
    ap.add_argument("--season", default="2026-27")
    ap.add_argument("--team-payload-file", required=True,
                    help="the team shot payload whose game set the ledger covers")
    ap.add_argument("--db-url", help="Postgres DSN (default: NBA_DB_URL)")
    ap.add_argument("--out-file")
    ap.add_argument("--verify-against")
    args = ap.parse_args()
    if not args.out_file and not args.verify_against:
        fail("nothing to do — pass --out-file and/or --verify-against")

    with rs.connect(rs.resolve_dsn(args.db_url)) as conn:
        ledger = export_ledger(conn, args.team, args.season, Path(args.team_payload_file))
    text = payload_text(ledger)
    if args.verify_against:
        committed = Path(args.verify_against).read_text(encoding="utf-8")
        if text != committed:
            fail("parity FAILED against " + args.verify_against)
        print(f"PARITY OK: {args.verify_against}")
    if args.out_file:
        lf.write_payload(Path(args.out_file), ledger)
        print(f"exported -> {args.out_file}")


if __name__ == "__main__":
    main()
