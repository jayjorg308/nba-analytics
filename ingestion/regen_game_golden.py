"""Regenerate the game payload golden (ADR-0088).

The game payload is born DB-native (no file derive), so its golden comes
from the record-store path, the regen_gamelog_golden.py pattern: spin a
throwaway Dockerized Postgres, load the truncated two-team fixture game
through the real loaders, run the real export, and write
tests/fixtures/game.golden.json plus the one-game season index,
tests/fixtures/team-index.golden.json. Deterministic: same fixtures in,
byte-identical goldens out.

USAGE (from the repo root; requires Docker):
  python ingestion/regen_game_golden.py
"""

from __future__ import annotations

import tempfile
from pathlib import Path

import ephemeral_pg
import export_game_payload as egp
import load_game_corpus as lgc
import load_rulers as lr
import load_team_games as ltg
import load_team_season as lts
import record_store as rs

REPO = Path(__file__).resolve().parents[1]
FIXTURES = REPO / "tests" / "fixtures"
GOLDEN = FIXTURES / "game.golden.json"
INDEX_GOLDEN = FIXTURES / "team-index.golden.json"
GAME_ID = "0022500492"
TEAM = "Utah Jazz"


def load_fixture_store(conn) -> None:
    """The fixture game through every loader, in the production order:
    the pair, the subject's season pull and roster, the opponent's one-day
    pull, then the ruler and the league game log. Shared with the tests."""
    rs.apply_migrations(conn)
    lgc.load_game_pairs(conn, [GAME_ID], pairs=[
        (FIXTURES / "game-playbyplay.truncated.json", FIXTURES / "game-boxscore.truncated.json")])
    lts.load_team_season(conn, FIXTURES / "game-team-snapshot.truncated.json",
                         FIXTURES / "team-roster.truncated.json")
    ltg.load_team_games(conn, [FIXTURES / "game-opponent-snapshot.truncated.json"])
    lr.load_rulers(conn, [FIXTURES / "game-ruler.json"], FIXTURES / "game-log.truncated.json")


def main() -> None:
    dsn, container = ephemeral_pg.start()
    try:
        with rs.connect(dsn) as conn:
            load_fixture_store(conn)
            payload = egp.export_game(conn, TEAM, GAME_ID)
            with tempfile.TemporaryDirectory() as tmp:
                egp.export_season(conn, TEAM, "2025-26", Path(tmp))
                index_text = (Path(tmp) / "index.json").read_text(encoding="utf-8")
        GOLDEN.write_text(egp.payload_text(payload), encoding="utf-8", newline="\n")
        INDEX_GOLDEN.write_text(index_text, encoding="utf-8", newline="\n")
        sides = ", ".join(f"{s['tricode']} {len(s['shots'])} shots" for s in payload["sides"])
        print(f"goldens -> {GOLDEN.name}, {INDEX_GOLDEN.name} ({sides})")
    finally:
        ephemeral_pg.stop(container)


if __name__ == "__main__":
    main()
