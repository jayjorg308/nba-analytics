"""Load one hero-season's shot-side sources into the record store (ADR-0080).

WHAT THIS DOES:
  For a (player, season), catalog the raw shot snapshot and the season's
  league Advanced artifact, then upsert their observations at natural NBA
  identity: player (league-wide, from the Advanced roster), team, game, shot
  (pre-drop — zone-point-conflict and Backcourt rows are stored as observed;
  the export drops and counts, ADR-0019), league_zone_baseline (fine grain,
  pairs never rates), and player_season (sourced facts: GP, FGA, USG_PCT).

  Validation is the derive step's own (derive_payload.validate_snapshot and
  read_usage — the FGA oracle fence runs here too), so nothing loads that the
  file pipeline would refuse.

CHANGE DETECTION (ADR-0080): every observed row is classified inserted /
  unchanged / changed against current state. Any changed row halts the load
  (rollback, nonzero exit) unless --allow-changed — an NBA correction to an
  already-loaded row is a contradiction to look at, never a silent overwrite.
  A re-run over the same snapshot is a no-op (all unchanged). Frontier-aware
  refinement (halt only inside a published frontier) arrives with the season
  loop slice.

USAGE:
  python ingestion/load_hero_season.py --player "Cody Williams" --season 2025-26
  python ingestion/load_hero_season.py --snapshot-file tests/fixtures/snapshot.truncated.json --advanced-file tests/fixtures/league-advanced.truncated.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import date
from pathlib import Path

from psycopg.types.json import Jsonb

import derive_payload as dp
import record_store as rs


class LoadHalt(Exception):
    """A change-detection halt: changed rows without --allow-changed."""


# ----------------------------------------------------------------- upserts


class TableUpsert:
    """Stage rows for one table, then flush with change detection.

    Rows are dicts of column -> value including the provenance columns
    (snapshot_id, run_id). Content comparison excludes provenance: an
    unchanged row is left entirely untouched, keeping the run that first
    asserted it; a changed row takes the new content AND the new provenance.
    """

    PROV_COLS = ("snapshot_id", "run_id")

    def __init__(self, table: str, key_cols: tuple[str, ...]):
        self.table = table
        self.key_cols = key_cols
        self.staged: dict[tuple, dict] = {}

    def stage(self, row: dict) -> None:
        self.staged[tuple(row[k] for k in self.key_cols)] = row

    def flush(self, cur, report: dict, changed_detail: list) -> None:
        counts = {"inserted": 0, "unchanged": 0, "changed": 0}
        report[self.table] = counts
        if not self.staged:
            return
        sample = next(iter(self.staged.values()))
        content_cols = [
            c for c in sample if c not in self.key_cols and c not in self.PROV_COLS
        ]
        existing = self._prefetch(cur, content_cols)

        inserts: list[dict] = []
        updates: list[dict] = []
        for key, row in self.staged.items():
            current = existing.get(key)
            if current is None:
                inserts.append(row)
                counts["inserted"] += 1
            elif current == tuple(row[c] for c in content_cols):
                counts["unchanged"] += 1
            else:
                updates.append(row)
                counts["changed"] += 1
                for col, old in zip(content_cols, current):
                    if old != row[col]:
                        changed_detail.append(
                            f"{self.table} {dict(zip(self.key_cols, key))}: "
                            f"{col} {old!r} -> {row[col]!r}"
                        )

        all_cols = list(sample)
        if inserts:
            placeholders = ", ".join(["%s"] * len(all_cols))
            cur.executemany(
                f"INSERT INTO {self.table} ({', '.join(all_cols)}) VALUES ({placeholders})",
                [tuple(r[c] for c in all_cols) for r in inserts],
            )
        if updates:
            set_cols = content_cols + list(self.PROV_COLS)
            set_sql = ", ".join(f"{c} = %s" for c in set_cols)
            where_sql = " AND ".join(f"{k} = %s" for k in self.key_cols)
            cur.executemany(
                f"UPDATE {self.table} SET {set_sql} WHERE {where_sql}",
                [
                    tuple(r[c] for c in set_cols) + tuple(r[k] for k in self.key_cols)
                    for r in updates
                ],
            )

    # Row-value IN lists parse into nested ORs; past a few hundred tuples
    # Postgres hits its stack depth limit, so prefetch in chunks.
    PREFETCH_CHUNK = 200

    def _prefetch(self, cur, content_cols: list[str]) -> dict[tuple, tuple]:
        """Fetch current content for every staged key, chunked."""
        keys = list(self.staged)
        key_sql = "(" + ", ".join(self.key_cols) + ")"
        tuple_sql = "(" + ", ".join(["%s"] * len(self.key_cols)) + ")"
        n = len(self.key_cols)
        existing: dict[tuple, tuple] = {}
        for start in range(0, len(keys), self.PREFETCH_CHUNK):
            chunk = keys[start : start + self.PREFETCH_CHUNK]
            in_sql = ", ".join([tuple_sql] * len(chunk))
            cur.execute(
                f"SELECT {', '.join(self.key_cols)}, {', '.join(content_cols)} "
                f"FROM {self.table} WHERE {key_sql} IN ({in_sql})",
                [v for key in chunk for v in key],
            )
            existing.update({tuple(row[:n]): tuple(row[n:]) for row in cur.fetchall()})
        return existing


# ---------------------------------------------------------------- snapshots


def catalog_snapshot(cur, source: str, path: Path, meta: dict) -> int:
    """Insert or reuse the snapshot-catalog row for a raw artifact.

    The raw layer is append-only (ADR-0006): re-cataloging a path with
    different bytes is corruption, never an update.
    """
    rel = dp.repo_relative(path)
    sha = hashlib.sha256(path.read_bytes()).hexdigest()
    cur.execute(
        "SELECT snapshot_id, content_sha256 FROM snapshot WHERE path = %s", (rel,)
    )
    row = cur.fetchone()
    if row is not None:
        if row[1] != sha:
            raise LoadHalt(
                f"snapshot {rel} content changed on disk (sha256 {row[1][:12]}… -> "
                f"{sha[:12]}…) — the raw layer is append-only; investigate"
            )
        return row[0]
    cur.execute(
        "INSERT INTO snapshot (source, path, pull_date, season, season_type,"
        " player_id, game_id, content_sha256)"
        " VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING snapshot_id",
        (
            source,
            rel,
            str(meta["pull_date"]),
            # Game-scoped artifacts (pbp/box) state game_id and no season;
            # season-scoped artifacts the reverse (0002_game_corpus.sql).
            str(meta["season"]) if "season" in meta else None,
            str(meta["season_type"]) if "season_type" in meta else None,
            int(meta["player_id"]) if "player_id" in meta else None,
            str(meta["game_id"]) if "game_id" in meta else None,
            sha,
        ),
    )
    return cur.fetchone()[0]


# ------------------------------------------------------------------- load


def load_hero_season(
    conn,
    snapshot_path: Path,
    advanced_path: Path,
    allow_changed: bool = False,
) -> dict:
    """Load one hero-season; return the change-detection report.

    Runs in a single transaction: any failure (validation, oracle, halt)
    rolls the whole load back.
    """
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    meta, _post_drop, _league, _conflicts = dp.validate_snapshot(snapshot)
    season = str(meta["season"])
    season_type = str(meta["season_type"])
    player_id = int(meta["player_id"])

    # Full pre-drop frames — the store keeps conflict rows (ADR-0019).
    shots = dp.result_set(snapshot["response"], "Shot_Chart_Detail")
    league = dp.result_set(snapshot["response"], "LeagueAverages")

    advanced = json.loads(advanced_path.read_text(encoding="utf-8"))
    adv_meta = advanced["_meta"]
    # The FGA-oracle fence (ADR-0069), exactly as the derive runs it: the
    # Advanced artifact must describe this snapshot's season-to-date record.
    dp.read_usage(
        advanced_path,
        season,
        player_id,
        pre_drop_fga=len(shots),
        games_included=int(shots["GAME_ID"].nunique()),
    )
    adv_rows = dp.result_set(advanced["response"], dp.ADVANCED_RESULT_SET)
    for col in ("PLAYER_ID", "PLAYER_NAME", "GP", "FGA", "USG_PCT"):
        if col not in adv_rows.columns:
            sys.exit(f"load: advanced artifact missing column {col}")

    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO load_run (kind) VALUES ('hero-season') RETURNING run_id"
            )
            run_id = cur.fetchone()[0]
            shot_snap = catalog_snapshot(cur, "shotchartdetail", snapshot_path, meta)
            adv_snap = catalog_snapshot(cur, "league-advanced", advanced_path, adv_meta)
            cur.executemany(
                "INSERT INTO load_run_snapshot (run_id, snapshot_id) VALUES (%s, %s)"
                " ON CONFLICT DO NOTHING",
                [(run_id, shot_snap), (run_id, adv_snap)],
            )

            players = TableUpsert("player", ("player_id",))
            teams = TableUpsert("team", ("team_id",))
            games = TableUpsert("game", ("game_id",))
            shot_rows = TableUpsert("shot", ("game_id", "game_event_id"))
            baseline = TableUpsert(
                "league_zone_baseline",
                ("season", "season_type", "zone_basic", "zone_area", "zone_range"),
            )
            player_seasons = TableUpsert(
                "player_season", ("player_id", "season", "season_type")
            )

            # League-wide roster + sourced season facts from the Advanced
            # artifact. Staged before the snapshot's hero row so the scorer's
            # record (the snapshot _meta) wins any naming difference in-run.
            for row in adv_rows.itertuples(index=False):
                players.stage({
                    "player_id": int(row.PLAYER_ID),
                    "name": str(row.PLAYER_NAME),
                    "snapshot_id": adv_snap,
                    "run_id": run_id,
                })
                player_seasons.stage({
                    "player_id": int(row.PLAYER_ID),
                    "season": season,
                    "season_type": season_type,
                    "gp": int(row.GP),
                    "fga": int(row.FGA),
                    "usg_pct": float(row.USG_PCT),
                    "snapshot_id": adv_snap,
                    "run_id": run_id,
                })
            players.stage({
                "player_id": player_id,
                "name": str(meta["player"]),
                "snapshot_id": shot_snap,
                "run_id": run_id,
            })

            game_facts: dict[str, tuple] = {}
            for idx, row in enumerate(shots.itertuples(index=False)):
                game_id = str(row.GAME_ID)
                d = str(row.GAME_DATE)
                facts = (f"{d[:4]}-{d[4:6]}-{d[6:]}", str(row.HTM), str(row.VTM))
                if game_facts.setdefault(game_id, facts) != facts:
                    sys.exit(
                        f"load: game {game_id} rows disagree on date/HTM/VTM — "
                        f"snapshot inconsistent"
                    )
                teams.stage({
                    "team_id": int(row.TEAM_ID),
                    "name": str(row.TEAM_NAME),
                    "snapshot_id": shot_snap,
                    "run_id": run_id,
                })
                shot_rows.stage({
                    "game_id": game_id,
                    "game_event_id": int(row.GAME_EVENT_ID),
                    "player_id": int(row.PLAYER_ID),
                    "team_id": int(row.TEAM_ID),
                    "period": int(row.PERIOD),
                    "minutes_remaining": int(row.MINUTES_REMAINING),
                    "seconds_remaining": int(row.SECONDS_REMAINING),
                    "made": bool(row.SHOT_MADE_FLAG == 1),
                    "point_value": dp.SHOT_TYPE_POINTS[str(row.SHOT_TYPE)],
                    "zone_basic": str(row.SHOT_ZONE_BASIC),
                    "zone_area": str(row.SHOT_ZONE_AREA),
                    "zone_range": dp.normalize_range(str(row.SHOT_ZONE_RANGE)),
                    "distance_ft": int(row.SHOT_DISTANCE),
                    "loc_x": int(row.LOC_X),
                    "loc_y": int(row.LOC_Y),
                    "action_type": str(row.ACTION_TYPE),
                    "source_row": idx,
                    "snapshot_id": shot_snap,
                    "run_id": run_id,
                })
            for game_id, (game_date, htm, vtm) in game_facts.items():
                games.stage({
                    "game_id": game_id,
                    "game_date": date.fromisoformat(game_date),
                    "season": season,
                    "season_type": season_type,
                    "home_abbrev": htm,
                    "visitor_abbrev": vtm,
                    "snapshot_id": shot_snap,
                    "run_id": run_id,
                })

            for row in league.itertuples(index=False):
                baseline.stage({
                    "season": season,
                    "season_type": season_type,
                    "zone_basic": str(row.SHOT_ZONE_BASIC),
                    "zone_area": str(row.SHOT_ZONE_AREA),
                    "zone_range": dp.normalize_range(str(row.SHOT_ZONE_RANGE)),
                    "fga": int(row.FGA),
                    "fgm": int(row.FGM),
                    "snapshot_id": shot_snap,
                    "run_id": run_id,
                })

            report: dict = {}
            changed_detail: list[str] = []
            # Reference rows flush before the event rows that FK them.
            for table in (players, teams, games, shot_rows, baseline, player_seasons):
                table.flush(cur, report, changed_detail)

            total_changed = sum(c["changed"] for c in report.values())
            if total_changed and not allow_changed:
                raise LoadHalt(
                    f"{total_changed} row(s) changed against current state — a "
                    f"correction to already-loaded observations. First diffs:\n  "
                    + "\n  ".join(changed_detail[:10])
                    + "\nRe-run with --allow-changed to accept them."
                )
            cur.execute(
                "UPDATE load_run SET report = %s WHERE run_id = %s",
                (Jsonb(report), run_id),
            )
        conn.commit()
        return report
    except BaseException:
        conn.rollback()
        raise


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Load one hero-season's shot-side sources into the record store."
    )
    ap.add_argument("--player", default="Cody Williams")
    ap.add_argument("--season", default="2025-26")
    ap.add_argument("--raw-root", default="data/raw")
    ap.add_argument("--snapshot-file", help="explicit snapshot path (bypasses raw-root)")
    ap.add_argument("--advanced-file", help="explicit advanced artifact path")
    ap.add_argument("--db-url", help="Postgres DSN (default: NBA_DB_URL)")
    ap.add_argument("--allow-changed", action="store_true",
                    help="accept changed rows instead of halting")
    args = ap.parse_args()

    if args.snapshot_file:
        snapshot_path = Path(args.snapshot_file)
    else:
        slug = args.player.lower().replace(" ", "-")
        snapshot_path = dp.latest_snapshot_path(Path(args.raw_root), slug, args.season)
    if args.advanced_file:
        advanced_path = Path(args.advanced_file)
    else:
        advanced_path = dp.latest_advanced_path(Path(args.raw_root), args.season)

    with rs.connect(rs.resolve_dsn(args.db_url)) as conn:
        rs.apply_migrations(conn)
        try:
            report = load_hero_season(
                conn, snapshot_path, advanced_path, allow_changed=args.allow_changed
            )
        except LoadHalt as halt:
            sys.exit(f"load: HALT — {halt}")

    print(f"loaded {snapshot_path} + {advanced_path}")
    for table, counts in report.items():
        print(f"  {table:<22} inserted={counts['inserted']:<6} "
              f"unchanged={counts['unchanged']:<6} changed={counts['changed']}")


if __name__ == "__main__":
    main()
