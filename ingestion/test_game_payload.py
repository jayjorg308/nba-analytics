"""The game payload's Python side (ADR-0088/0089): the golden handshake
through the record store, every export oracle failing on a manufactured
violation, the prior-season ruler, game-file immutability, and the new
loaders' halts. DB-native: the golden regenerates via regen_game_golden.py,
never golden:regen.

Run from the repo root:  python -m pytest ingestion -q
Needs Docker (see conftest.py); skips loudly without it.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

import export_game_payload as egp
import export_team_shot_payload as etp
import load_hero_season as lhs
import load_rulers as lr
import load_team_games as ltg
import record_store as rs
from regen_game_golden import FIXTURES, GAME_ID, GOLDEN, INDEX_GOLDEN, TEAM, load_fixture_store

CURRY, GREEN = 201939, 203110
FILIPOWSKI, HENDRICKS = 1642271, 1641707
GSW = 1610612744


@pytest.fixture()
def store(pg_dsn):
    with rs.connect(pg_dsn) as conn:
        load_fixture_store(conn)
        yield conn


def run_sql(conn, sql: str, params=()) -> None:
    with conn.cursor() as cur:
        cur.execute(sql, params)
    conn.commit()


def test_game_golden_roundtrip_through_the_store(store):
    payload = egp.export_game(store, TEAM, GAME_ID)
    assert egp.payload_text(payload) == GOLDEN.read_text(encoding="utf-8")


def test_season_export_writes_the_golden_game_file_and_index(store, tmp_path):
    egp.export_season(store, TEAM, "2025-26", tmp_path)
    game_file = tmp_path / "games" / f"{GAME_ID}.json"
    assert game_file.read_text(encoding="utf-8") == GOLDEN.read_text(encoding="utf-8")
    assert (tmp_path / "index.json").read_text(encoding="utf-8") == INDEX_GOLDEN.read_text(
        encoding="utf-8")


# ------------------------------------------------------------- the oracles


def test_box_oracle_fails_on_a_missing_shot_row(store):
    run_sql(store, "DELETE FROM shot WHERE game_event_id = (SELECT min(game_event_id) FROM shot"
                   " WHERE player_id = %s)", (CURRY,))
    with pytest.raises(SystemExit, match="box FGA"):
        egp.export_game(store, TEAM, GAME_ID)


def test_free_throw_line_fails_on_a_doctored_box(store):
    run_sql(store, "UPDATE box_score_line SET fta = fta + 1 WHERE player_id = %s", (HENDRICKS,))
    with pytest.raises(SystemExit, match="free-throw line"):
        egp.export_game(store, TEAM, GAME_ID)


def test_receipt_identity_fails_on_doctored_points(store):
    run_sql(store, "UPDATE box_score_line SET points = points + 2 WHERE player_id = %s",
            (FILIPOWSKI,))
    with pytest.raises(SystemExit, match="receipt identity"):
        egp.export_game(store, TEAM, GAME_ID)


def test_assist_total_fails_on_a_doctored_team_line(store):
    run_sql(store, "UPDATE box_team_line SET assists = assists + 1 WHERE team_id = %s", (GSW,))
    with pytest.raises(SystemExit, match="assists"):
        egp.export_game(store, TEAM, GAME_ID)


def test_subject_slice_must_equal_the_team_shot_payload(store):
    game = egp.export_game(store, TEAM, GAME_ID)
    team_payload = etp.export_payload(store, TEAM, "2025-26")
    egp.check_subject_slice(game, team_payload)
    team_payload["shots"][0]["made"] = not team_payload["shots"][0]["made"]
    with pytest.raises(SystemExit, match="team shot payload's slice"):
        egp.check_subject_slice(game, team_payload)


def test_ruler_must_be_complete_in_every_evaluation_zone(store):
    run_sql(store, "DELETE FROM league_ruler_zone WHERE zone_basic = 'Right Corner 3'")
    with pytest.raises(SystemExit, match="no league attempts"):
        egp.export_game(store, TEAM, GAME_ID)


def test_ruler_must_be_loaded_for_the_day_before(store):
    run_sql(store, "DELETE FROM league_ruler_zone")
    with pytest.raises(SystemExit, match="no ruler loaded"):
        egp.export_game(store, TEAM, GAME_ID)


# ---------------------------------------------------------- prior season


def test_an_empty_ruler_prices_against_the_prior_season(store):
    """No league game before the date (the league's opening night): the
    ruler must be empty too, and the prior season's full baseline prices
    the game, labeled with that season and its game count."""
    run_sql(store, "DELETE FROM league_game WHERE game_date < '2026-01-03'")
    with pytest.raises(SystemExit, match="disagree"):
        egp.export_game(store, TEAM, GAME_ID)  # attempts but no games: contradiction
    run_sql(store, "DELETE FROM league_ruler_zone")
    with pytest.raises(SystemExit, match="no 2024-25 league baseline"):
        egp.export_game(store, TEAM, GAME_ID)
    run_sql(store, "INSERT INTO league_zone_baseline SELECT '2024-25', season_type, zone_basic,"
                   " zone_area, zone_range, fga, fgm, snapshot_id, run_id"
                   " FROM league_zone_baseline WHERE season = '2025-26'")
    with pytest.raises(SystemExit, match="2024-25 league game log"):
        egp.export_game(store, TEAM, GAME_ID)
    run_sql(store, "INSERT INTO league_game SELECT '0022400001', '2024-25', season_type,"
                   " '2025-04-13', team_a_id, team_b_id, snapshot_id, run_id"
                   " FROM league_game LIMIT 1")
    payload = egp.export_game(store, TEAM, GAME_ID)
    ruler = payload["_meta"]["ruler"]
    assert (ruler["kind"], ruler["season"], ruler["through"], ruler["games"]) == (
        "prior-season", "2024-25", "2025-04-13", 1)


# ----------------------------------------------------------- immutability


def test_published_game_files_are_never_rewritten(store, tmp_path):
    first = egp.export_season(store, TEAM, "2025-26", tmp_path)
    assert first == {"written": 1, "unchanged": 0, "rewritten": 0}
    index = json.loads((tmp_path / "index.json").read_text(encoding="utf-8"))
    assert [g["slug"] for g in index["games"]] == ["2026-01-03-gsw"]
    assert egp.export_season(store, TEAM, "2025-26", tmp_path)["unchanged"] == 1
    run_sql(store, "UPDATE player SET name = 'Wardell Curry' WHERE player_id = %s", (CURRY,))
    with pytest.raises(SystemExit, match="immutable"):
        egp.export_season(store, TEAM, "2025-26", tmp_path)
    assert egp.export_season(store, TEAM, "2025-26", tmp_path,
                             allow_rewrite=True)["rewritten"] == 1


# ---------------------------------------------------------------- loaders


def test_a_changed_ruler_halts(store, tmp_path):
    ruler = json.loads((FIXTURES / "game-ruler.json").read_text(encoding="utf-8"))
    frame = next(r for r in ruler["response"]["resultSets"] if r["name"] == "LeagueAverages")
    frame["rowSet"][0][4] += 1  # FGA
    frame["rowSet"][0][6] = round(frame["rowSet"][0][5] / frame["rowSet"][0][4], 3)
    ruler["_meta"]["league_fga"] += 1
    repull = tmp_path / "2026-10-14.json"
    repull.write_text(json.dumps(ruler), encoding="utf-8")
    with pytest.raises(lhs.LoadHalt, match="changed or deleted"):
        lr.load_rulers(store, [repull])


def test_an_empty_ruler_loads_no_rows_and_records_its_head(store, tmp_path):
    ruler = json.loads((FIXTURES / "game-ruler.json").read_text(encoding="utf-8"))
    frame = next(r for r in ruler["response"]["resultSets"] if r["name"] == "LeagueAverages")
    frame["rowSet"] = []
    ruler["_meta"].update({"through": "2025-10-20", "date_to": "2025-10-20", "league_fga": 0})
    empty = tmp_path / "empty.json"
    empty.write_text(json.dumps(ruler), encoding="utf-8")
    lr.load_rulers(store, [empty])
    with store.cursor() as cur:
        cur.execute("SELECT count(*) FROM league_ruler_zone WHERE through_date = '2025-10-20'")
        assert cur.fetchone()[0] == 0
        assert egp._head_path(cur, rs.scope_key(
            lr.RULER_SOURCE, season="2025-26", season_type="Regular Season",
            through="2025-10-20")) is not None


def test_the_game_log_reads_neutral_site_games(tmp_path):
    log = json.loads((FIXTURES / "game-log.truncated.json").read_text(encoding="utf-8"))
    frame = log["response"]["resultSets"][0]
    matchup = frame["headers"].index("MATCHUP")
    for row in frame["rowSet"]:
        row[matchup] = row[matchup].replace(" vs. ", " @ ")  # Mexico City reads '@' twice
    _, games = lr.validate_game_log_snapshot(log)
    assert len(games) == 3
    frame["rowSet"].pop()
    with pytest.raises(SystemExit, match="one row for each of two teams"):
        lr.validate_game_log_snapshot(log)


def test_an_opponent_row_vanishing_from_a_repull_halts(store, tmp_path):
    snap = json.loads((FIXTURES / "game-opponent-snapshot.truncated.json").read_text(encoding="utf-8"))
    frame = next(r for r in snap["response"]["resultSets"] if r["name"] == "Shot_Chart_Detail")
    frame["rowSet"].pop()
    snap["_meta"]["shot_rows"] -= 1
    repull = tmp_path / "repull.json"
    repull.write_text(json.dumps(snap), encoding="utf-8")
    with pytest.raises(lhs.LoadHalt, match="changed or deleted"):
        ltg.load_team_games(store, [repull])


def test_a_one_day_pull_must_be_one_game(tmp_path):
    snap = json.loads((FIXTURES / "game-opponent-snapshot.truncated.json").read_text(encoding="utf-8"))
    frame = next(r for r in snap["response"]["resultSets"] if r["name"] == "Shot_Chart_Detail")
    frame["rowSet"][0][frame["headers"].index("GAME_ID")] = "0022500493"
    with pytest.raises(SystemExit, match="rows carry games"):
        ltg.validate_team_game_snapshot(snap)


def test_scope_keys_keep_their_earlier_forms():
    assert rs.scope_key("play-by-play", game_id="0022500492") == "play-by-play::::0022500492"
    assert rs.scope_key("shotchartdetail-team", season="2025-26", season_type="Regular Season",
                        team_id=1) == "shotchartdetail-team::2025-26:Regular Season::1"
    assert rs.scope_key("league-ruler", season="2025-26", season_type="Regular Season",
                        through="2026-01-02") == "league-ruler::2025-26:Regular Season:::2026-01-02"


def test_fixture_paths_are_repo_relative():
    assert Path(json.loads(GOLDEN.read_text(encoding="utf-8"))["_meta"]["sourcePlayByPlay"]) == Path(
        "tests/fixtures/game-playbyplay.truncated.json")
