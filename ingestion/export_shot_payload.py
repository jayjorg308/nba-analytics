"""Export the shot payload from the record store (ADR-0080).

The parity oracle: over the same snapshot, this export must reproduce
ingestion/derive_payload.py's output byte-identically — same field order,
same values, same serialization. --verify-against compares the export to a
committed payload and fails loudly on the first difference.

The export re-runs the pipeline fences the derive runs (zone-point conflicts
dropped and counted per ADR-0019, the usage bounds and FGA oracle per
ADR-0069, evaluation-zone baseline presence) — checks run at load AND at
export, per ADR-0080.

USAGE:
  python ingestion/export_shot_payload.py --player "Cody Williams" --season 2025-26 --out-file data/derived/...
  python ingestion/export_shot_payload.py --player "Cody Williams" --season 2025-26 --verify-against public/data/cody-williams/2025-26.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import derive_payload as dp
import record_store as rs


def fail(msg: str) -> None:
    sys.exit(f"export: {msg}")


def export_payload(
    conn, player: str, season: str, season_type: str = "Regular Season"
) -> dict:
    with conn.cursor() as cur:
        cur.execute("SELECT player_id, name FROM player WHERE name = %s", (player,))
        rows = cur.fetchall()
        if len(rows) != 1:
            fail(f"expected exactly one player named {player!r}, found {len(rows)}")
        player_id, player_name = rows[0]

        cur.execute(
            """
            SELECT s.game_id, s.game_event_id, g.game_date, t.name,
                   g.home_abbrev, g.visitor_abbrev, s.period,
                   s.minutes_remaining, s.seconds_remaining, s.made,
                   s.point_value, s.zone_basic, s.zone_area, s.zone_range,
                   s.distance_ft, s.loc_x, s.loc_y
            FROM shot s
            JOIN game g USING (game_id)
            JOIN team t ON t.team_id = s.team_id
            WHERE s.player_id = %s AND g.season = %s AND g.season_type = %s
            ORDER BY s.source_row
            """,
            (player_id, season, season_type),
        )
        shot_rows = cur.fetchall()
        if not shot_rows:
            fail(f"no shots for {player!r} {season} — load the season first")

        # The scope's current-state source, recorded at load (ADR-0080 as
        # amended) — row provenance is first-asserted lineage, never this.
        _, source_path, pull_date, snap_season_type = rs.get_head(
            cur, rs.scope_key("shotchartdetail", player_id=player_id,
                              season=season, season_type=season_type))
        if snap_season_type != season_type:
            fail(f"snapshot season_type {snap_season_type!r} != requested {season_type!r}")
        _, usage_path, _, _ = rs.get_head(
            cur, rs.scope_key("league-advanced", season=season,
                              season_type=season_type))

        cur.execute(
            "SELECT gp, fga, usg_pct FROM player_season"
            " WHERE player_id = %s AND season = %s AND season_type = %s",
            (player_id, season, season_type),
        )
        ps = cur.fetchone()
        if ps is None:
            fail(f"no player_season row for {player!r} {season} (ADR-0069)")
        gp, adv_fga, usage_pct = ps

        cur.execute(
            """
            SELECT zone_basic, zone_range, fga, fgm
            FROM league_zone_baseline
            WHERE season = %s AND season_type = %s
            """,
            (season, season_type),
        )
        baseline_rows = cur.fetchall()

    # Enrich, dropping and counting zone-point conflicts (ADR-0019) exactly
    # as the derive does: the store keeps the observed rows; the payload
    # cannot represent them.
    shots: list[dict] = []
    conflicts = 0
    for (game_id, event_id, game_date, team_name, home_abbrev, visitor_abbrev,
         period, minutes, seconds, made, point_value, zone_basic, zone_area,
         zone_range, distance_ft, loc_x, loc_y) in shot_rows:
        if (zone_basic in dp.THREE_POINT_ZONES) != (point_value == 3):
            conflicts += 1
            continue
        opponent, home = dp.matchup(team_name, home_abbrev, visitor_abbrev)
        shots.append({
            "gameId": game_id,
            "gameEventId": event_id,
            "gameDate": game_date.isoformat(),
            "opponent": opponent,
            "home": home,
            "period": period,
            "minutesRemaining": minutes,
            "secondsRemaining": seconds,
            "made": made,
            "pointValue": point_value,
            "zoneBasic": zone_basic,
            "zoneArea": zone_area,
            "zoneRange": zone_range,
            "distanceFt": distance_ft,
            "locX": loc_x,
            "locY": loc_y,
        })
    if not shots:
        fail("every shot row is a zone-point conflict — nothing to export")

    # Roll the fine-grain baseline up to the evaluation grains (ADR-0004:
    # sum pairs, never average rates), in the derive's deterministic order.
    by_basic: dict[str, list] = {}
    for zone_basic, zone_range, fga, fgm in baseline_rows:
        by_basic.setdefault(zone_basic, []).append((zone_range, fga, fgm))
    for zone in dp.EVAL_ZONES:
        if zone not in by_basic:
            fail(f"league baseline missing evaluation zone {zone!r}")
    baseline: list[dict] = []
    for zone in dp.BASIC_ZONES:
        sub = by_basic.get(zone)
        if not sub:
            continue
        baseline.append({
            "grain": "basic",
            "zone": zone,
            "fga": sum(r[1] for r in sub),
            "fgm": sum(r[2] for r in sub),
        })
    mid = by_basic.get("Mid-Range", [])
    for band in dp.MID_RANGE_BANDS:
        sub = [r for r in mid if r[0] == band]
        if not sub:
            continue
        baseline.append({
            "grain": "midRangeBand",
            "band": band,
            "fga": sum(r[1] for r in sub),
            "fgm": sum(r[2] for r in sub),
        })

    # The usage fences, re-run against stored values (ADR-0069/0080).
    pre_drop = len(shots) + conflicts
    games_included = len({s["gameId"] for s in shots})
    if adv_fga != pre_drop:
        fail(f"player_season FGA ({adv_fga}) != pre-drop season FGA ({pre_drop}) — "
             f"the usage figure does not describe this record (ADR-0069)")
    if gp < games_included:
        fail(f"player_season GP ({gp}) < gamesIncluded ({games_included})")
    if not 0 < usage_pct < 1:
        fail(f"usg_pct ({usage_pct!r}) outside (0, 1) — unit drift?")

    return {
        "_meta": {
            "schemaVersion": dp.SCHEMA_VERSION,
            "player": player_name,
            "playerId": player_id,
            "season": season,
            "seasonType": season_type,
            "pullDate": pull_date,
            "dataThrough": max(s["gameDate"] for s in shots),
            "gamesIncluded": games_included,
            "sourceSnapshot": source_path,
            "totalShots": len(shots),
            "zoneConflictsDropped": conflicts,
            "usagePct": usage_pct,
            "usageSourceSnapshot": usage_path,
        },
        "shots": shots,
        "zoneBaseline": baseline,
    }


def payload_text(payload: dict) -> str:
    """Serialize exactly as derive_payload.write_payload does."""
    return json.dumps(payload, indent=2)


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Export the shot payload from the record store."
    )
    ap.add_argument("--player", default="Cody Williams")
    ap.add_argument("--season", default="2025-26")
    ap.add_argument("--season-type", default="Regular Season")
    ap.add_argument("--db-url", help="Postgres DSN (default: NBA_DB_URL)")
    ap.add_argument("--out-file", help="write the payload here")
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
