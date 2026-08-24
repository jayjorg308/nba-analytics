"""Record-store tests (ADR-0080): the golden handshake through Postgres,
change detection, and the real-data parity oracle.

Run from the repo root:  python -m pytest ingestion -q
Needs Docker (see conftest.py); skips loudly without it.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

import export_creation_payload as ecr
import export_shot_payload as esp
import load_hero_season as lhs
import load_tracking as lt
import record_store as rs

REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURES = REPO_ROOT / "tests" / "fixtures"
GOLDEN = FIXTURES / "derived.golden.json"
CREATION_GOLDEN = FIXTURES / "creation.golden.json"
DEPLOYED = REPO_ROOT / "public" / "data" / "cody-williams" / "2025-26.json"
DEPLOYED_CREATION = REPO_ROOT / "public" / "data" / "cody-williams" / "2025-26.creation.json"


@pytest.fixture()
def store(pg_dsn):
    with rs.connect(pg_dsn) as conn:
        ran = rs.apply_migrations(conn)
        assert "0001_core.sql" in ran
        yield conn


def load_fixtures(conn, **kwargs):
    return lhs.load_hero_season(
        conn,
        snapshot_path=FIXTURES / "snapshot.truncated.json",
        advanced_path=FIXTURES / "league-advanced.truncated.json",
        **kwargs,
    )


def test_golden_roundtrip_through_the_store(store):
    """The cross-language golden, through the real loader -> constraints ->
    export path: byte-identical to the derive step's committed output."""
    load_fixtures(store)
    payload = esp.export_payload(store, "Cody Williams", "2025-26")
    assert esp.payload_text(payload) == GOLDEN.read_text(encoding="utf-8")


def test_creation_golden_roundtrip_through_the_store(store):
    """The second contract's golden, through loader -> creation_split /
    league_creation_team -> export: byte-identical, sparse rows zero-filled,
    the league residual computed by count subtraction."""
    load_fixtures(store)
    report = lt.load_tracking(
        store, "Cody Williams", "2025-26",
        snapshot_path=FIXTURES / "tracking.truncated.json",
        league_path=FIXTURES / "tracking.league.truncated.json",
    )
    assert report["creation_split"]["inserted"] > 0
    payload = ecr.export_payload(store, "Cody Williams", "2025-26")
    assert ecr.payload_text(payload) == CREATION_GOLDEN.read_text(encoding="utf-8")


def test_reload_is_a_no_op(store):
    first = load_fixtures(store)
    assert sum(c["inserted"] for c in first.values()) > 0
    second = load_fixtures(store)
    for table, counts in second.items():
        assert counts["inserted"] == 0, table
        assert counts["changed"] == 0, table
        assert counts["unchanged"] > 0, table


def test_change_detection_halts_and_rolls_back(store):
    load_fixtures(store)
    with store.cursor() as cur:
        cur.execute(
            "UPDATE shot SET distance_ft = distance_ft + 1 "
            "WHERE ctid = (SELECT ctid FROM shot LIMIT 1)"
        )
    store.commit()
    with pytest.raises(lhs.LoadHalt, match="distance_ft"):
        load_fixtures(store)
    # The halt rolled the whole load back: the doctored row still stands.
    with store.cursor() as cur:
        cur.execute("SELECT count(*) FROM load_run WHERE report IS NOT NULL")
        assert cur.fetchone()[0] == 1  # only the first load completed


def test_allow_changed_accepts_the_correction(store):
    load_fixtures(store)
    with store.cursor() as cur:
        cur.execute(
            "UPDATE shot SET distance_ft = distance_ft + 1 "
            "WHERE ctid = (SELECT ctid FROM shot LIMIT 1)"
        )
    store.commit()
    report = load_fixtures(store, allow_changed=True)
    assert report["shot"]["changed"] == 1
    # Re-export still matches the golden: the load restored observed state.
    payload = esp.export_payload(store, "Cody Williams", "2025-26")
    assert esp.payload_text(payload) == GOLDEN.read_text(encoding="utf-8")


def test_snapshot_recatalog_with_different_bytes_halts(store, tmp_path):
    load_fixtures(store)
    # Same repo-relative path cannot be simulated for a tmp copy, so doctor
    # the catalog instead: pretend the file's recorded hash differs.
    with store.cursor() as cur:
        cur.execute("UPDATE snapshot SET content_sha256 = repeat('0', 64)")
    store.commit()
    with pytest.raises(lhs.LoadHalt, match="append-only"):
        load_fixtures(store)


@pytest.mark.skipif(
    not DEPLOYED.exists(), reason="deployed payload absent (clean clone)"
)
def test_real_data_parity(store):
    """The ADR-0080 parity oracle on real data: load the exact snapshots the
    committed payload names, export, compare byte-for-byte."""
    meta = json.loads(DEPLOYED.read_text(encoding="utf-8"))["_meta"]
    snapshot = REPO_ROOT / meta["sourceSnapshot"]
    advanced = REPO_ROOT / meta["usageSourceSnapshot"]
    if not snapshot.exists() or not advanced.exists():
        pytest.skip("raw snapshots named by the deployed payload absent")
    lhs.load_hero_season(store, snapshot_path=snapshot, advanced_path=advanced)
    payload = esp.export_payload(store, meta["player"], meta["season"])
    assert esp.payload_text(payload) == DEPLOYED.read_text(encoding="utf-8")
    # The creation contract over the same store (tracking universe).
    creation_meta = json.loads(DEPLOYED_CREATION.read_text(encoding="utf-8"))["_meta"]
    tracking = REPO_ROOT / creation_meta["sourceSnapshot"]
    league_tracking = REPO_ROOT / creation_meta["leagueSourceSnapshot"]
    if tracking.exists() and league_tracking.exists():
        lt.load_tracking(store, meta["player"], meta["season"],
                         snapshot_path=tracking, league_path=league_tracking)
        creation = ecr.export_payload(store, meta["player"], meta["season"])
        assert ecr.payload_text(creation) == DEPLOYED_CREATION.read_text(encoding="utf-8")
