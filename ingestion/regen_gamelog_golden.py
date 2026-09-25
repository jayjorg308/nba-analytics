"""Regenerate the game-log golden (contract five, ADR-0086).

The game-log payload is born DB-native — no file derive exists — so its
golden cannot come from `npm run golden:regen`'s derive commands. This
script is the equivalent: spin a throwaway Dockerized Postgres, load the
truncated fixtures through the real loaders, run the real export with
--allow-missing-games (the fixture corpus is one game of six), and write
tests/fixtures/gamelog.golden.json. Deterministic: same fixtures in,
byte-identical golden out.

USAGE (from the repo root; requires Docker):
  python ingestion/regen_gamelog_golden.py
"""

from __future__ import annotations

from pathlib import Path

import ephemeral_pg
import export_gamelog_payload as egl
import load_game_corpus as lgc
import load_hero_season as lhs
import record_store as rs

REPO = Path(__file__).resolve().parents[1]
FIXTURES = REPO / "tests" / "fixtures"
GOLDEN = FIXTURES / "gamelog.golden.json"


def main() -> None:
    dsn, container = ephemeral_pg.start()
    try:
        with rs.connect(dsn) as conn:
            rs.apply_migrations(conn)
            lhs.load_hero_season(
                conn,
                snapshot_path=FIXTURES / "snapshot.truncated.json",
                advanced_path=FIXTURES / "league-advanced.truncated.json",
            )
            lgc.load_game_corpus(
                conn, "Cody Williams", "2025-26",
                pairs=[(FIXTURES / "playbyplay.truncated.json",
                        FIXTURES / "boxscore.truncated.json")],
                totals_path=FIXTURES / "league-totals.truncated.json",
                allow_missing_games=True,
            )
            payload = egl.export_payload(
                conn, "Cody Williams", "2025-26", allow_missing_games=True)
        GOLDEN.write_text(egl.payload_text(payload), encoding="utf-8", newline="\n")
        print(f"golden -> {GOLDEN} ({payload['_meta']['totalGames']} game(s))")
    finally:
        ephemeral_pg.stop(container)


if __name__ == "__main__":
    main()
