"""Export the team shot payload from the record store (ADR-0082).

The parity oracle: over the same observations, this export must reproduce
ingestion/derive_team_payload.py's output byte-identically — one grammar
(team_payload.build_team_payload), two sources. --verify-against compares
the export to a committed payload and fails loudly on the first difference.

Every fence runs again here: the per-player per-game box oracle (a game
without box lines in the store cannot be exported), zone-point conflicts
dropped and counted, evaluation-zone baseline presence.

USAGE:
  python ingestion/export_team_shot_payload.py --team "Utah Jazz" --season 2026-27 --out-file data/derived/_teams/uta/2026-27/<stamp>.json
  python ingestion/export_team_shot_payload.py --team "Utah Jazz" --season 2025-26 --verify-against public/data/_teams/uta/2025-26.json
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import record_store as rs
import team_payload as tp
from load_team_season import ROSTER_SOURCE, TEAM_SOURCE


def fail(msg: str) -> None:
    sys.exit(f"export-team: {msg}")


def export_payload(conn, team: str, season: str, season_type: str = "Regular Season") -> dict:
    with conn.cursor() as cur:
        cur.execute("SELECT team_id FROM team WHERE name = %s", (team,))
        hits = cur.fetchall()
        if len(hits) != 1:
            fail(f"expected exactly one team named {team!r}, found {len(hits)}")
        team_id = hits[0][0]

        cur.execute(
            """
            SELECT s.game_id, s.game_event_id, g.game_date, t.name,
                   g.home_abbrev, g.visitor_abbrev, s.player_id, p.name,
                   s.period, s.minutes_remaining, s.seconds_remaining, s.made,
                   s.point_value, s.zone_basic, s.zone_area, s.zone_range,
                   s.distance_ft, s.loc_x, s.loc_y
            FROM shot s
            JOIN game g USING (game_id)
            JOIN team t ON t.team_id = s.team_id
            JOIN player p ON p.player_id = s.player_id
            WHERE s.team_id = %s AND g.season = %s AND g.season_type = %s
            """,
            (team_id, season, season_type),
        )
        rows = [
            tp.observed_row(
                game_id=game_id, game_event_id=event_id,
                game_date=game_date.isoformat() if game_date is not None else "",
                team_name=team_name, htm=htm, vtm=vtm, player_id=player_id,
                player_name=player_name, period=period, minutes_remaining=minutes,
                seconds_remaining=seconds, made=made, point_value=point_value,
                zone_basic=zone_basic, zone_area=zone_area, zone_range=zone_range,
                distance_ft=distance_ft, loc_x=loc_x, loc_y=loc_y,
            )
            for (game_id, event_id, game_date, team_name, htm, vtm, player_id,
                 player_name, period, minutes, seconds, made, point_value, zone_basic,
                 zone_area, zone_range, distance_ft, loc_x, loc_y) in cur.fetchall()
        ]
        if not rows:
            fail(f"no shots for {team!r} {season} — load the team season first")
        undated = sorted({r["game_id"] for r in rows if not r["game_date"]})
        if undated:
            fail(f"game(s) without a date in the store: {undated}")

        _, source_path, pull_date, snap_type = rs.get_head(
            cur, rs.scope_key(TEAM_SOURCE, season=season, season_type=season_type,
                              team_id=team_id))
        if snap_type != season_type:
            fail(f"snapshot season_type {snap_type!r} != requested {season_type!r}")
        _, roster_path, _, _ = rs.get_head(
            cur, rs.scope_key(ROSTER_SOURCE, season=season, season_type=season_type,
                              team_id=team_id))

        cur.execute(
            "SELECT player_id, player_name, number, position, experience, source_row"
            " FROM roster_entry WHERE team_id = %s AND season = %s AND season_type = %s",
            (team_id, season, season_type),
        )
        roster = [
            tp.roster_entry(player_id=pid, player_name=name, number=number,
                            position=position, experience=experience, source_row=ordinal)
            for pid, name, number, position, experience, ordinal in cur.fetchall()
        ]

        cur.execute(
            "SELECT zone_basic, zone_range, fga, fgm FROM league_zone_baseline"
            " WHERE season = %s AND season_type = %s",
            (season, season_type),
        )
        baseline_rows = [(zb, zr, fga, fgm) for zb, zr, fga, fgm in cur.fetchall()]

        game_ids = sorted({r["game_id"] for r in rows})
        cur.execute(
            "SELECT game_id, player_id, fga FROM box_score_line"
            " WHERE team_id = %s AND game_id = ANY(%s)",
            (team_id, game_ids),
        )
        box_fga: dict[str, dict[int, int]] = {}
        for game_id, player_id, fga in cur.fetchall():
            box_fga.setdefault(game_id, {})[player_id] = fga

    return tp.build_team_payload(
        meta={"team": team, "team_id": team_id, "season": season,
              "season_type": season_type, "pull_date": pull_date},
        source=source_path,
        roster_source=roster_path,
        rows=rows,
        baseline_rows=baseline_rows,
        roster=roster,
        box_fga=box_fga,
    )


payload_text = tp.payload_text


def main() -> None:
    ap = argparse.ArgumentParser(description="Export the team shot payload from the record store.")
    ap.add_argument("--team", default="Utah Jazz")
    ap.add_argument("--season", default="2026-27")
    ap.add_argument("--season-type", default="Regular Season")
    ap.add_argument("--db-url", help="Postgres DSN (default: NBA_DB_URL)")
    ap.add_argument("--out-file", help="write the payload here")
    ap.add_argument("--verify-against",
                    help="parity oracle: compare byte-for-byte against this payload")
    args = ap.parse_args()
    if not args.out_file and not args.verify_against:
        fail("nothing to do — pass --out-file and/or --verify-against")

    with rs.connect(rs.resolve_dsn(args.db_url)) as conn:
        payload = export_payload(conn, args.team, args.season, args.season_type)
    text = payload_text(payload)

    if args.verify_against:
        committed = Path(args.verify_against).read_text(encoding="utf-8")
        if text == committed:
            print(f"PARITY OK: export matches {args.verify_against} byte-for-byte "
                  f"({len(text)} chars)")
        else:
            for i, (a, b) in enumerate(zip(text.splitlines(), committed.splitlines())):
                if a != b:
                    fail(f"parity FAILED at line {i + 1}:\n  export:    {a}\n"
                         f"  committed: {b}")
            fail(f"parity FAILED: lengths differ "
                 f"(export {len(text)}, committed {len(committed)})")
    if args.out_file:
        tp.write_payload(Path(args.out_file), payload)
        print(f"exported -> {args.out_file}")


if __name__ == "__main__":
    main()
