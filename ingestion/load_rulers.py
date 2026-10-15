"""Load the pre-game rulers and the league game log into the record store
(ADR-0089).

WHAT THIS DOES:
  - Every ruler snapshot (a LeagueAverages frame through a date, pulled by
    ingestion/pull_rulers.py) loads into league_ruler_zone at the frame's
    own fine grain, keyed by its through-date. A ruler describes a past
    date, so it never grows: any changed or vanished row of a loaded ruler
    is a correction and halts without --allow-changed. An EMPTY frame is a
    valid observation (a through-date before the season's first game): it
    loads no rows and still records its head, so the export can tell "no
    games yet" from "never pulled".
  - The latest league game log loads into league_game, scope-complete per
    (season, season type): new games are inserted (a living season grows),
    a game whose date or teams changed, or that vanished, halts. The game
    log is what turns a ruler's through-date into a game count.

USAGE:
  python ingestion/load_rulers.py --season 2025-26
  python ingestion/load_rulers.py --ruler-files <a.json> <b.json> --game-log-file <log.json>
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

import derive_payload as dp
import load_hero_season as lhs
import record_store as rs

RULER_SOURCE = "league-ruler"
GAME_LOG_SOURCE = "league-game-log"
RULER_META_KEYS = ("season", "season_type", "pull_date", "through")
GAME_LOG_META_KEYS = ("season", "season_type", "pull_date")
GAME_LOG_RESULT_SET = "LeagueGameLog"
GAME_LOG_COLUMNS = ("TEAM_ID", "GAME_ID", "GAME_DATE")


def fail(msg: str) -> None:
    sys.exit(f"load-rulers: {msg}")


# ------------------------------------------------------------ validation


def validate_ruler_snapshot(snapshot: dict) -> tuple[dict, list[tuple[str, str, str, int, int]]]:
    """(_meta, rows) for one ruler artifact; rows are (zone_basic, zone_area,
    zone_range normalized, fga, fgm). Exits loudly on contract violations;
    an empty frame returns no rows."""
    meta = snapshot.get("_meta")
    response = snapshot.get("response")
    if not isinstance(meta, dict) or not isinstance(response, dict):
        fail("ruler snapshot missing _meta/response — not a raw-layer file")
    missing = [k for k in RULER_META_KEYS if k not in meta]
    if missing:
        fail(f"ruler _meta missing keys: {missing}")
    try:
        date.fromisoformat(str(meta["through"]))
    except ValueError:
        fail(f"ruler through-date {meta['through']!r} is not an ISO date")
    league = dp.result_set(response, "LeagueAverages")
    if league is None:
        fail("result set LeagueAverages missing from the ruler response")
    if league.empty:
        return meta, []
    if list(league.columns) != dp.LEAGUE_HEADERS:
        fail(f"LeagueAverages headers changed: {list(league.columns)}")
    for column, known in (("SHOT_ZONE_BASIC", dp.BASIC_ZONES), ("SHOT_ZONE_AREA", dp.ZONE_AREAS)):
        unknown = set(league[column]) - set(known)
        if unknown:
            fail(f"unknown {column} in the ruler frame: {sorted(unknown)}")
    unknown = ({dp.normalize_range(str(r)) for r in league["SHOT_ZONE_RANGE"]}
               - set(dp.ZONE_RANGES))
    if unknown:
        fail(f"unknown SHOT_ZONE_RANGE in the ruler frame: {sorted(unknown)}")
    with_fga = league[league["FGA"] > 0]
    if ((with_fga["FGM"] / with_fga["FGA"] - with_fga["FG_PCT"]).abs() > 0.001).any():
        fail("ruler FG_PCT does not reconcile with FGM/FGA — frame corrupt")
    rows = [
        (str(r.SHOT_ZONE_BASIC), str(r.SHOT_ZONE_AREA), dp.normalize_range(str(r.SHOT_ZONE_RANGE)),
         int(r.FGA), int(r.FGM))
        for r in league.itertuples(index=False)
    ]
    if "league_fga" in meta and int(meta["league_fga"]) != sum(r[3] for r in rows):
        fail(f"ruler _meta.league_fga ({meta['league_fga']}) != frame FGA "
             f"({sum(r[3] for r in rows)}) — snapshot inconsistent")
    return meta, rows


def validate_game_log_snapshot(snapshot: dict) -> tuple[dict, dict[str, tuple[date, int, int]]]:
    """(_meta, {game_id: (game_date, team_a_id, team_b_id)}) from one
    team-grain league game log: exactly two rows per game, two different
    teams, agreeing on the date. Home is not read: the log's MATCHUP says
    '@' for both rows of a neutral-site game."""
    meta = snapshot.get("_meta")
    response = snapshot.get("response")
    if not isinstance(meta, dict) or not isinstance(response, dict):
        fail("game log snapshot missing _meta/response — not a raw-layer file")
    missing = [k for k in GAME_LOG_META_KEYS if k not in meta]
    if missing:
        fail(f"game log _meta missing keys: {missing}")
    frame = dp.result_set(response, GAME_LOG_RESULT_SET)
    if frame is None:
        fail(f"result set {GAME_LOG_RESULT_SET} missing from the game log response")
    missing_cols = [c for c in GAME_LOG_COLUMNS if c not in frame.columns]
    if missing_cols:
        fail(f"game log frame missing columns: {missing_cols}")
    rows: dict[str, list[tuple[date, int]]] = {}
    for row in frame.itertuples(index=False):
        game_id = str(row.GAME_ID)
        try:
            game_date = date.fromisoformat(str(row.GAME_DATE)[:10])
        except ValueError:
            fail(f"game {game_id}: unparseable GAME_DATE {row.GAME_DATE!r}")
        rows.setdefault(game_id, []).append((game_date, int(row.TEAM_ID)))
    games: dict[str, tuple[date, int, int]] = {}
    for game_id, sides in rows.items():
        if len(sides) != 2 or sides[0][1] == sides[1][1]:
            fail(f"game {game_id}: expected one row for each of two teams, found {sides}")
        if sides[0][0] != sides[1][0]:
            fail(f"game {game_id}: its two rows disagree on the date")
        a, b = sorted(s[1] for s in sides)
        games[game_id] = (sides[0][0], a, b)
    return meta, games


# ------------------------------------------------------------------- load


def load_rulers(conn, ruler_paths: list[Path], game_log_path: Path | None = None,
                allow_changed: bool = False) -> dict:
    """Load ruler snapshots (and optionally the league game log) in one
    transaction; return the change-detection report. Any halt rolls the
    whole load back."""
    rulers = []
    for path in ruler_paths:
        meta, rows = validate_ruler_snapshot(json.loads(path.read_text(encoding="utf-8")))
        rulers.append((path, meta, rows))
    log = None
    if game_log_path is not None:
        log = (game_log_path,) + validate_game_log_snapshot(
            json.loads(game_log_path.read_text(encoding="utf-8")))

    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO load_run (kind) VALUES ('rulers') RETURNING run_id")
            run_id = cur.fetchone()[0]
            report: dict = {}
            changed_detail: list[str] = []
            heads: list[tuple[str, int]] = []

            by_season: dict[tuple[str, str], list[date]] = {}
            zones = lhs.TableUpsert(
                "league_ruler_zone",
                ("season", "season_type", "through_date", "zone_basic", "zone_area", "zone_range"),
            )
            for path, meta, rows in rulers:
                snap = lhs.catalog_snapshot(cur, RULER_SOURCE, path, meta)
                cur.execute("INSERT INTO load_run_snapshot (run_id, snapshot_id) VALUES (%s, %s)"
                            " ON CONFLICT DO NOTHING", (run_id, snap))
                season, season_type = str(meta["season"]), str(meta["season_type"])
                through = date.fromisoformat(str(meta["through"]))
                dates = by_season.setdefault((season, season_type), [])
                if through in dates:
                    fail(f"two ruler snapshots for {season} through {through} in one load")
                dates.append(through)
                for zone_basic, zone_area, zone_range, fga, fgm in rows:
                    zones.stage({
                        "season": season, "season_type": season_type, "through_date": through,
                        "zone_basic": zone_basic, "zone_area": zone_area, "zone_range": zone_range,
                        "fga": fga, "fgm": fgm, "snapshot_id": snap, "run_id": run_id,
                    })
                heads.append((rs.scope_key(RULER_SOURCE, season=season, season_type=season_type,
                                           through=through.isoformat()), snap))
            zone_counts = {"inserted": 0, "unchanged": 0, "grown": 0, "changed": 0, "deleted": 0}
            for (season, season_type), dates in by_season.items():
                part = lhs.TableUpsert(zones.table, zones.key_cols)
                part.staged = {k: v for k, v in zones.staged.items()
                               if (k[0], k[1]) == (season, season_type)}
                # Complete over the through-dates this load asserts: a row a
                # re-pull of the same date no longer carries is a deletion.
                part.flush(cur, report, changed_detail, scope=(
                    "season = %s AND season_type = %s AND through_date = ANY(%s)",
                    [season, season_type, dates]))
                for k, v in report[zones.table].items():
                    zone_counts[k] += v
            report[zones.table] = zone_counts

            if log is not None:
                log_path, log_meta, games = log
                snap = lhs.catalog_snapshot(cur, GAME_LOG_SOURCE, log_path, log_meta)
                cur.execute("INSERT INTO load_run_snapshot (run_id, snapshot_id) VALUES (%s, %s)"
                            " ON CONFLICT DO NOTHING", (run_id, snap))
                season, season_type = str(log_meta["season"]), str(log_meta["season_type"])
                league_games = lhs.TableUpsert("league_game", ("game_id",))
                for game_id, (game_date, team_a, team_b) in sorted(games.items()):
                    league_games.stage({
                        "game_id": game_id, "season": season, "season_type": season_type,
                        "game_date": game_date, "team_a_id": team_a, "team_b_id": team_b,
                        "snapshot_id": snap, "run_id": run_id,
                    })
                league_games.flush(cur, report, changed_detail, scope=(
                    "season = %s AND season_type = %s", [season, season_type]))
                heads.append((rs.scope_key(GAME_LOG_SOURCE, season=season,
                                           season_type=season_type), snap))

            halting = sum(c["changed"] + c["deleted"] for c in report.values())
            if halting and not allow_changed:
                raise lhs.LoadHalt(
                    f"{halting} row(s) changed or deleted against current state — a "
                    f"ruler or the game log contradicts what is loaded. First diffs:\n  "
                    + "\n  ".join(changed_detail[:10])
                    + "\nRe-run with --allow-changed to accept them."
                )
            for key, snap in heads:
                rs.set_head(cur, key, snap, run_id)
            cur.execute("UPDATE load_run SET report = %s WHERE run_id = %s",
                        (lhs.Jsonb(report), run_id))
        conn.commit()
        return report
    except BaseException:
        conn.rollback()
        raise


# ------------------------------------------------------------- raw layer


def latest_rulers(raw_root: Path, season: str) -> list[Path]:
    """The latest snapshot under each through-date directory."""
    root = raw_root / "_league" / season / "rulers"
    if not root.exists():
        return []
    paths = []
    for day in sorted(p for p in root.iterdir() if p.is_dir()):
        snaps = sorted(day.glob("*.json"))
        if snaps:
            paths.append(snaps[-1])
    return paths


def latest_game_log(raw_root: Path, season: str) -> Path | None:
    root = raw_root / "_league" / season / "game-log"
    snaps = sorted(root.glob("*.json")) if root.exists() else []
    return snaps[-1] if snaps else None


def main() -> None:
    ap = argparse.ArgumentParser(description="Load the pre-game rulers and the league game log.")
    ap.add_argument("--season", default="2026-27")
    ap.add_argument("--raw-root", default="data/raw")
    ap.add_argument("--ruler-files", nargs="*", help="explicit ruler snapshots (bypasses raw-root)")
    ap.add_argument("--game-log-file", help="explicit league game log snapshot")
    ap.add_argument("--db-url", help="Postgres DSN (default: NBA_DB_URL)")
    ap.add_argument("--allow-changed", action="store_true")
    args = ap.parse_args()

    raw_root = Path(args.raw_root)
    ruler_paths = ([Path(p) for p in args.ruler_files] if args.ruler_files is not None
                   else latest_rulers(raw_root, args.season))
    log_path = (Path(args.game_log_file) if args.game_log_file
                else latest_game_log(raw_root, args.season))
    if not ruler_paths and log_path is None:
        fail(f"nothing to load for {args.season} — run ingestion/pull_rulers.py first")

    with rs.connect(rs.resolve_dsn(args.db_url)) as conn:
        rs.apply_migrations(conn)
        try:
            report = load_rulers(conn, ruler_paths, log_path, allow_changed=args.allow_changed)
        except lhs.LoadHalt as halt:
            sys.exit(f"load-rulers: HALT — {halt}")
    print(f"loaded {len(ruler_paths)} ruler(s){' + the league game log' if log_path else ''}")
    for table, counts in report.items():
        print(f"  {table:<20} inserted={counts['inserted']:<6} unchanged={counts['unchanged']:<6} "
              f"changed={counts['changed']:<4} deleted={counts['deleted']}")


if __name__ == "__main__":
    main()
