"""Behavior tests for the free-throw derive's grammar, taxonomy, and oracles."""

from __future__ import annotations

import copy
import json
from pathlib import Path

import derive_freethrow as df
import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURES = REPO_ROOT / "tests" / "fixtures"
GOLDEN_REGEN = "npm run golden:regen"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def fixture_inputs() -> tuple[dict, dict, dict, dict]:
    return (
        load_fixture("derived.golden.json"),
        load_fixture("playbyplay.truncated.json"),
        load_fixture("boxscore.truncated.json"),
        load_fixture("league-totals.truncated.json"),
    )


def run_derive(shot: dict, pbp: dict, box: dict, league: dict) -> dict:
    return df.derive(
        shot,
        {"0022500025": (pbp, box)},
        league,
        source_shot_payload="tests/fixtures/derived.golden.json",
        source_league_totals="tests/fixtures/league-totals.truncated.json",
    )


def find_action(pbp: dict, action_number: int) -> dict:
    return next(
        action
        for action in pbp["response"]["game"]["actions"]
        if action["actionNumber"] == action_number
    )


def test_freethrow_golden_matches_derive_output():
    shot, pbp, box, league = fixture_inputs()
    golden = load_fixture("freethrow.golden.json")
    assert run_derive(shot, pbp, box, league) == golden, (
        f"free-throw shape changed — regenerate: {GOLDEN_REGEN}"
    )


def test_trip_taxonomy_classifies_each_fixture_scenario():
    shot, pbp, box, league = fixture_inputs()
    payload = run_derive(shot, pbp, box, league)

    by_class = {trip["tripClass"]: trip for trip in payload["trips"]}
    # A shooting foul with no shot event: the FGA the scorer never recorded.
    assert by_class["shootingFoul2"]["fta"] == 2
    assert by_class["shootingFoul2"]["shotId"] is None
    # The and-one links to its counted made shot by exact identity.
    assert by_class["andOne"]["shotId"] == 480
    # The bonus trip groups across the interleaved substitution.
    assert by_class["bonus"]["ftm"] == 2
    # The missed technical is counted and reported, never a trip.
    assert payload["_meta"]["technicalFtm"] == 0
    assert payload["_meta"]["technicalFta"] == 1


def test_per_game_box_score_free_throw_line_must_reconcile():
    shot, pbp, box, league = fixture_inputs()
    hero = box["response"]["boxScoreTraditional"]["awayTeam"]["players"][0]
    hero["statistics"]["freeThrowsMade"] = 5

    with pytest.raises(SystemExit, match=r"reconstructed free-throw line 4/6 != box-score line 5/6"):
        run_derive(shot, pbp, box, league)


def test_gate_5_season_totals_must_reconcile_exactly():
    shot, pbp, box, league = fixture_inputs()
    williams = league["response"]["resultSets"][0]["rowSet"][0]
    fta_index = league["response"]["resultSets"][0]["headers"].index("FTA")
    williams[fta_index] = 8

    with pytest.raises(SystemExit, match=r"free-throw gate \(Gate 5\)"):
        run_derive(shot, pbp, box, league)


def test_league_artifact_fga_must_match_pre_drop_season_fga():
    shot, pbp, box, league = fixture_inputs()
    williams = league["response"]["resultSets"][0]["rowSet"][0]
    fga_index = league["response"]["resultSets"][0]["headers"].index("FGA")
    williams[fga_index] = 16

    with pytest.raises(SystemExit, match="league artifact FGA 16 != shot payload pre-drop season FGA 15"):
        run_derive(shot, pbp, box, league)


def test_taxonomy_totality_rejects_an_unclassifiable_trip():
    shot, pbp, box, league = fixture_inputs()
    # A lone 2-FT trip with no causing foul at its clock: unclassifiable.
    for number, subtype, description in (
        (700, "Free Throw 1 of 2", "MISS Williams Free Throw 1 of 2"),
        (701, "Free Throw 2 of 2", "MISS Williams Free Throw 2 of 2"),
    ):
        pbp["response"]["game"]["actions"].append(
            {
                "actionNumber": number,
                "clock": "PT00M30.00S",
                "period": 4,
                "teamId": 1610612762,
                "personId": 1642262,
                "isFieldGoal": 0,
                "description": description,
                "actionType": "Free Throw",
                "subType": subtype,
                "shotValue": 1,
            }
        )

    with pytest.raises(SystemExit, match="unclassifiable trip"):
        run_derive(shot, pbp, box, league)


def test_partial_trip_sequences_hard_fail_instead_of_absorbing():
    shot, pbp, box, league = fixture_inputs()
    actions = pbp["response"]["game"]["actions"]
    actions.remove(find_action(pbp, 302))  # drop "1 of 2", keep "2 of 2"

    with pytest.raises(SystemExit, match="partial or duplicated trip sequence"):
        run_derive(shot, pbp, box, league)


def test_unknown_free_throw_subtype_is_grammar_drift():
    shot, pbp, box, league = fixture_inputs()
    find_action(pbp, 302)["subType"] = "Free Throw Weird 1 of 2"

    with pytest.raises(SystemExit, match="unknown free-throw subtype"):
        run_derive(shot, pbp, box, league)


def test_description_without_free_throw_text_is_grammar_drift():
    shot, pbp, box, league = fixture_inputs()
    find_action(pbp, 302)["description"] = ""

    with pytest.raises(SystemExit, match="description grammar drift"):
        run_derive(shot, pbp, box, league)


def test_and_one_must_link_to_a_made_shot_in_the_sibling_payload():
    shot, pbp, box, league = fixture_inputs()
    for row in shot["shots"]:
        if row["gameId"] == "0022500025" and row["gameEventId"] == 480:
            row["made"] = False

    with pytest.raises(SystemExit, match="and-one linkage failed — made shot 480 absent"):
        run_derive(shot, pbp, box, league)


def test_technical_fouls_never_classify_a_trip():
    shot, pbp, box, league = fixture_inputs()
    # Turn the bonus trip's causing foul Technical: the search must skip it,
    # find nothing, and refuse to classify — never guess "bonus".
    find_action(pbp, 650)["subType"] = "Double Technical"

    with pytest.raises(SystemExit, match="unclassifiable trip"):
        run_derive(shot, pbp, box, league)


def test_hero_missing_from_league_artifact_fails():
    shot, pbp, box, league = fixture_inputs()
    rows = league["response"]["resultSets"][0]["rowSet"]
    league["response"]["resultSets"][0]["rowSet"] = rows[1:]

    with pytest.raises(SystemExit, match="no row for player 1642262"):
        run_derive(shot, pbp, box, league)


def test_league_artifact_wrapper_identity_is_validated():
    shot, pbp, box, league = fixture_inputs()
    league_wrong_season = copy.deepcopy(league)
    league_wrong_season["_meta"]["season"] = "2024-25"
    with pytest.raises(SystemExit, match="season '2024-25' != payload season '2025-26'"):
        run_derive(shot, pbp, box, league_wrong_season)

    league_wrong_mode = copy.deepcopy(league)
    league_wrong_mode["_meta"]["per_mode"] = "PerGame"
    with pytest.raises(SystemExit, match="not Totals per-mode"):
        run_derive(shot, pbp, box, league_wrong_mode)


def test_a_game_with_no_hero_free_throws_reconciles_at_zero():
    shot, pbp, box, league = fixture_inputs()
    actions = pbp["response"]["game"]["actions"]
    pbp["response"]["game"]["actions"] = [
        action for action in actions if action["actionType"] != "Free Throw" and action["actionType"] != "Foul"
    ]
    for player in (
        box["response"]["boxScoreTraditional"]["awayTeam"]["players"]
        + box["response"]["boxScoreTraditional"]["homeTeam"]["players"]
    ):
        player["statistics"]["freeThrowsMade"] = 0
        player["statistics"]["freeThrowsAttempted"] = 0
    headers = league["response"]["resultSets"][0]["headers"]
    williams = league["response"]["resultSets"][0]["rowSet"][0]
    williams[headers.index("FTM")] = 0
    williams[headers.index("FTA")] = 0

    payload = run_derive(shot, pbp, box, league)
    assert payload["_meta"]["totalTrips"] == 0
    assert payload["_meta"]["seasonFta"] == 0
    assert payload["_meta"]["tripClassCounts"]["shootingFoul2"] == 0
