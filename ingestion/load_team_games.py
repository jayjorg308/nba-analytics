"""Load one-day team shot pulls into the record store (ADR-0088): the
report card's opponent side.

WHAT THIS DOES:
  Each snapshot is one team's shots in one game, a team-wide
  shotchartdetail windowed to the game's date (live_pulls.
  pull_team_game_snapshot). Its rows upsert into the EXISTING shot table at
  natural identity, exactly as the team season loader's do: a shot is a
  shot, and a player whose rows already arrived from his own pull (a hero)
  or another team pull must agree, change detection arbitrating. The shot
  scope is complete over (team, game): a stored row of that team in that
  game missing from the incoming snapshot is a contradiction and halts.

  The snapshot's one-day LeagueAverages frame is NOT loaded: it is that
  day's league only, never a ruler (rulers load through load_rulers.py).

THE BOX ORACLE runs for every game whose box lines are in the store (per
  player, pre-drop rows == box FGA, and every box line with attempts has
  rows); a game whose pair is not loaded yet is reported as unpaired, and
  the game payload export refuses it.

USAGE:
  python ingestion/load_team_games.py --season 2025-26 --opponents-of uta
  python ingestion/load_team_games.py --snapshot-files <a.json> <b.json>
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

import load_hero_season as lhs
import record_store as rs
import team_payload as tp

TEAM_GAME_SOURCE = "shotchartdetail-team-game"
TEAM_GAME_META_KEYS = ("game_id", "game_date")


def fail(msg: str) -> None:
    sys.exit(f"load-team-games: {msg}")


def validate_team_game_snapshot(snapshot: dict):
    """(_meta, shots PRE-DROP) for one one-day team pull: the team snapshot's
    checks plus the game identity — every row is the snapshot's game, on its
    date."""
    meta, shots, _league = tp.validate_team_snapshot(snapshot)
    missing = [k for k in TEAM_GAME_META_KEYS if k not in meta]
    if missing:
        fail(f"_meta missing keys: {missing} — not a one-day team pull")
    game_ids = set(str(g) for g in shots["GAME_ID"])
    if game_ids != {str(meta["game_id"])}:
        fail(f"rows carry games {sorted(game_ids)}, snapshot is game {meta['game_id']}")
    stamp = str(meta["game_date"]).replace("-", "")
    if set(str(d) for d in shots["GAME_DATE"]) != {stamp}:
        fail(f"game {meta['game_id']}: rows are not all dated {meta['game_date']}")
    return meta, shots


def load_team_games(conn, snapshot_paths: list[Path], allow_changed: bool = False) -> dict:
    """Load one-day team snapshots in one transaction; return the
    change-detection report plus `_unpairedGames` (games with no box lines
    for that team yet). Any halt rolls the whole load back."""
    parsed = []
    for path in snapshot_paths:
        meta, shots = validate_team_game_snapshot(json.loads(path.read_text(encoding="utf-8")))
        parsed.append((path, meta, shots, tp.rows_from_snapshot(shots)))
    seen: set[tuple[int, str]] = set()
    for _, meta, _, _ in parsed:
        key = (int(meta["team_id"]), str(meta["game_id"]))
        if key in seen:
            fail(f"two snapshots for team {key[0]} game {key[1]} in one load")
        seen.add(key)

    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO load_run (kind) VALUES ('team-games') RETURNING run_id")
            run_id = cur.fetchone()[0]
            cur.execute("SELECT player_id FROM player")
            known_players = {r[0] for r in cur.fetchall()}
            cur.execute("SELECT team_id FROM team")
            known_teams = {r[0] for r in cur.fetchall()}

            players = lhs.TableUpsert("player", ("player_id",))
            teams = lhs.TableUpsert("team", ("team_id",))
            games = lhs.TableUpsert("game", ("game_id",), fill_cols=("game_date",))
            shot_parts: list[tuple[int, str, lhs.TableUpsert]] = []
            heads: list[tuple[str, int]] = []
            for path, meta, shots, rows in parsed:
                team_id, game_id = int(meta["team_id"]), str(meta["game_id"])
                snap = lhs.catalog_snapshot(cur, TEAM_GAME_SOURCE, path, meta)
                cur.execute("INSERT INTO load_run_snapshot (run_id, snapshot_id) VALUES (%s, %s)"
                            " ON CONFLICT DO NOTHING", (run_id, snap))
                if team_id not in known_teams:
                    teams.stage({"team_id": team_id, "name": str(meta["team"]),
                                 "snapshot_id": snap, "run_id": run_id})
                    known_teams.add(team_id)
                for r in rows:
                    if r["player_id"] not in known_players:
                        players.stage({"player_id": r["player_id"], "name": r["player_name"],
                                       "snapshot_id": snap, "run_id": run_id})
                        known_players.add(r["player_id"])
                facts = {(r["game_date"], r["htm"], r["vtm"]) for r in rows}
                if len(facts) != 1:
                    fail(f"game {game_id}: rows disagree on date/HTM/VTM — snapshot inconsistent")
                game_date, htm, vtm = facts.pop()
                season, season_type = str(meta["season"]), str(meta["season_type"])
                games.stage({
                    "game_id": game_id, "game_date": date.fromisoformat(game_date),
                    "season": season, "season_type": season_type,
                    "home_abbrev": htm, "visitor_abbrev": vtm,
                    "snapshot_id": snap, "run_id": run_id,
                })
                cur.execute("SELECT game_event_id, source_row FROM shot WHERE game_id = %s",
                            (game_id,))
                existing_ordinal = dict(cur.fetchall())
                part = lhs.TableUpsert("shot", ("game_id", "game_event_id"),
                                       free_cols=("source_row",))
                for idx, r in enumerate(rows):
                    part.stage({
                        "game_id": game_id, "game_event_id": r["game_event_id"],
                        "player_id": r["player_id"], "team_id": team_id,
                        "period": r["period"], "minutes_remaining": r["minutes_remaining"],
                        "seconds_remaining": r["seconds_remaining"], "made": r["made"],
                        "point_value": r["point_value"], "zone_basic": r["zone_basic"],
                        "zone_area": r["zone_area"], "zone_range": r["zone_range"],
                        "distance_ft": r["distance_ft"], "loc_x": r["loc_x"], "loc_y": r["loc_y"],
                        "action_type": str(shots.iloc[idx]["ACTION_TYPE"]),
                        # An existing ordinal stays: hero exports order by it.
                        "source_row": existing_ordinal.get(r["game_event_id"], idx),
                        "snapshot_id": snap, "run_id": run_id,
                    })
                shot_parts.append((team_id, game_id, part))
                heads.append((rs.scope_key(TEAM_GAME_SOURCE, season=season,
                                           season_type=season_type, game_id=game_id,
                                           team_id=team_id), snap))

            report: dict = {}
            changed_detail: list[str] = []
            players.flush(cur, report, changed_detail)
            teams.flush(cur, report, changed_detail)
            games.flush(cur, report, changed_detail)
            shot_counts = {"inserted": 0, "unchanged": 0, "grown": 0, "changed": 0, "deleted": 0}
            for team_id, game_id, part in shot_parts:
                part.flush(cur, report, changed_detail, scope=(
                    "team_id = %s AND game_id = %s", [team_id, game_id]))
                for k, v in report["shot"].items():
                    shot_counts[k] += v
            report["shot"] = shot_counts
            halting = sum(c["changed"] + c["deleted"] for c in report.values())
            if halting and not allow_changed:
                raise lhs.LoadHalt(
                    f"{halting} row(s) changed or deleted against current state. First diffs:\n  "
                    + "\n  ".join(changed_detail[:10])
                    + "\nRe-run with --allow-changed to accept them."
                )

            unpaired: list[str] = []
            for _, meta, _, rows in parsed:
                team_id, game_id = int(meta["team_id"]), str(meta["game_id"])
                cur.execute("SELECT player_id, fga FROM box_score_line"
                            " WHERE game_id = %s AND team_id = %s", (game_id, team_id))
                box = dict(cur.fetchall())
                if not box:
                    unpaired.append(game_id)
                    continue
                tp.reconcile_box(rows, {game_id: box})
            for key, snap in heads:
                rs.set_head(cur, key, snap, run_id)
            cur.execute("UPDATE load_run SET report = %s WHERE run_id = %s",
                        (lhs.Jsonb(report), run_id))
        conn.commit()
        report["_unpairedGames"] = sorted(unpaired)
        return report
    except BaseException:
        conn.rollback()
        raise


def opponent_snapshots(raw_root: Path, season: str, exclude_tricode: str) -> list[Path]:
    """The latest one-day pull per (team, game) under data/raw/_teams/, every
    team except the subject (its own rows come from its season pull)."""
    paths = []
    teams_root = raw_root / "_teams"
    for team_dir in sorted(p for p in teams_root.iterdir() if p.is_dir()):
        if team_dir.name == exclude_tricode.lower():
            continue
        games_root = team_dir / season / "games"
        if not games_root.exists():
            continue
        for game_dir in sorted(p for p in games_root.iterdir() if p.is_dir()):
            snaps = sorted(game_dir.glob("*.json"))
            if snaps:
                paths.append(snaps[-1])
    return paths


def main() -> None:
    ap = argparse.ArgumentParser(description="Load one-day team shot pulls (the opponent side).")
    ap.add_argument("--season", default="2026-27")
    ap.add_argument("--opponents-of", default="uta",
                    help="the subject team's tricode: every other team's one-day pulls load")
    ap.add_argument("--raw-root", default="data/raw")
    ap.add_argument("--snapshot-files", nargs="*", help="explicit snapshots (bypasses raw-root)")
    ap.add_argument("--db-url", help="Postgres DSN (default: NBA_DB_URL)")
    ap.add_argument("--allow-changed", action="store_true")
    args = ap.parse_args()

    paths = ([Path(p) for p in args.snapshot_files] if args.snapshot_files is not None
             else opponent_snapshots(Path(args.raw_root), args.season, args.opponents_of))
    if not paths:
        fail("no one-day team pulls found — run ingestion/pull_opponent_games.py first")
    with rs.connect(rs.resolve_dsn(args.db_url)) as conn:
        rs.apply_migrations(conn)
        try:
            report = load_team_games(conn, paths, allow_changed=args.allow_changed)
        except lhs.LoadHalt as halt:
            sys.exit(f"load-team-games: HALT — {halt}")
    print(f"loaded {len(paths)} one-day team pull(s)")
    for table, counts in report.items():
        if table.startswith("_"):
            continue
        print(f"  {table:<8} inserted={counts['inserted']:<6} unchanged={counts['unchanged']:<6} "
              f"changed={counts['changed']:<4} deleted={counts['deleted']}")
    if report["_unpairedGames"]:
        print(f"  unpaired games (no box lines yet): {len(report['_unpairedGames'])}")


if __name__ == "__main__":
    main()
