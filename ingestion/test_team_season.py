"""Team-season record-store tests (ADR-0082): the team golden through the
real loader -> constraints -> export path, hero/team row agreement, roster
departures, and the hero-less game-pair load.

Run from the repo root:  python -m pytest ingestion -q
Needs Docker (see conftest.py); skips loudly without it.
"""

from __future__ import annotations

from pathlib import Path

import pytest

import export_shot_payload as esp
import export_team_shot_payload as etp
import load_game_corpus as lgc
import load_hero_season as lhs
import load_team_season as lts
import record_store as rs
import team_payload as tp

REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURES = REPO_ROOT / "tests" / "fixtures"
GOLDEN = FIXTURES / "team-shot.golden.json"
HERO_GOLDEN = FIXTURES / "derived.golden.json"
PAIR = (FIXTURES / "playbyplay.truncated.json", FIXTURES / "team-boxscore.truncated.json")


@pytest.fixture()
def store(pg_dsn):
    with rs.connect(pg_dsn) as conn:
        ran = rs.apply_migrations(conn)
        assert "0007_team_shots.sql" in ran
        yield conn


def load_team(conn, **kwargs):
    return lts.load_team_season(
        conn,
        snapshot_path=FIXTURES / "team-snapshot.truncated.json",
        roster_path=FIXTURES / "team-roster.truncated.json",
        **kwargs,
    )


def test_team_golden_roundtrip_through_the_store(store):
    """Loader -> shot/roster_entry/box_score_line -> export: byte-identical
    to the file derive's committed golden (one grammar, two sources)."""
    report = load_team(store)
    assert report["shot"]["inserted"] == 82  # pre-drop: 80 real + Backcourt 999 + conflict 9999
    assert report["roster_entry"]["inserted"] == 5
    assert report["_unpairedGames"] == ["0022500025"]  # no box lines yet
    pairs = lgc.load_game_pairs(store, [], pairs=[PAIR])
    assert pairs["box_score_line"]["inserted"] > 0
    payload = etp.export_payload(store, "Utah Jazz", "2025-26")
    assert etp.payload_text(payload) == GOLDEN.read_text(encoding="utf-8")


def test_export_refuses_a_game_without_its_box(store):
    load_team(store)
    with pytest.raises(SystemExit, match="no box score"):
        etp.export_payload(store, "Utah Jazz", "2025-26")


def test_reload_is_a_no_op_and_the_box_oracle_runs_at_load(store):
    load_team(store)
    lgc.load_game_pairs(store, [], pairs=[PAIR])
    second = load_team(store)
    assert second["_unpairedGames"] == []  # the oracle ran over the paired game
    for table in ("shot", "roster_entry", "league_zone_baseline", "game"):
        assert second[table]["inserted"] == 0, table
        assert second[table]["changed"] == 0, table


def test_hero_rows_and_team_rows_agree_and_hero_parity_survives(store):
    """Cody's fixture pull and the team pull describe the same game: his
    rows load unchanged from the team snapshot, his response ordinals stay,
    and his export still matches HIS golden byte-for-byte."""
    lhs.load_hero_season(
        store,
        snapshot_path=FIXTURES / "snapshot.truncated.json",
        advanced_path=FIXTURES / "league-advanced.truncated.json",
    )
    report = load_team(store)
    # Cody's 2025-10-31 rows already exist from his own pull: unchanged, not changed.
    assert report["shot"]["changed"] == 0
    assert report["shot"]["unchanged"] >= 1
    payload = esp.export_payload(store, "Cody Williams", "2025-26")
    assert esp.payload_text(payload) == HERO_GOLDEN.read_text(encoding="utf-8")


def test_a_departed_player_leaves_the_roster_without_a_halt(store, tmp_path):
    import json

    load_team(store)
    roster = json.loads((FIXTURES / "team-roster.truncated.json").read_text(encoding="utf-8"))
    frame = roster["response"]["resultSets"][0]
    frame["rowSet"] = frame["rowSet"][:-1]  # Blake Hinson departs
    trimmed = tmp_path / "roster.json"
    trimmed.write_text(json.dumps(roster), encoding="utf-8")
    report = lts.load_team_season(
        store, snapshot_path=FIXTURES / "team-snapshot.truncated.json",
        roster_path=trimmed,
    )
    assert report["_departed"] == 1
    with store.cursor() as cur:
        cur.execute("SELECT count(*) FROM roster_entry")
        assert cur.fetchone()[0] == 4


def test_a_changed_shot_row_halts_and_rolls_back(store):
    load_team(store)
    with store.cursor() as cur:
        cur.execute(
            "UPDATE shot SET distance_ft = distance_ft + 1 "
            "WHERE ctid = (SELECT ctid FROM shot LIMIT 1)"
        )
    store.commit()
    with pytest.raises(lhs.LoadHalt, match="distance_ft"):
        load_team(store)


def test_scope_key_keeps_the_player_form_and_adds_a_team_segment():
    assert rs.scope_key("shotchartdetail", player_id=1, season="2025-26",
                        season_type="Regular Season") == \
        "shotchartdetail:1:2025-26:Regular Season:"
    assert rs.scope_key(lts.TEAM_SOURCE, season="2025-26", season_type="Regular Season",
                        team_id=1610612762) == \
        "shotchartdetail-team::2025-26:Regular Season::1610612762"


def test_tricode_is_the_static_map():
    assert tp.tricode_of("Utah Jazz") == "UTA"
    with pytest.raises(SystemExit):
        tp.tricode_of("Seattle SuperSonics")
