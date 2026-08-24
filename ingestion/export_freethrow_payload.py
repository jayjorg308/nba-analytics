"""Export the free-throw payload from the record store (ADR-0080).

The parity oracle for the fourth contract: over the same sources, this must
reproduce ingestion/derive_freethrow.py's output byte-identically. Trips come
from the ft_trip derived table; technical free throws are recomputed from
pbp_event by the same grammar; and every oracle re-runs at export (the
per-game box line, Gate 5's season reconciliation, the FGA oracle) —
pipeline checks run at load AND export, per ADR-0080.

sourceShotPayload is reconstructed by the file pipeline's own convention
(data/derived/<slug>/<season>/<shot pull date>.json) — the committed corpus
was provenance-normalized to that form on 2026-08-24.

USAGE:
  python ingestion/export_freethrow_payload.py --player "Cody Williams" --season 2025-26 --verify-against public/data/cody-williams/2025-26.freethrow.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import derive_freethrow as df
import derive_payload as dp
import record_store as rs


def fail(msg: str) -> None:
    sys.exit(f"export-freethrow: {msg}")


def export_payload(
    conn,
    player: str,
    season: str,
    season_type: str = "Regular Season",
    *,
    allow_missing_games: bool = False,
    source_shot_payload: str | None = None,
) -> dict:
    with conn.cursor() as cur:
        cur.execute("SELECT player_id, name FROM player WHERE name = %s", (player,))
        hits = cur.fetchall()
        if len(hits) != 1:
            fail(f"expected exactly one player named {player!r}, found {len(hits)}")
        player_id, player_name = hits[0]

        cur.execute(
            "SELECT s.game_id, g.game_date, s.made, s.zone_basic, s.point_value,"
            " s.snapshot_id FROM shot s JOIN game g USING (game_id)"
            " WHERE s.player_id = %s AND g.season = %s AND g.season_type = %s",
            (player_id, season, season_type),
        )
        shot_rows = cur.fetchall()
        if not shot_rows:
            fail(f"no shots for {player!r} {season} — load the season first")
        pre_drop_fga = len(shot_rows)
        post_drop: list[tuple] = [
            r for r in shot_rows if (r[3] in dp.THREE_POINT_ZONES) == (r[4] == 3)
        ]
        shot_games = sorted({r[0] for r in post_drop})
        data_through = max(r[1] for r in post_drop).isoformat()
        games_included = len(shot_games)

        snapshot_ids = {r[5] for r in shot_rows}
        if len(snapshot_ids) != 1:
            fail(f"shots carry {len(snapshot_ids)} snapshot provenances — mixed load")
        cur.execute("SELECT pull_date FROM snapshot WHERE snapshot_id = %s",
                    (snapshot_ids.pop(),))
        shot_pull_date = cur.fetchone()[0]

        cur.execute(
            "SELECT b.game_id, b.ftm, b.fta FROM box_score_line b"
            " JOIN game g USING (game_id)"
            " WHERE b.player_id = %s AND g.season = %s AND g.season_type = %s",
            (player_id, season, season_type),
        )
        box_by_game = {row[0]: (row[1], row[2]) for row in cur.fetchall()}
        ft_games = {g for g, (_, fta) in box_by_game.items() if fta > 0}
        universe = sorted(set(shot_games) | ft_games)

        cur.execute(
            "SELECT t.game_id, t.first_ft_row, t.period, t.clock, t.trip_class,"
            " t.ftm, t.fta, t.shot_game_event_id FROM ft_trip t"
            " JOIN game g USING (game_id)"
            " WHERE t.player_id = %s AND g.season = %s AND g.season_type = %s"
            " ORDER BY t.game_id, t.first_ft_row",
            (player_id, season, season_type),
        )
        trip_rows = cur.fetchall()

        # Technical free throws and per-game reconciliation, from pbp_event
        # by the derive's own grammar (the store's copy of the same fence).
        technical_ftm = technical_fta = 0
        loaded_games: list[str] = []
        trips_by_game: dict[str, list] = {}
        for row in trip_rows:
            trips_by_game.setdefault(row[0], []).append(row)
        for game_id in universe:
            cur.execute(
                "SELECT sub_type, description FROM pbp_event"
                " WHERE game_id = %s AND action_type = 'Free Throw'"
                " AND person_id = %s ORDER BY source_row",
                (game_id, player_id),
            )
            ft_events = cur.fetchall()
            cur.execute("SELECT count(*) FROM pbp_event WHERE game_id = %s", (game_id,))
            if cur.fetchone()[0] == 0:
                if allow_missing_games:
                    continue
                fail(f"no pbp events for game {game_id} (Gate 4) — load the corpus")
            loaded_games.append(game_id)
            game_tftm = game_tfta = 0
            for sub_type, description in ft_events:
                match = df.FT_SUBTYPE.fullmatch(sub_type or "")
                if not match:
                    fail(f"game {game_id}: unknown free-throw subtype {sub_type!r}")
                if (match.group("kind") or "regular") == "Technical":
                    game_tfta += 1
                    game_tftm += int(not (description or "").startswith("MISS"))
            game_trips = trips_by_game.get(game_id, [])
            game_ftm = sum(t[5] for t in game_trips) + game_tftm
            game_fta = sum(t[6] for t in game_trips) + game_tfta
            box_ftm, box_fta = box_by_game.get(game_id, (0, 0))
            if (game_ftm, game_fta) != (box_ftm, box_fta):
                fail(f"game {game_id}: stored line {game_ftm}/{game_fta} != "
                     f"box-score line {box_ftm}/{box_fta}")
            technical_ftm += game_tftm
            technical_fta += game_tfta

        # Source-pair provenance per loaded game, from the rows themselves.
        source_games: list[dict] = []
        for game_id in loaded_games:
            cur.execute(
                "SELECT DISTINCT sn.source, sn.pull_date FROM snapshot sn"
                " WHERE sn.snapshot_id IN ("
                "   SELECT snapshot_id FROM pbp_event WHERE game_id = %s"
                "   UNION SELECT snapshot_id FROM box_score_line WHERE game_id = %s)",
                (game_id, game_id),
            )
            dates = dict(cur.fetchall())
            if set(dates) != {"play-by-play", "box-score"}:
                fail(f"game {game_id}: incomplete snapshot provenance {sorted(dates)}")
            source_games.append({
                "gameId": game_id,
                "playByPlayPullDate": dates["play-by-play"],
                "boxScorePullDate": dates["box-score"],
            })

        cur.execute(
            "SELECT ls.ftm, ls.fta, ls.fga, ls.pts, sn.path, sn.pull_date"
            " FROM league_season_totals ls JOIN snapshot sn USING (snapshot_id)"
            " WHERE ls.player_id = %s AND ls.season = %s AND ls.season_type = %s",
            (player_id, season, season_type),
        )
        hero_totals = cur.fetchone()
        if hero_totals is None:
            fail("no league_season_totals row for the hero (Gate 5 oracle)")
        season_ftm, season_fta, season_fga, season_points, totals_path, totals_pull = hero_totals

        cur.execute(
            "SELECT sum(ftm), sum(fta), sum(fga), sum(pts)"
            " FROM league_season_totals WHERE season = %s AND season_type = %s",
            (season, season_type),
        )
        league_ftm, league_fta, league_fga, league_points = cur.fetchone()

    total_ftm = sum(t[5] for t in trip_rows) + technical_ftm
    total_fta = sum(t[6] for t in trip_rows) + technical_fta
    if not allow_missing_games and (total_ftm, total_fta) != (season_ftm, season_fta):
        fail(f"Gate 5: stored season line {total_ftm}/{total_fta} != league "
             f"artifact {season_ftm}/{season_fta}")
    if season_fga != pre_drop_fga:
        fail(f"league artifact FGA {season_fga} != pre-drop season FGA {pre_drop_fga}")

    slug = player_name.lower().replace(" ", "-")
    return {
        "_meta": {
            "schemaVersion": df.SCHEMA_VERSION,
            "player": player_name,
            "playerId": player_id,
            "season": season,
            "dataThrough": data_through,
            "gamesIncluded": games_included,
            "sourceShotPayload": (
                source_shot_payload
                or f"data/derived/{slug}/{season}/{shot_pull_date}.json"
            ),
            "sourceLeagueTotals": totals_path,
            "leagueTotalsPullDate": totals_pull,
            "seasonFga": pre_drop_fga,
            "seasonPoints": season_points,
            "seasonFtm": total_ftm,
            "seasonFta": total_fta,
            "technicalFtm": technical_ftm,
            "technicalFta": technical_fta,
            "totalTrips": len(trip_rows),
            "tripClassCounts": {
                trip_class: sum(1 for t in trip_rows if t[4] == trip_class)
                for trip_class in df.TRIP_CLASSES
            },
            "gamesExpected": len(set(shot_games) | set(loaded_games)),
            "gamesLoaded": len(loaded_games),
            "sourceGames": source_games,
        },
        "trips": [
            {
                "gameId": t[0],
                "period": t[2],
                "clock": t[3],
                "tripClass": t[4],
                "ftm": t[5],
                "fta": t[6],
                "shotId": t[7],
            }
            for t in trip_rows
        ],
        "leagueBaseline": {
            "ftm": league_ftm,
            "fta": league_fta,
            "fga": league_fga,
            "points": league_points,
        },
    }


def payload_text(payload: dict) -> str:
    return json.dumps(payload, indent=2)


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Export the free-throw payload from the record store."
    )
    ap.add_argument("--player", default="Cody Williams")
    ap.add_argument("--season", default="2025-26")
    ap.add_argument("--season-type", default="Regular Season")
    ap.add_argument("--db-url", help="Postgres DSN (default: NBA_DB_URL)")
    ap.add_argument("--out-file")
    ap.add_argument("--verify-against",
                    help="parity oracle: compare byte-for-byte against this payload")
    args = ap.parse_args()
    if not args.out_file and not args.verify_against:
        fail("nothing to do — pass --out-file and/or --verify-against")

    with rs.connect(rs.resolve_dsn(args.db_url)) as conn:
        payload = export_payload(conn, args.player, args.season, args.season_type)
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
        out = Path(args.out_file)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8", newline="\n")
        print(f"exported -> {out}")


if __name__ == "__main__":
    main()
