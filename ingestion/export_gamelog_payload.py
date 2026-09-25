"""Export the game-log payload (ADR-0086) from the record
store. The first born-DB-native contract: no file derive exists.

One compact file per card-roster player-season: per game, the box-line
subset, every shot as (zone, value, made, period, assist status), the trips,
and the technical free-throw count, with the season's league zone pairs
embedded (pairs, never rates — ADR-0004). Hard-fails at export: the per-game
receipt identity against box_score_line (FG points + trip FTM + technical
FTM == box points, and the FT lines reconcile), the season FGA oracle
against the league totals artifact, a universe game missing its corpus data
(--allow-missing-games skips it for fixtures only), and a universe game
whose date no loaded source has observed.

USAGE:
  python ingestion/export_gamelog_payload.py --player "Cody Williams" --season 2025-26 --out-file public/data/games/cody-williams/2025-26.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import derive_freethrow as df
import derive_payload as dp
import derive_shot_context as dsc
import load_game_corpus as lgc
import record_store as rs

# v2: per-game splitFtm/splitFta (ADR-0053 as amended) in the receipt
# identity, beside the technicals.
SCHEMA_VERSION = 2
THREE = dp.THREE_POINT_ZONES


def fail(msg: str) -> None:
    sys.exit(f"export-gamelog: {msg}")


def export_payload(
    conn, player: str, season: str, season_type: str = "Regular Season",
    *, allow_missing_games: bool = False,
) -> dict:
    with conn.cursor() as cur:
        cur.execute("SELECT player_id, name FROM player WHERE name = %s", (player,))
        hits = cur.fetchall()
        if len(hits) != 1:
            fail(f"expected exactly one player named {player!r}, found {len(hits)}")
        player_id, player_name = hits[0]

        _, _, _, snap_season_type = rs.get_head(
            cur, rs.scope_key("shotchartdetail", player_id=player_id,
                              season=season, season_type=season_type))
        if snap_season_type != season_type:
            fail(f"snapshot season_type {snap_season_type!r} != requested {season_type!r}")

        cur.execute(
            "SELECT s.game_id, g.game_date, g.home_abbrev, g.visitor_abbrev,"
            " s.zone_basic, s.point_value, s.made, s.period,"
            " s.minutes_remaining, s.seconds_remaining, c.assist_status,"
            " s.game_event_id"
            " FROM shot s JOIN game g USING (game_id)"
            " LEFT JOIN shot_context c USING (game_id, game_event_id)"
            " WHERE s.player_id = %s AND g.season = %s AND g.season_type = %s"
            " ORDER BY s.source_row",
            (player_id, season, season_type),
        )
        shot_rows = cur.fetchall()
        if not shot_rows:
            fail(f"no shots for {player!r} {season} — load the season first")
        season_fga = len(shot_rows)
        made_ids: dict[str, set[int]] = {}
        for r in shot_rows:
            if r[6] and (r[4] in THREE) == (r[5] == 3):
                made_ids.setdefault(r[0], set()).add(r[11])

        cur.execute(
            "SELECT b.game_id, g.game_date, g.home_abbrev, g.visitor_abbrev,"
            " b.home, b.minutes, b.points, b.reb, b.ast, b.ftm, b.fta"
            " FROM box_score_line b JOIN game g USING (game_id)"
            " WHERE b.player_id = %s AND g.season = %s AND g.season_type = %s",
            (player_id, season, season_type),
        )
        box_rows = {r[0]: r[1:] for r in cur.fetchall()}
        shot_games = {r[0] for r in shot_rows}
        ft_games = {gid for gid, r in box_rows.items() if r[9] > 0}
        universe = sorted(shot_games | ft_games)

        cur.execute(
            "SELECT t.game_id, t.trip_class, t.period, t.clock, t.ftm, t.fta"
            " FROM ft_trip t JOIN game g USING (game_id)"
            " WHERE t.player_id = %s AND g.season = %s AND g.season_type = %s"
            " ORDER BY t.game_id, t.first_ft_row",
            (player_id, season, season_type),
        )
        trips_by_game: dict[str, list] = {}
        for gid, cls, period, trip_clock, ftm, fta in cur.fetchall():
            parts = dsc._clock_parts(trip_clock)
            if parts is None:
                fail(f"game {gid}: unparseable trip clock {trip_clock!r}")
            trips_by_game.setdefault(gid, []).append(
                {"tripClass": cls, "period": period,
                 "clock": f"{parts[0]}:{parts[1]:02d}", "ftm": ftm, "fta": fta})

        games: list[dict] = []
        for gid in universe:
            box = box_rows.get(gid)
            cur.execute("SELECT count(*) FROM pbp_event WHERE game_id = %s", (gid,))
            pbp_loaded = cur.fetchone()[0] > 0
            if box is None or not pbp_loaded:
                if allow_missing_games:
                    continue
                fail(f"game {gid}: corpus data missing (box {'ok' if box else 'absent'},"
                     f" pbp {'ok' if pbp_loaded else 'absent'}) — load the corpus first")
            (game_date, home_ab, vis_ab, home, minutes,
             points, reb, ast, box_ftm, box_fta) = box
            if game_date is None:
                fail(f"game {gid}: no loaded source states its date — a shotless "
                     f"free-throw game dates itself only once some loaded player's "
                     f"shot snapshot covers the game")
            if home_ab is None or vis_ab is None:
                fail(f"game {gid}: no observed home/visitor abbreviations")

            # Technicals and splits by the derive's own grammar over the
            # stored events, with the ft_trip table cross-checked against
            # the reconstruction (a stale table fails, never exports).
            actions = lgc.fetch_game_actions(cur, gid)
            (g_trips, tech_ftm, tech_fta,
             split_ftm, split_fta) = df.reconstruct_game_trips(
                gid, actions, player_id, made_ids.get(gid, set()))

            shots = []
            for (sgid, _, _, _, zone, value, made, period, clock_min, clock_sec,
                 assist, _event_id) in shot_rows:
                if sgid != gid:
                    continue
                conflict = (zone in THREE) != (value == 3)
                if assist is None and not conflict:
                    fail(f"game {gid}: a non-conflict shot has no context row — "
                         f"rebuild the corpus (load_game_corpus.py)")
                shots.append({"zone": zone, "value": value, "made": made,
                              "period": period,
                              "clock": f"{clock_min}:{clock_sec:02d}",
                              "assist": None if conflict else assist})

            trips = trips_by_game.get(gid, [])
            if len(trips) != len(g_trips):
                fail(f"game {gid}: ft_trip table disagrees with the grammar "
                     f"({len(trips)} rows vs {len(g_trips)} reconstructed) — "
                     f"rebuild the corpus (load_game_corpus.py)")
            fg_points = sum(s["value"] for s in shots if s["made"])
            trip_ftm = sum(t["ftm"] for t in trips)
            trip_fta = sum(t["fta"] for t in trips)
            if fg_points + trip_ftm + tech_ftm + split_ftm != points:
                fail(f"game {gid}: receipt identity broken — FG {fg_points} + trip "
                     f"FTM {trip_ftm} + technical {tech_ftm} + split {split_ftm} "
                     f"!= box points {points}")
            if (trip_ftm + tech_ftm + split_ftm != box_ftm
                    or trip_fta + tech_fta + split_fta != box_fta):
                fail(f"game {gid}: free-throw line does not reconcile with the box")

            games.append({
                "gameId": gid,
                "date": game_date.isoformat(),
                "opponent": vis_ab if home else home_ab,
                "home": home,
                "box": {"min": minutes, "pts": points, "reb": reb, "ast": ast,
                        "ftm": box_ftm, "fta": box_fta},
                "shots": shots,
                "trips": trips,
                "technicalFtm": tech_ftm,
                "technicalFta": tech_fta,
                "splitFtm": split_ftm,
                "splitFta": split_fta,
            })
        if not games:
            fail("no complete games to export")
        games.sort(key=lambda g: g["date"])

        cur.execute(
            "SELECT zone_basic, sum(fga), sum(fgm) FROM league_zone_baseline"
            " WHERE season = %s AND season_type = %s GROUP BY zone_basic",
            (season, season_type),
        )
        pairs = {zone: (fga, fgm) for zone, fga, fgm in cur.fetchall()}
        baseline = []
        for zone in dp.EVAL_ZONES:
            if zone not in pairs:
                fail(f"league baseline missing evaluation zone {zone!r}")
            fga, fgm = pairs[zone]
            baseline.append({"zone": zone, "fga": int(fga), "fgm": int(fgm)})

        cur.execute(
            "SELECT fga FROM league_season_totals"
            " WHERE player_id = %s AND season = %s AND season_type = %s",
            (player_id, season, season_type),
        )
        oracle = cur.fetchone()
        if oracle is None:
            fail("no league_season_totals row (the FGA oracle) — load the corpus")
        if oracle[0] != season_fga:
            fail(f"league artifact FGA ({oracle[0]}) != stored pre-drop season "
                 f"FGA ({season_fga})")

        # The league free-throw line (endpoint parity, ADR-0055): what a trip
        # is worth at league conversion.
        cur.execute(
            "SELECT sum(ftm), sum(fta) FROM league_season_totals"
            " WHERE season = %s AND season_type = %s",
            (season, season_type),
        )
        league_ftm, league_fta = cur.fetchone()

    # seasonFga is the shots the file CARRIES — equal to the pre-drop season
    # FGA (the oracle above) for every complete export, i.e. everything
    # deployed; only an --allow-missing-games fixture export runs short.
    return {
        "_meta": {
            "schemaVersion": SCHEMA_VERSION,
            "player": player_name,
            "playerId": player_id,
            "season": season,
            "seasonType": season_type,
            "dataThrough": games[-1]["date"],
            "totalGames": len(games),
            "seasonFga": sum(len(g["shots"]) for g in games),
        },
        "leagueBaseline": baseline,
        "leagueFreeThrows": {"ftm": int(league_ftm), "fta": int(league_fta)},
        "games": games,
    }


def payload_text(payload: dict) -> str:
    return json.dumps(payload, indent=2)


def rebuild_index(games_root: Path) -> int:
    """Rewrite the roster index from the games files ON DISK — the /game
    landing's picker and the index guard both read what this writes, so the
    index can never name a file that does not exist (nor miss one that
    does). Shared by --all-deployed and the mass-import driver."""
    index: list[dict] = []
    for slug_dir in sorted(p for p in games_root.iterdir() if p.is_dir()):
        for file in sorted(slug_dir.glob("*.json")):
            meta = json.loads(file.read_text(encoding="utf-8"))["_meta"]
            index.append({
                "slug": slug_dir.name,
                "player": meta["player"],
                "season": meta["season"],
                "totalGames": meta["totalGames"],
                "dataThrough": meta["dataThrough"],
            })
    index.sort(key=lambda e: (e["player"], e["season"]))
    index_path = games_root / "index.json"
    index_path.write_text(json.dumps({"rosters": index}, indent=2),
                          encoding="utf-8", newline="\n")
    print(f"index -> {index_path} ({len(index)} player-season(s))")
    return len(index)


def export_all_deployed(args: argparse.Namespace) -> None:
    """The heroes-first tranche (ADR-0086 rollout): one games file per
    deployed hero-season, then the on-disk index rebuild."""
    repo = Path(__file__).resolve().parents[1]
    games_root = repo / "public" / "data" / "games"
    with rs.connect(rs.resolve_dsn(args.db_url)) as conn:
        for shot_file in sorted((repo / "public" / "data").glob("*/*.json")):
            if shot_file.parent.name == "games" or "." in shot_file.stem:
                continue  # sibling contracts carry dotted stems; games/ is ours
            meta = json.loads(shot_file.read_text(encoding="utf-8"))["_meta"]
            payload = export_payload(conn, meta["player"], meta["season"])
            out = games_root / shot_file.parent.name / f"{meta['season']}.json"
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(payload_text(payload), encoding="utf-8", newline="\n")
            print(f"  {payload['_meta']['player']:<26} "
                  f"{payload['_meta']['totalGames']} games -> {out.name}")
    rebuild_index(games_root)


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Export the game-log payload (ADR-0086) from the record store."
    )
    ap.add_argument("--player", default="Cody Williams")
    ap.add_argument("--season", default="2025-26")
    ap.add_argument("--season-type", default="Regular Season")
    ap.add_argument("--db-url", help="Postgres DSN (default: NBA_DB_URL)")
    ap.add_argument("--out-file")
    ap.add_argument("--verify-against",
                    help="compare byte-for-byte against a committed payload")
    ap.add_argument("--allow-missing-games", action="store_true",
                    help="fixture/audit mode only: skip universe games whose "
                         "corpus data is absent instead of failing")
    ap.add_argument("--all-deployed", action="store_true",
                    help="export every deployed hero (public/data/<slug>/) to "
                         "public/data/games/<slug>/<season>.json and rewrite "
                         "the roster index the /game landing reads")
    args = ap.parse_args()
    if args.all_deployed:
        export_all_deployed(args)
        return
    if not args.out_file and not args.verify_against:
        fail("nothing to do — pass --out-file and/or --verify-against")

    with rs.connect(rs.resolve_dsn(args.db_url)) as conn:
        payload = export_payload(conn, args.player, args.season, args.season_type,
                                 allow_missing_games=args.allow_missing_games)
    text = payload_text(payload)

    if args.verify_against:
        committed = Path(args.verify_against).read_text(encoding="utf-8")
        if text == committed:
            print(f"PARITY OK: export matches {args.verify_against} ({len(text)} chars)")
        else:
            for i, (a, b) in enumerate(zip(text.splitlines(), committed.splitlines())):
                if a != b:
                    fail(f"differs at line {i + 1}:\n  export:    {a}\n  committed: {b}")
            fail(f"differs: lengths ({len(text)} vs {len(committed)})")
    if args.out_file:
        out = Path(args.out_file)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8", newline="\n")
        print(f"exported -> {out} ({payload['_meta']['totalGames']} games, "
              f"{payload['_meta']['seasonFga']} FGA)")


if __name__ == "__main__":
    main()
