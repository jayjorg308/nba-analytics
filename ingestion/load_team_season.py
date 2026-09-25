"""Load one team-season's shot-side sources into the record store (ADR-0082).

WHAT THIS DOES:
  For a (team, season), catalog the raw team-wide shotchartdetail snapshot
  and the session's roster snapshot, then upsert their observations at
  natural NBA identity:
    - shot (pre-drop, into the EXISTING table — a shot is a shot; a Jazz
      hero's rows arrive from his own pull and from this one and must
      agree, change detection arbitrating),
    - game (date/HTM/VTM; a corpus-only game learns its date here — a
      NULL becoming observed is growth, never a correction),
    - team and player rows the store has never named (names are never
      re-asserted for known rows: the shot chart and the roster spell
      diacritics differently, and a spelling is not an observation to
      reconcile),
    - league_zone_baseline (fine grain, pairs never rates, monotone),
    - roster_entry (scope-complete per team-season: a departed player
      LEAVES the roster and keeps his rows — roster deletions are expected
      and reported, never a halt).

  The shot scope is complete over (team, the snapshot's games): a stored
  team shot absent from the incoming snapshot within a covered game is a
  contradiction and halts; a game the snapshot never reached (a hero pull
  running ahead of the team frontier) is not asserted. An existing row's
  response ordinal is left untouched (the hero exports order by it; the
  team export orders chronologically — ADR-0082).

THE BOX ORACLE runs here for every game whose box lines are in the store
  (per player per game, pre-drop rows == box FGA) and fails the load on a
  mismatch; games without box lines are reported as unpaired and the
  export refuses them (the pair is what the frontier is made of).

USAGE:
  python ingestion/load_team_season.py --team "Utah Jazz" --season 2026-27
  python ingestion/load_team_season.py --snapshot-file tests/fixtures/team-snapshot.truncated.json --roster-file tests/fixtures/team-roster.truncated.json
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from psycopg.types.json import Jsonb

import derive_payload as dp
import derive_team_payload as dtp
import load_hero_season as lhs
import record_store as rs
import team_payload as tp

TEAM_SOURCE = "shotchartdetail-team"
ROSTER_SOURCE = "commonteamroster"


def load_team_season(
    conn,
    snapshot_path: Path,
    roster_path: Path,
    allow_changed: bool = False,
) -> dict:
    """Load one team-season; return the change-detection report (plus
    `_unpairedGames`, the snapshot games with no box lines yet, and
    `_departed`, roster rows the incoming roster no longer lists).

    Single transaction: any failure (validation, oracle, halt) rolls the
    whole load back.
    """
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    meta, shots, league = tp.validate_team_snapshot(snapshot)
    roster_meta, roster = tp.validate_roster_snapshot(
        json.loads(roster_path.read_text(encoding="utf-8")))
    team_id = int(meta["team_id"])
    season = str(meta["season"])
    season_type = str(meta["season_type"])
    if (int(roster_meta["team_id"]), str(roster_meta["season"])) != (team_id, season):
        sys.exit(f"load-team: roster snapshot is team {roster_meta['team_id']} "
                 f"{roster_meta['season']}, shots are team {team_id} {season}")
    rows = tp.rows_from_snapshot(shots)

    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO load_run (kind) VALUES ('team-season') RETURNING run_id")
            run_id = cur.fetchone()[0]
            shot_snap = lhs.catalog_snapshot(cur, TEAM_SOURCE, snapshot_path, meta)
            roster_snap = lhs.catalog_snapshot(cur, ROSTER_SOURCE, roster_path, roster_meta)
            cur.executemany(
                "INSERT INTO load_run_snapshot (run_id, snapshot_id) VALUES (%s, %s)"
                " ON CONFLICT DO NOTHING",
                [(run_id, shot_snap), (run_id, roster_snap)],
            )

            cur.execute("SELECT player_id FROM player")
            known_players = {r[0] for r in cur.fetchall()}
            cur.execute("SELECT team_id FROM team")
            known_teams = {r[0] for r in cur.fetchall()}

            players = lhs.TableUpsert("player", ("player_id",))
            teams = lhs.TableUpsert("team", ("team_id",))
            games = lhs.TableUpsert("game", ("game_id",), fill_cols=("game_date",))
            shot_rows = lhs.TableUpsert("shot", ("game_id", "game_event_id"),
                                        free_cols=("source_row",))
            baseline = lhs.TableUpsert(
                "league_zone_baseline",
                ("season", "season_type", "zone_basic", "zone_area", "zone_range"),
                monotone_cols=("fga", "fgm"),
            )
            roster_rows = lhs.TableUpsert(
                "roster_entry", ("team_id", "season", "season_type", "player_id"),
                # Labels, not observations to reconcile: a number change or a
                # reordering never halts. Membership is the observed fact.
                free_cols=("player_name", "number", "position", "experience",
                           "source_row"),
            )

            if team_id not in known_teams:
                teams.stage({"team_id": team_id, "name": str(meta["team"]),
                             "snapshot_id": shot_snap, "run_id": run_id})
                known_teams.add(team_id)
            for r in rows:
                if r["player_id"] not in known_players:
                    players.stage({"player_id": r["player_id"], "name": r["player_name"],
                                   "snapshot_id": shot_snap, "run_id": run_id})
                    known_players.add(r["player_id"])
            for e in roster:
                if e["player_id"] not in known_players:
                    players.stage({"player_id": e["player_id"], "name": e["player_name"],
                                   "snapshot_id": roster_snap, "run_id": run_id})
                    known_players.add(e["player_id"])
                roster_rows.stage({
                    "team_id": team_id, "season": season, "season_type": season_type,
                    "player_id": e["player_id"], "player_name": e["player_name"],
                    "number": e["number"], "position": e["position"],
                    "experience": e["experience"], "source_row": e["source_row"],
                    "snapshot_id": roster_snap, "run_id": run_id,
                })

            game_facts: dict[str, tuple] = {}
            for r in rows:
                facts = (r["game_date"], r["htm"], r["vtm"])
                if game_facts.setdefault(r["game_id"], facts) != facts:
                    sys.exit(f"load-team: game {r['game_id']} rows disagree on "
                             f"date/HTM/VTM — snapshot inconsistent")
            for game_id, (game_date, htm, vtm) in game_facts.items():
                games.stage({
                    "game_id": game_id, "game_date": date.fromisoformat(game_date),
                    "season": season, "season_type": season_type,
                    "home_abbrev": htm, "visitor_abbrev": vtm,
                    "snapshot_id": shot_snap, "run_id": run_id,
                })

            # Existing ordinals stay: the hero exports order by source_row.
            cur.execute(
                "SELECT s.game_id, s.game_event_id, s.source_row FROM shot s"
                " WHERE s.game_id = ANY(%s)", [list(game_facts)],
            )
            existing_ordinal = {(g, e): o for g, e, o in cur.fetchall()}
            for idx, r in enumerate(rows):
                key = (r["game_id"], r["game_event_id"])
                shot_rows.stage({
                    "game_id": r["game_id"], "game_event_id": r["game_event_id"],
                    "player_id": r["player_id"], "team_id": team_id,
                    "period": r["period"],
                    "minutes_remaining": r["minutes_remaining"],
                    "seconds_remaining": r["seconds_remaining"],
                    "made": r["made"], "point_value": r["point_value"],
                    "zone_basic": r["zone_basic"], "zone_area": r["zone_area"],
                    "zone_range": r["zone_range"], "distance_ft": r["distance_ft"],
                    "loc_x": r["loc_x"], "loc_y": r["loc_y"],
                    "action_type": str(shots.iloc[idx]["ACTION_TYPE"]),
                    "source_row": existing_ordinal.get(key, idx),
                    "snapshot_id": shot_snap, "run_id": run_id,
                })
            for lrow in league.itertuples(index=False):
                baseline.stage({
                    "season": season, "season_type": season_type,
                    "zone_basic": str(lrow.SHOT_ZONE_BASIC),
                    "zone_area": str(lrow.SHOT_ZONE_AREA),
                    "zone_range": dp.normalize_range(str(lrow.SHOT_ZONE_RANGE)),
                    "fga": int(lrow.FGA), "fgm": int(lrow.FGM),
                    "snapshot_id": shot_snap, "run_id": run_id,
                })

            report: dict = {}
            changed_detail: list[str] = []
            players.flush(cur, report, changed_detail)
            teams.flush(cur, report, changed_detail)
            games.flush(cur, report, changed_detail)
            # Complete over the GAMES THE SNAPSHOT COVERS, not the season: a
            # hero's own pull may run ahead of the team pull's frontier (or
            # behind it), and rows from a game this snapshot never reached
            # are not contradictions. Within a covered game, a vanished row
            # still is.
            shot_rows.flush(cur, report, changed_detail, scope=(
                "team_id = %s AND game_id = ANY(%s)",
                [team_id, list(game_facts)],
            ))
            baseline.flush(cur, report, changed_detail,
                           scope=("season = %s AND season_type = %s", [season, season_type]))
            roster_scope = ("team_id = %s AND season = %s AND season_type = %s",
                            [team_id, season, season_type])
            roster_detail: list[str] = []
            roster_rows.flush(cur, report, roster_detail, scope=roster_scope)
            departed = report["roster_entry"]["deleted"]
            # Roster deletions are the expected shape of a trade or a waiver;
            # everything else that changed or vanished is a contradiction.
            halting = (sum(c["changed"] + c["deleted"] for c in report.values())
                       - departed)
            changed_detail += [d for d in roster_detail if "DELETED" not in d]
            if halting and not allow_changed:
                raise lhs.LoadHalt(
                    f"{halting} row(s) changed or deleted against current state "
                    f"— a correction to already-loaded observations. First diffs:\n  "
                    + "\n  ".join(changed_detail[:10])
                    + "\nRe-run with --allow-changed to accept them."
                )

            # The box oracle over every game whose lines are in the store.
            cur.execute(
                "SELECT game_id, player_id, fga FROM box_score_line"
                " WHERE team_id = %s AND game_id = ANY(%s)",
                (team_id, list(game_facts)),
            )
            box_fga: dict[str, dict[int, int]] = {}
            for game_id, player_id, fga in cur.fetchall():
                box_fga.setdefault(game_id, {})[player_id] = fga
            paired_rows = [r for r in rows if r["game_id"] in box_fga]
            if paired_rows:
                tp.reconcile_box(paired_rows, box_fga)
            unpaired = sorted(set(game_facts) - set(box_fga))

            rs.set_head(cur, rs.scope_key(TEAM_SOURCE, season=season,
                                          season_type=season_type, team_id=team_id),
                        shot_snap, run_id)
            rs.set_head(cur, rs.scope_key(ROSTER_SOURCE, season=season,
                                          season_type=season_type, team_id=team_id),
                        roster_snap, run_id)
            cur.execute("UPDATE load_run SET report = %s WHERE run_id = %s",
                        (Jsonb(report), run_id))
        conn.commit()
        report["_unpairedGames"] = unpaired
        report["_departed"] = departed
        return report
    except BaseException:
        conn.rollback()
        raise


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Load one team-season's shot-side sources into the record store."
    )
    ap.add_argument("--team", default="Utah Jazz")
    ap.add_argument("--season", default="2026-27")
    ap.add_argument("--raw-root", default="data/raw")
    ap.add_argument("--snapshot-file", help="explicit team snapshot path (bypasses raw-root)")
    ap.add_argument("--roster-file", help="explicit roster snapshot path")
    ap.add_argument("--db-url", help="Postgres DSN (default: NBA_DB_URL)")
    ap.add_argument("--allow-changed", action="store_true",
                    help="accept changed rows instead of halting")
    args = ap.parse_args()

    raw_root = Path(args.raw_root)
    snapshot_path = (Path(args.snapshot_file) if args.snapshot_file
                     else dtp.latest_team_snapshot(raw_root, args.team, args.season))
    roster_path = (Path(args.roster_file) if args.roster_file
                   else dtp.latest_roster_snapshot(raw_root, args.team, args.season))

    with rs.connect(rs.resolve_dsn(args.db_url)) as conn:
        rs.apply_migrations(conn)
        try:
            report = load_team_season(conn, snapshot_path, roster_path,
                                      allow_changed=args.allow_changed)
        except lhs.LoadHalt as halt:
            sys.exit(f"load-team: HALT — {halt}")

    print(f"loaded {snapshot_path} + {roster_path}")
    for table, counts in report.items():
        if table.startswith("_"):
            continue
        print(f"  {table:<22} inserted={counts['inserted']:<6} "
              f"unchanged={counts['unchanged']:<6} grown={counts['grown']:<5} "
              f"changed={counts['changed']:<4} deleted={counts['deleted']}")
    if report["_departed"]:
        print(f"  roster: {report['_departed']} player(s) departed")
    if report["_unpairedGames"]:
        print(f"  unpaired games (no box lines yet): {len(report['_unpairedGames'])} — "
              f"the export refuses them until their pairs load")


if __name__ == "__main__":
    main()
