"""Game-corpus + trip-derivation tests for the record store (ADR-0080,
second slice): the freethrow golden handshake through Postgres, corpus
idempotence, and the real-data parity oracle.

Run from the repo root:  python -m pytest ingestion -q
Needs Docker (see conftest.py); skips loudly without it.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

import export_freethrow_payload as efp
import export_shot_context_payload as ecp
import load_game_corpus as lgc
import load_hero_season as lhs
import record_store as rs

REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURES = REPO_ROOT / "tests" / "fixtures"
FT_GOLDEN = FIXTURES / "freethrow.golden.json"
CONTEXT_GOLDEN = FIXTURES / "shot-context.golden.json"
DEPLOYED_FT = REPO_ROOT / "public" / "data" / "cody-williams" / "2025-26.freethrow.json"
DEPLOYED_CONTEXT = REPO_ROOT / "public" / "data" / "cody-williams" / "2025-26.context.json"


@pytest.fixture()
def store(pg_dsn):
    with rs.connect(pg_dsn) as conn:
        rs.apply_migrations(conn)
        # The corpus builds on the shot-side load (slice 1).
        lhs.load_hero_season(
            conn,
            snapshot_path=FIXTURES / "snapshot.truncated.json",
            advanced_path=FIXTURES / "league-advanced.truncated.json",
        )
        yield conn


def load_fixture_corpus(store, **kwargs):
    return lgc.load_game_corpus(
        store,
        "Cody Williams",
        "2025-26",
        pairs=[(FIXTURES / "playbyplay.truncated.json", FIXTURES / "boxscore.truncated.json")],
        totals_path=FIXTURES / "league-totals.truncated.json",
        allow_missing_games=True,  # the fixture corpus is one game of six
        **kwargs,
    )


def export_fixture_payload(store):
    return efp.export_payload(
        store,
        "Cody Williams",
        "2025-26",
        allow_missing_games=True,
        # The golden was derived with the fixture payload path as its source
        # argument; the convention-reconstructed path applies to real derives.
        source_shot_payload="tests/fixtures/derived.golden.json",
    )


def test_freethrow_golden_roundtrip_through_the_store(store):
    """The fourth contract's golden, through loader -> pbp_event -> the
    unmodified trip grammar -> ft_trip -> export: byte-identical."""
    report = load_fixture_corpus(store)
    assert report["ft_trip"]["rebuilt"] == 3
    payload = export_fixture_payload(store)
    assert efp.payload_text(payload) == FT_GOLDEN.read_text(encoding="utf-8")


def test_corpus_reload_is_a_no_op(store):
    load_fixture_corpus(store)
    second = load_fixture_corpus(store)
    trips = second.pop("ft_trip")
    second.pop("shot_context")
    # The already-loaded game is skipped whole (shared-corpus fast path)...
    assert second.pop("_skipped_games") == 1
    for table, counts in second.items():
        assert counts["inserted"] == 0, table
        assert counts["changed"] == 0, table
    # ...the totals re-assert as unchanged, and trips rebuild identically.
    assert second["league_season_totals"]["unchanged"] > 0
    assert trips["rebuilt"] == 3


def test_shot_context_golden_roundtrip_through_the_store(store):
    """The third contract's golden, through loader -> pbp_event/box_team_line
    -> the unmodified parse/classify grammar -> shot_context -> export."""
    report = load_fixture_corpus(store)
    assert report["shot_context"]["rebuilt"] == 15  # total over the sibling shots
    payload = ecp.export_payload(
        store, "Cody Williams", "2025-26",
        source_shot_payload="tests/fixtures/derived.golden.json",
    )
    assert ecp.payload_text(payload) == CONTEXT_GOLDEN.read_text(encoding="utf-8")


def test_box_team_lines_load_without_names(store):
    """The truncated fixture states team assists but no names: both team
    lines load (the ADR-0046 oracle), and no anonymous team row is minted —
    a team is named only when a source actually names it."""
    load_fixture_corpus(store)
    with store.cursor() as cur:
        cur.execute("SELECT count(*) FROM box_team_line")
        assert cur.fetchone()[0] == 2
        cur.execute("SELECT count(*) FROM team WHERE name = ''")
        assert cur.fetchone()[0] == 0


def test_andone_links_to_a_sibling_shot(store):
    """The ADR-0053 linkage as a real FK: the and-one trip's shot exists."""
    load_fixture_corpus(store)
    with store.cursor() as cur:
        cur.execute(
            "SELECT count(*) FROM ft_trip t JOIN shot s ON (s.game_id, s.game_event_id)"
            " = (t.game_id, t.shot_game_event_id) WHERE t.trip_class = 'andOne'"
        )
        assert cur.fetchone()[0] == 1


@pytest.mark.skipif(
    not DEPLOYED_FT.exists(), reason="deployed payload absent (clean clone)"
)
def test_real_data_freethrow_parity(store):
    """The parity oracle on real data: full corpus load for the hero the
    fixtures truncate, exported byte-for-byte against the deployed payload."""
    shot_meta = json.loads(
        (REPO_ROOT / "public" / "data" / "cody-williams" / "2025-26.json")
        .read_text(encoding="utf-8")
    )["_meta"]
    snapshot = REPO_ROOT / shot_meta["sourceSnapshot"]
    ft_meta = json.loads(DEPLOYED_FT.read_text(encoding="utf-8"))["_meta"]
    totals = REPO_ROOT / ft_meta["sourceLeagueTotals"]
    raw_root = REPO_ROOT / "data" / "raw"
    if not snapshot.exists() or not totals.exists() or not raw_root.exists():
        pytest.skip("raw artifacts named by the deployed payloads absent")
    # Replace the fixture-truncated shot load with the real one.
    with store.cursor() as cur:
        for table in ("ft_trip", "shot", "box_score_line", "pbp_event"):
            cur.execute(f"DELETE FROM {table}")
    store.commit()
    lhs.load_hero_season(
        store, snapshot_path=snapshot,
        advanced_path=REPO_ROOT / shot_meta["usageSourceSnapshot"],
        allow_changed=True,  # real rows supersede the fixture-truncated load
    )
    lgc.load_game_corpus(
        store, "Cody Williams", "2025-26", raw_root=raw_root, totals_path=totals
    )
    payload = efp.export_payload(store, "Cody Williams", "2025-26")
    assert efp.payload_text(payload) == DEPLOYED_FT.read_text(encoding="utf-8")
    context = ecp.export_payload(store, "Cody Williams", "2025-26")
    assert ecp.payload_text(context) == DEPLOYED_CONTEXT.read_text(encoding="utf-8")
    # The team-naming carry-forward: every team a loaded box score names is
    # named in the team table. (Not necessarily all 30 — a hero who missed
    # games can have a corpus that never meets one franchise.)
    with store.cursor() as cur:
        cur.execute(
            "SELECT count(*) FROM box_team_line b WHERE b.name <> '' AND NOT EXISTS"
            " (SELECT 1 FROM team t WHERE t.team_id = b.team_id AND t.name <> '')"
        )
        assert cur.fetchone()[0] == 0
        cur.execute("SELECT count(*) FROM team WHERE name <> ''")
        assert cur.fetchone()[0] >= 29
