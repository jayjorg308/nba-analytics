"""Export the creation payload from the record store (ADR-0080).

The parity oracle for the second contract: over the same snapshots, this
must reproduce ingestion/derive_creation.py's output byte-identically.
Player families come from creation_split (zero-filled to canonical context
order — the sparse-row rule), the league baseline from league_creation_team
summed over its observed team grain (ADR-0004), General's unresolved
residual computed by count subtraction. Every ADR-0030 reconciliation
re-runs at export: the exact-or-reported General identity against the
sibling shots (negative shortfall hard-fails), coverage families against
the tracking Overall, and the league-side checks.

USAGE:
  python ingestion/export_creation_payload.py --player "Cody Williams" --season 2025-26 --verify-against public/data/cody-williams/2025-26.creation.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import derive_creation as dc
import derive_payload as dp
import record_store as rs

STAT_KEYS = ("fga", "fgm", "fg2a", "fg2m", "fg3a", "fg3m")


def fail(msg: str) -> None:
    sys.exit(f"export-creation: {msg}")


def _entry(context: str, stats: dict | None) -> dict:
    if stats is None:
        return dc.entry(context)
    return dc.entry(context, *(stats[k] for k in STAT_KEYS))


def export_payload(
    conn, player: str, season: str, season_type: str = "Regular Season"
) -> dict:
    with conn.cursor() as cur:
        cur.execute("SELECT player_id, name FROM player WHERE name = %s", (player,))
        hits = cur.fetchall()
        if len(hits) != 1:
            fail(f"expected exactly one player named {player!r}, found {len(hits)}")
        player_id, player_name = hits[0]

        cur.execute(
            "SELECT s.game_id, g.game_date, s.zone_basic, s.point_value"
            " FROM shot s JOIN game g USING (game_id)"
            " WHERE s.player_id = %s AND g.season = %s AND g.season_type = %s",
            (player_id, season, season_type),
        )
        shot_rows = cur.fetchall()
        if not shot_rows:
            fail(f"no shots for {player!r} {season} — load the season first")
        season_fga = len(shot_rows)  # pre-drop (ADR-0030's anchor)
        post_drop = [
            r for r in shot_rows if (r[2] in dp.THREE_POINT_ZONES) == (r[3] == 3)
        ]
        data_through = max(r[1] for r in post_drop).isoformat()
        games_included = len({r[0] for r in post_drop})

        cur.execute(
            "SELECT family, context, fga, fgm, fg2a, fg2m, fg3a, fg3m"
            " FROM creation_split"
            " WHERE player_id = %s AND season = %s AND season_type = %s",
            (player_id, season, season_type),
        )
        split_rows = cur.fetchall()
        if not split_rows:
            fail(f"no creation_split rows for {player!r} {season} — "
                 f"run load_tracking.py first")
        by_family: dict[str, dict[str, dict]] = {}
        for family, context, *stats in split_rows:
            by_family.setdefault(family, {})[context] = dict(zip(STAT_KEYS, stats))
        _, source_path, pull_date, snap_season_type = rs.get_head(
            cur, rs.scope_key("tracking-player", player_id=player_id,
                              season=season, season_type=season_type))
        if snap_season_type != season_type:
            fail(f"tracking snapshot season_type {snap_season_type!r} != "
                 f"requested {season_type!r}")

        cur.execute(
            "SELECT family, context, sum(fga), sum(fgm), sum(fg2a), sum(fg2m),"
            " sum(fg3a), sum(fg3m)"
            " FROM league_creation_team"
            " WHERE season = %s AND season_type = %s GROUP BY family, context",
            (season, season_type),
        )
        league_grouped = cur.fetchall()
        if not league_grouped:
            fail(f"no league_creation_team rows for {season} — "
                 f"run load_tracking.py first")
        lg: dict[str, dict[str, dict]] = {}
        for family, context, *sums in league_grouped:
            lg.setdefault(family, {})[context] = dict(zip(STAT_KEYS, sums))
        _, league_source_path, _, _ = rs.get_head(
            cur, rs.scope_key("tracking-league", season=season,
                              season_type=season_type))

    # Player families: canonical order, zero-filled (the sparse-row rule).
    families = {
        key: [_entry(c, by_family.get(key, {}).get(c)) for c in contexts]
        for key, _, _, contexts in dc.FAMILIES
    }
    general_fga = sum(e["fga"] for e in families["general"])
    tracking_shortfall = season_fga - general_fga
    if tracking_shortfall < 0:
        fail(f"General family sums to {general_fga} FGA, EXCEEDING the stored "
             f"pre-drop season total {season_fga} — tracking cannot outcount "
             f"the official record")

    def player_unattributed(key: str, label: str) -> int:
        total = sum(e["fga"] for e in families[key])
        gap = general_fga - total
        if gap < 0:
            fail(f"{label} family sums to {total}, exceeding the tracking "
                 f"Overall {general_fga}")
        return gap

    clock_unattributed = player_unattributed("shotClock", "Shot Clock")
    defender_unattributed = player_unattributed("closestDefender", "Closest Defender")

    # League General: stored contexts are the resolved ones; at most one
    # unresolved context takes the residual by count subtraction.
    overall = lg.get("overall", {}).get("Overall")
    if overall is None:
        fail("league_creation_team has no Overall row")
    lg_general_totals = dict(lg.get("general", {}))
    unresolved = [c for c in dc.GENERAL_CONTEXTS if c not in lg_general_totals]
    if len(unresolved) > 1:
        fail(f"multiple unresolved league General contexts {unresolved} — "
             f"the residual cannot be split")
    summed = {k: sum(t[k] for t in lg_general_totals.values()) for k in STAT_KEYS}
    if unresolved:
        residual = {k: overall[k] - summed[k] for k in STAT_KEYS}
        negative = {k: v for k, v in residual.items() if v < 0}
        if negative:
            fail(f"negative league residual for {unresolved[0]!r}: {negative}")
        lg_general_totals[unresolved[0]] = residual
    elif summed["fga"] != overall["fga"]:
        fail(f"league General contexts sum to {summed['fga']} but Overall is "
             f"{overall['fga']} with no residual context")
    lg_general = [_entry(c, lg_general_totals[c]) for c in dc.GENERAL_CONTEXTS]

    def league_coverage(family: str, contexts: list[str], label: str):
        totals = lg.get(family, {})
        entries = []
        total_fga = 0
        for context in contexts:
            t = totals.get(context)
            if t is None:
                fail(f"league_creation_team missing {label} context {context!r}")
            total_fga += t["fga"]
            entries.append(_entry(context, t))
        unattributed = overall["fga"] - total_fga
        if unattributed < 0:
            fail(f"league {label} contexts sum to {total_fga}, exceeding "
                 f"Overall {overall['fga']}")
        return entries, unattributed

    lg_clock, lg_clock_unattributed = league_coverage(
        "shotClock", dc.SHOT_CLOCK_BANDS, "Shot Clock")
    lg_defender, lg_defender_unattributed = league_coverage(
        "closestDefender", dc.DEFENDER_RANGES, "Closest Defender")

    return {
        "_meta": {
            "schemaVersion": dc.SCHEMA_VERSION,
            "player": player_name,
            "playerId": player_id,
            "season": season,
            "seasonType": season_type,
            "pullDate": pull_date,
            "dataThrough": data_through,
            "gamesIncluded": games_included,
            "sourceSnapshot": source_path,
            "leagueSourceSnapshot": league_source_path,
            "seasonFga": season_fga,
            "trackingShortfall": tracking_shortfall,
            "shotClockUnattributed": clock_unattributed,
            "defenderUnattributed": defender_unattributed,
            "leagueFga": overall["fga"],
            "leagueShotClockUnattributed": lg_clock_unattributed,
            "leagueDefenderUnattributed": lg_defender_unattributed,
        },
        "general": {"player": families["general"], "league": lg_general},
        "shotClock": {"player": families["shotClock"], "league": lg_clock},
        "closestDefender": {"player": families["closestDefender"], "league": lg_defender},
    }


def payload_text(payload: dict) -> str:
    return json.dumps(payload, indent=2)


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Export the creation payload from the record store."
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
