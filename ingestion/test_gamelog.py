"""Contract five's Python side of the golden handshake (ADR-0086): the
game-log export over the fixture store must reproduce the committed golden
byte-for-byte. DB-native — the golden regenerates via
regen_gamelog_golden.py, never golden:regen.

Run from the repo root:  python -m pytest ingestion -q
Needs Docker (see conftest.py); skips loudly without it.
"""

from __future__ import annotations

from pathlib import Path

import pytest

import export_gamelog_payload as egl
import load_game_corpus as lgc
import load_hero_season as lhs
import record_store as rs

REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURES = REPO_ROOT / "tests" / "fixtures"
GOLDEN = FIXTURES / "gamelog.golden.json"


@pytest.fixture()
def store(pg_dsn):
    with rs.connect(pg_dsn) as conn:
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
        yield conn


def test_gamelog_golden_roundtrip_through_the_store(store):
    payload = egl.export_payload(store, "Cody Williams", "2025-26",
                                 allow_missing_games=True)
    assert egl.payload_text(payload) == GOLDEN.read_text(encoding="utf-8")


def test_receipt_identity_hard_fails_at_export(store):
    """A doctored box line (the oracle) is never exported around."""
    with store.cursor() as cur:
        cur.execute("UPDATE box_score_line SET points = points + 2"
                    " WHERE player_id = 1642262")
    store.commit()
    with pytest.raises(SystemExit, match="receipt identity"):
        egl.export_payload(store, "Cody Williams", "2025-26",
                           allow_missing_games=True)
