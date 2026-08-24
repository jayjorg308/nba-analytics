"""Export the shot-context payload from the record store (ADR-0080).

The parity oracle for the third contract: over the same sources, this must
reproduce ingestion/derive_shot_context.py's output byte-identically. Rows
come from the shot_context derived table, joined back to the sibling shots
for payload order; export re-checks totality (exactly one context row per
post-drop shot, ADR-0039) — the assist reconciliation itself runs at rebuild
time inside parse_actions, against observed sources.

sourceShotPayload is reconstructed by the file pipeline's convention
(data/derived/<slug>/<season>/<shot pull date>.json), like the freethrow
export.

USAGE:
  python ingestion/export_shot_context_payload.py --player "Cody Williams" --season 2025-26 --verify-against public/data/cody-williams/2025-26.context.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import derive_payload as dp
import derive_shot_context as dsc
import record_store as rs

MATCH_VALUES = ("matched", "missingGame", "missingEvent", "duplicateEvent", "contradiction")
ASSIST_VALUES = ("assisted", "unassisted", "notApplicable", "unknown")


def fail(msg: str) -> None:
    sys.exit(f"export-shot-context: {msg}")


def export_payload(
    conn,
    player: str,
    season: str,
    season_type: str = "Regular Season",
    *,
    source_shot_payload: str | None = None,
) -> dict:
    with conn.cursor() as cur:
        cur.execute("SELECT player_id, name FROM player WHERE name = %s", (player,))
        hits = cur.fetchall()
        if len(hits) != 1:
            fail(f"expected exactly one player named {player!r}, found {len(hits)}")
        player_id, player_name = hits[0]

        cur.execute(
            "SELECT s.game_id, s.game_event_id, g.game_date, s.zone_basic,"
            " s.point_value, s.snapshot_id FROM shot s JOIN game g USING (game_id)"
            " WHERE s.player_id = %s AND g.season = %s AND g.season_type = %s"
            " ORDER BY s.source_row",
            (player_id, season, season_type),
        )
        shot_rows = cur.fetchall()
        if not shot_rows:
            fail(f"no shots for {player!r} {season} — load the season first")
        post_drop = [
            r for r in shot_rows if (r[3] in dp.THREE_POINT_ZONES) == (r[4] == 3)
        ]
        expected_games = sorted({r[0] for r in post_drop})
        data_through = max(r[2] for r in post_drop).isoformat()

        snapshot_ids = {r[5] for r in shot_rows}
        if len(snapshot_ids) != 1:
            fail(f"shots carry {len(snapshot_ids)} snapshot provenances — mixed load")
        cur.execute("SELECT pull_date FROM snapshot WHERE snapshot_id = %s",
                    (snapshot_ids.pop(),))
        shot_pull_date = cur.fetchone()[0]

        cur.execute(
            "SELECT c.game_id, c.game_event_id, c.event_match, c.assist_status,"
            " c.assist_evidence, c.failure_reason"
            " FROM shot_context c JOIN shot s USING (game_id, game_event_id)"
            " JOIN game g ON g.game_id = c.game_id"
            " WHERE c.player_id = %s AND g.season = %s AND g.season_type = %s"
            " ORDER BY s.source_row",
            (player_id, season, season_type),
        )
        context_rows = cur.fetchall()
        # Totality (ADR-0039): one row per post-drop sibling shot, same keys,
        # same order.
        if [(r[0], r[1]) for r in context_rows] != [(r[0], r[1]) for r in post_drop]:
            fail(f"shot_context is not total over the sibling shots "
                 f"({len(context_rows)} rows vs {len(post_drop)} shots) — "
                 f"rebuild the corpus (load_game_corpus.py)")

        # Loaded games and their pair provenance: a game counts as loaded
        # when both its parsed sides are in the store.
        loaded_games: list[str] = []
        source_games: list[dict] = []
        for game_id in expected_games:
            cur.execute(
                "SELECT DISTINCT sn.source, sn.pull_date FROM snapshot sn WHERE"
                " sn.snapshot_id IN ("
                "  SELECT snapshot_id FROM pbp_event WHERE game_id = %s"
                "  UNION SELECT snapshot_id FROM box_team_line WHERE game_id = %s)",
                (game_id, game_id),
            )
            dates = dict(cur.fetchall())
            if set(dates) != {"play-by-play", "box-score"}:
                continue  # not (fully) loaded — its rows classify missingGame
            loaded_games.append(game_id)
            source_games.append({
                "gameId": game_id,
                "playByPlayPullDate": dates["play-by-play"],
                "boxScorePullDate": dates["box-score"],
            })

    rows = [
        {
            "gameId": game_id,
            "gameEventId": event_id,
            "eventMatch": event_match,
            "assistStatus": assist_status,
            "assistEvidence": assist_evidence,
            "failureReason": failure_reason,
        }
        for game_id, event_id, event_match, assist_status, assist_evidence,
            failure_reason in context_rows
    ]
    missing_marked = {r["gameId"] for r in rows if r["eventMatch"] == "missingGame"}
    stale = missing_marked & set(loaded_games)
    if stale:
        fail(f"games {sorted(stale)} are loaded but their rows say missingGame — "
             f"rebuild the corpus (load_game_corpus.py)")

    slug = player_name.lower().replace(" ", "-")
    return {
        "_meta": {
            "schemaVersion": dsc.SCHEMA_VERSION,
            "player": player_name,
            "playerId": player_id,
            "season": season,
            "dataThrough": data_through,
            "gamesIncluded": len(expected_games),
            "sourceShotPayload": (
                source_shot_payload
                or f"data/derived/{slug}/{season}/{shot_pull_date}.json"
            ),
            "totalShots": len(rows),
            "gamesExpected": len(expected_games),
            "gamesLoaded": len(loaded_games),
            "eventMatchCounts": {
                value: sum(r["eventMatch"] == value for r in rows)
                for value in MATCH_VALUES
            },
            "assistStatusCounts": {
                value: sum(r["assistStatus"] == value for r in rows)
                for value in ASSIST_VALUES
            },
            "sourceGames": source_games,
        },
        "shots": rows,
    }


def payload_text(payload: dict) -> str:
    return json.dumps(payload, indent=2)


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Export the shot-context payload from the record store."
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
