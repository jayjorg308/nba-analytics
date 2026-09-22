"""Game ledger facts tests (ADR-0084): the golden's Python half over the
team fixtures, the oracles' failure modes, and the grammar's rules.
Database-free — the store half is in test_team_season.py.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

import derive_ledger_facts as dlf
import ledger_facts as lf

REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURES = REPO_ROOT / "tests" / "fixtures"
TEAM_GOLDEN = FIXTURES / "team-shot.golden.json"
BOX = FIXTURES / "team-boxscore.truncated.json"
GOLDEN = FIXTURES / "team-ledger.golden.json"


def derive_fixture(box: Path = BOX, team_payload: Path = TEAM_GOLDEN) -> dict:
    return dlf.derive(team_payload, raw_root=FIXTURES, box_files=[box])


def test_golden_matches_the_derive():
    assert lf.payload_text(derive_fixture()) == GOLDEN.read_text(encoding="utf-8")


def test_a_game_row_is_exact_box_facts():
    ledger = derive_fixture()
    assert ledger["_meta"]["gamesIncluded"] == 1
    g = ledger["games"][0]
    assert (g["gameId"], g["gameDate"], g["opponent"], g["home"]) == (
        "0022500025", "2025-10-31", "PHX", False)
    assert (g["teamScore"], g["opponentScore"]) == (96, 118)
    # Team lines are sums of the player lines; the two synthetic shooters'
    # raised FGA ride along (80 real + 2 synthetic).
    assert g["fga"] == 82 and g["fgm"] <= g["fga"] and g["ftm"] <= g["fta"]
    # Only players with a field-goal attempt are listed, highest scorers first.
    assert all(p["fga"] > 0 for p in g["players"])
    points = [p["points"] for p in g["players"]]
    assert points == sorted(points, reverse=True)


def test_ledger_refuses_a_game_without_its_box(tmp_path):
    box = json.loads(BOX.read_text(encoding="utf-8"))
    box["response"]["boxScoreTraditional"]["gameId"] = "0022500026"
    doctored = tmp_path / "box.json"
    doctored.write_text(json.dumps(box), encoding="utf-8")
    with pytest.raises(SystemExit, match="no box score"):
        derive_fixture(box=doctored)


def test_ledger_refuses_a_box_fga_below_the_payload_rows(tmp_path):
    box = json.loads(BOX.read_text(encoding="utf-8"))
    side = box["response"]["boxScoreTraditional"]["awayTeam"]
    for p in side["players"]:
        p["statistics"]["fieldGoalsAttempted"] = 0
    doctored = tmp_path / "box.json"
    doctored.write_text(json.dumps(box), encoding="utf-8")
    with pytest.raises(SystemExit, match="box FGA"):
        derive_fixture(box=doctored)


def test_ledger_refuses_a_season_total_that_disagrees(tmp_path):
    box = json.loads(BOX.read_text(encoding="utf-8"))
    side = box["response"]["boxScoreTraditional"]["awayTeam"]
    side["players"][0]["statistics"]["fieldGoalsAttempted"] += 1
    doctored = tmp_path / "box.json"
    doctored.write_text(json.dumps(box), encoding="utf-8")
    with pytest.raises(SystemExit, match="pre-drop total"):
        derive_fixture(box=doctored)


def test_ledger_refuses_a_team_payload_that_is_not_the_team(tmp_path):
    payload = json.loads(TEAM_GOLDEN.read_text(encoding="utf-8"))
    payload["_meta"]["teamId"] = 1610612738  # Boston: on neither side of the box
    doctored = tmp_path / "team.json"
    doctored.write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(SystemExit, match="no side for team"):
        derive_fixture(team_payload=doctored)
