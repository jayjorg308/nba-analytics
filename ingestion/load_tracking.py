"""Load a hero-season's tracking snapshots into the record store (ADR-0080).

WHAT THIS DOES:
  For a (player, season) already loaded by load_hero_season.py, catalog the
  latest player tracking snapshot and the season's league tracking snapshot,
  then upsert their observations at their sources' own grains: the player
  dashboards' context rows into creation_split (rows the dashboard emitted —
  absent zero-attempt contexts stay absent, the export zero-fills), and the
  league baseline's TEAM rows into league_creation_team (family 'overall'
  plus every filtered context call, General's contexts keyed by context name
  via _meta.resolved_filters). League team rows also name any team the team
  table has never seen, in stats.nba.com's own TEAM_NAME form.

  Validation is the creation derive's own (headers, vocabulary, duplicate
  rows, stat sanity), and the ADR-0030 reconciliation arithmetic runs at
  load: the General identity against the sibling shots' pre-drop season FGA
  (a negative shortfall is contradiction and hard-fails), coverage families
  against the tracking Overall, and the league residual/coverage checks.
  Change detection and --allow-changed behave as everywhere else.

USAGE:
  python ingestion/load_tracking.py --player "Cody Williams" --season 2025-26
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import derive_creation as dc
import load_hero_season as lhs
import record_store as rs


def _validated_family_frame(response: dict, rs_name: str, context_col: str,
                            contexts: list[str]):
    """The player dashboard frame for one family, validated exactly as the
    derive validates it (vocabulary, duplicates, stat sanity)."""
    df = dc.result_set(response, rs_name)
    if df is None:
        sys.exit(f"load-tracking: result set {rs_name} missing from response")
    if list(df.columns) != dc.player_headers(context_col):
        sys.exit(f"load-tracking: {rs_name} headers changed: {list(df.columns)}")
    unknown = set(df[context_col].astype(str)) - set(contexts)
    if unknown:
        sys.exit(f"load-tracking: unknown {context_col} literals in {rs_name}: "
                 f"{sorted(unknown)} — the NBA vocabulary changed")
    dupes = df[context_col][df[context_col].duplicated()].tolist()
    if dupes:
        sys.exit(f"load-tracking: {rs_name}: duplicated context rows: {dupes}")
    dc.check_stat_sanity(df, rs_name)
    return df


def _validated_league_frame(raw: dict, frame_name: str):
    df = dc.league_frame(raw)
    if list(df.columns) != dc.LEAGUE_HEADERS:
        sys.exit(f"load-tracking: {frame_name} headers changed: {list(df.columns)}")
    if df.empty:
        sys.exit(f"load-tracking: {frame_name}: empty league frame")
    dc.check_stat_sanity(df, frame_name)
    return df


def _stats(row) -> dict:
    return {"fga": int(row["FGA"]), "fgm": int(row["FGM"]),
            "fg2a": int(row["FG2A"]), "fg2m": int(row["FG2M"]),
            "fg3a": int(row["FG3A"]), "fg3m": int(row["FG3M"])}


def load_tracking(
    conn,
    player: str,
    season: str,
    *,
    raw_root: Path = Path("data/raw"),
    snapshot_path: Path | None = None,
    league_path: Path | None = None,
    allow_changed: bool = False,
) -> dict:
    slug = player.lower().replace(" ", "-")
    if snapshot_path is None:
        snapshot_path = dc.latest_snapshot(
            raw_root / slug / season / "tracking", "ingestion/pull_tracking.py")
    if league_path is None:
        league_path = dc.latest_snapshot(
            raw_root / "_league" / season / "tracking", "ingestion/pull_tracking.py")
    player_snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    league_snapshot = json.loads(league_path.read_text(encoding="utf-8"))

    meta = player_snapshot.get("_meta")
    response = player_snapshot.get("response")
    if not isinstance(meta, dict) or not isinstance(response, dict):
        sys.exit("load-tracking: player snapshot missing _meta/response")
    dc.check_meta(meta, dc.PLAYER_META_KEYS, "player")
    dc.check_meta(league_snapshot.get("_meta"), dc.LEAGUE_META_KEYS, "league")
    if league_snapshot["_meta"]["season"] != meta["season"]:
        sys.exit(f"load-tracking: league snapshot season "
                 f"{league_snapshot['_meta']['season']} != player snapshot "
                 f"season {meta['season']}")
    player_id = int(meta["player_id"])
    season = str(meta["season"])
    season_type = str(meta["season_type"])

    try:
        with conn.cursor() as cur:
            # The sibling anchor (ADR-0030): pre-drop season FGA from stored
            # shots — the hero-season must be loaded first.
            cur.execute(
                "SELECT count(*) FROM shot s JOIN game g USING (game_id)"
                " WHERE s.player_id = %s AND g.season = %s AND g.season_type = %s",
                (player_id, season, season_type),
            )
            pre_drop_fga = cur.fetchone()[0]
            if pre_drop_fga == 0:
                sys.exit(f"load-tracking: no shots for {player!r} {season} in "
                         f"the store — run load_hero_season.py first")

            cur.execute("INSERT INTO load_run (kind) VALUES ('tracking') RETURNING run_id")
            run_id = cur.fetchone()[0]
            player_snap = lhs.catalog_snapshot(cur, "tracking-player", snapshot_path, meta)
            league_snap = lhs.catalog_snapshot(cur, "tracking-league", league_path,
                                               league_snapshot["_meta"])
            cur.executemany(
                "INSERT INTO load_run_snapshot (run_id, snapshot_id) VALUES (%s, %s)"
                " ON CONFLICT DO NOTHING",
                [(run_id, player_snap), (run_id, league_snap)],
            )

            teams = lhs.TableUpsert("team", ("team_id",))
            splits = lhs.TableUpsert(
                "creation_split",
                ("player_id", "season", "season_type", "family", "context"),
            )
            league_rows = lhs.TableUpsert(
                "league_creation_team",
                ("season", "season_type", "family", "context", "team_id"),
            )
            cur.execute("SELECT team_id FROM team")
            known_teams = {row[0] for row in cur.fetchall()}

            family_sums: dict[str, int] = {}
            for key, rs_name, context_col, contexts in dc.FAMILIES:
                df = _validated_family_frame(response, rs_name, context_col, contexts)
                if not (df["PLAYER_ID"].astype(int) == player_id).all():
                    sys.exit(f"load-tracking: {rs_name} rows are not all player "
                             f"{player_id} — snapshot inconsistent")
                family_sums[key] = int(df["FGA"].sum())
                for _, row in df.iterrows():
                    splits.stage({
                        "player_id": player_id, "season": season,
                        "season_type": season_type, "family": key,
                        "context": str(row[context_col]), **_stats(row),
                        "snapshot_id": player_snap, "run_id": run_id,
                    })

            def stage_league(family: str, context: str, raw: dict) -> int:
                df = _validated_league_frame(raw, f"league {family} {context!r}")
                for _, row in df.iterrows():
                    team_id = int(row["TEAM_ID"])
                    name = str(row["TEAM_NAME"]).strip()
                    if team_id not in known_teams and name:
                        teams.stage({"team_id": team_id, "name": name,
                                     "snapshot_id": league_snap, "run_id": run_id})
                        known_teams.add(team_id)
                    league_rows.stage({
                        "season": season, "season_type": season_type,
                        "family": family, "context": context,
                        "team_id": team_id, **_stats(row),
                        "snapshot_id": league_snap, "run_id": run_id,
                    })
                return int(df["FGA"].sum())

            overall_fga = stage_league("overall", "Overall", league_snapshot["overall"])
            resolved_filters = league_snapshot["_meta"]["resolved_filters"]
            resolved_sum = 0
            unresolved: list[str] = []
            for context in dc.GENERAL_CONTEXTS:
                literal = resolved_filters.get(context)
                if literal is None:
                    unresolved.append(context)
                    continue
                raw = league_snapshot.get("general", {}).get(literal)
                if raw is None:
                    sys.exit(f"load-tracking: league snapshot has no response for "
                             f"General filter {literal!r} (context {context!r})")
                resolved_sum += stage_league("general", context, raw)
            if len(unresolved) > 1:
                sys.exit(f"load-tracking: multiple unresolved General contexts "
                         f"{unresolved} — the residual cannot be split")
            if unresolved and resolved_sum > overall_fga:
                sys.exit(f"load-tracking: resolved General contexts sum to "
                         f"{resolved_sum}, exceeding Overall {overall_fga}")
            if not unresolved and resolved_sum != overall_fga:
                sys.exit(f"load-tracking: league General sums to {resolved_sum} "
                         f"but Overall is {overall_fga} with no residual context")

            for family, section, contexts in (
                ("shotClock", "shot_clock", dc.SHOT_CLOCK_BANDS),
                ("closestDefender", "closest_defender", dc.DEFENDER_RANGES),
            ):
                total = 0
                for context in contexts:
                    raw = league_snapshot.get(section, {}).get(context)
                    if raw is None:
                        sys.exit(f"load-tracking: league snapshot missing {family} "
                                 f"context {context!r} — baseline incomplete")
                    total += stage_league(family, context, raw)
                if total > overall_fga:
                    sys.exit(f"load-tracking: league {family} contexts sum to "
                             f"{total}, exceeding Overall {overall_fga}")

            # The hero-grain identity (ADR-0030 as amended): exact-or-reported.
            tracking_shortfall = pre_drop_fga - family_sums["general"]
            if tracking_shortfall < 0:
                sys.exit(f"load-tracking: General family sums to "
                         f"{family_sums['general']} FGA, EXCEEDING the stored "
                         f"pre-drop season total {pre_drop_fga} — tracking cannot "
                         f"outcount the official record")
            for key, label in (("shotClock", "Shot Clock"),
                               ("closestDefender", "Closest Defender")):
                if family_sums[key] > family_sums["general"]:
                    sys.exit(f"load-tracking: {label} family sums to "
                             f"{family_sums[key]}, exceeding the tracking "
                             f"Overall {family_sums['general']}")

            report: dict = {}
            changed_detail: list[str] = []
            for table in (teams, splits, league_rows):
                table.flush(cur, report, changed_detail)
            total_changed = sum(c["changed"] for c in report.values())
            if total_changed and not allow_changed:
                raise lhs.LoadHalt(
                    f"{total_changed} row(s) changed against current state. First diffs:\n  "
                    + "\n  ".join(changed_detail[:10])
                    + "\nRe-run with --allow-changed to accept them."
                )
            cur.execute("UPDATE load_run SET report = %s WHERE run_id = %s",
                        (lhs.Jsonb(report), run_id))
        conn.commit()
        report["_trackingShortfall"] = tracking_shortfall
        return report
    except BaseException:
        conn.rollback()
        raise


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Load a hero-season's tracking snapshots into the record store."
    )
    ap.add_argument("--player", default="Cody Williams")
    ap.add_argument("--season", default="2025-26")
    ap.add_argument("--raw-root", default="data/raw")
    ap.add_argument("--snapshot-file", help="explicit player tracking snapshot path")
    ap.add_argument("--league-file", help="explicit league tracking snapshot path")
    ap.add_argument("--db-url", help="Postgres DSN (default: NBA_DB_URL)")
    ap.add_argument("--allow-changed", action="store_true")
    args = ap.parse_args()

    with rs.connect(rs.resolve_dsn(args.db_url)) as conn:
        rs.apply_migrations(conn)
        try:
            report = load_tracking(
                conn, args.player, args.season,
                raw_root=Path(args.raw_root),
                snapshot_path=Path(args.snapshot_file) if args.snapshot_file else None,
                league_path=Path(args.league_file) if args.league_file else None,
                allow_changed=args.allow_changed,
            )
        except lhs.LoadHalt as halt:
            sys.exit(f"load-tracking: HALT — {halt}")

    shortfall = report.pop("_trackingShortfall")
    print(f"tracking loaded for {args.player} {args.season} "
          f"(tracking shortfall {shortfall})")
    for table, counts in report.items():
        print(f"  {table:<22} inserted={counts['inserted']:<6} "
              f"unchanged={counts['unchanged']:<6} changed={counts['changed']}")


if __name__ == "__main__":
    main()
