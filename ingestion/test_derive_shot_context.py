"""Behavior tests for the Case 3 parser and shot-context derive seam."""

from __future__ import annotations

import copy
import json
from pathlib import Path

import derive_shot_context as dc
import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURES = REPO_ROOT / "tests" / "fixtures"
GOLDEN_REGEN = "npm run golden:regen"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def test_explicit_credit_classifies_makes_while_misses_are_not_applicable():
    game = dc.parse_game(
        load_fixture("playbyplay.truncated.json"),
        load_fixture("boxscore.truncated.json"),
    )

    assisted = game.events_by_number[480][0]
    unassisted = game.events_by_number[520][0]
    missed = game.events_by_number[233][0]

    assert (assisted.assist_status, assisted.assist_evidence) == (
        "assisted",
        "descriptionCredit",
    )
    assert (unassisted.assist_status, unassisted.assist_evidence) == (
        "unassisted",
        "validatedAbsence",
    )
    assert (missed.assist_status, missed.assist_evidence) == (
        "notApplicable",
        "notApplicable",
    )


def test_assist_parser_must_reconcile_exactly_to_each_team_box_score():
    box = copy.deepcopy(load_fixture("boxscore.truncated.json"))
    box["response"]["boxScoreTraditional"]["awayTeam"]["statistics"]["assists"] = 2

    with pytest.raises(SystemExit, match="parsed assists 1 != official box-score assists 2"):
        dc.parse_game(load_fixture("playbyplay.truncated.json"), box)


def test_source_pair_requires_matching_wrapper_date_and_endpoint_identity():
    box = copy.deepcopy(load_fixture("boxscore.truncated.json"))
    box["_meta"]["pull_date"] = "2026-07-15"
    with pytest.raises(SystemExit, match="pull dates disagree"):
        dc.parse_game(load_fixture("playbyplay.truncated.json"), box)

    box = copy.deepcopy(load_fixture("boxscore.truncated.json"))
    box["_meta"]["source"] = "NBA Stats PlayByPlayV3"
    with pytest.raises(SystemExit, match="unexpected endpoint identity"):
        dc.parse_game(load_fixture("playbyplay.truncated.json"), box)


def test_raw_loader_rejects_orphaned_snapshot_dates(tmp_path: Path):
    game_id = "0022500025"
    pbp_dir = tmp_path / "play-by-play" / game_id
    box_dir = tmp_path / "box-score" / game_id
    pbp_dir.mkdir(parents=True)
    box_dir.mkdir(parents=True)
    (pbp_dir / "2026-07-16.json").write_text(
        json.dumps(load_fixture("playbyplay.truncated.json")), encoding="utf-8"
    )
    (box_dir / "2026-07-15.json").write_text(
        json.dumps(load_fixture("boxscore.truncated.json")), encoding="utf-8"
    )

    with pytest.raises(SystemExit, match="orphaned source snapshots"):
        dc.load_game_snapshots(
            {"shots": [{"gameId": game_id}]},
            tmp_path,
            allow_missing_games=False,
        )


def test_snapshot_mapping_key_must_match_the_parsed_game_identity():
    with pytest.raises(
        SystemExit,
        match="snapshot mapping key 0022500099 != parsed game ID 0022500025",
    ):
        dc.derive(
            load_fixture("derived.golden.json"),
            {
                "0022500099": (
                    load_fixture("playbyplay.truncated.json"),
                    load_fixture("boxscore.truncated.json"),
                )
            },
            source_shot_payload="tests/fixtures/derived.golden.json",
        )


def test_derive_is_total_over_shots_and_keeps_match_failures_explicit():
    shot = load_fixture("derived.golden.json")
    payload = dc.derive(
        shot,
        {
            "0022500025": (
                load_fixture("playbyplay.truncated.json"),
                load_fixture("boxscore.truncated.json"),
            )
        },
        source_shot_payload="tests/fixtures/derived.golden.json",
    )

    assert [(row["gameId"], row["gameEventId"]) for row in payload["shots"]] == [
        (row["gameId"], row["gameEventId"]) for row in shot["shots"]
    ]
    by_key = {(row["gameId"], row["gameEventId"]): row for row in payload["shots"]}
    assert by_key[("0022500025", 233)] == {
        "gameId": "0022500025",
        "gameEventId": 233,
        "eventMatch": "matched",
        "assistStatus": "notApplicable",
        "assistEvidence": "notApplicable",
        "failureReason": None,
    }
    assert by_key[("0022500025", 239)]["eventMatch"] == "missingEvent"
    assert by_key[("0022500025", 239)]["assistStatus"] == "notApplicable"
    assert by_key[("0022500036", 739)]["eventMatch"] == "missingGame"
    assert by_key[("0022500036", 739)]["assistStatus"] == "unknown"
    assert payload["_meta"]["totalShots"] == 15


def test_shot_context_golden_matches_derive_output():
    golden = load_fixture("shot-context.golden.json")
    derived = dc.derive(
        load_fixture("derived.golden.json"),
        {
            "0022500025": (
                load_fixture("playbyplay.truncated.json"),
                load_fixture("boxscore.truncated.json"),
            )
        },
        source_shot_payload="tests/fixtures/derived.golden.json",
    )
    assert derived == golden, f"shot-context shape changed — regenerate: {GOLDEN_REGEN}"


def test_duplicate_event_identity_stays_explicit_instead_of_picking_one():
    shots = load_fixture("derived.golden.json")
    pbp = load_fixture("playbyplay.truncated.json")
    box = load_fixture("boxscore.truncated.json")
    duplicate = next(
        action
        for action in pbp["response"]["game"]["actions"]
        if action["actionNumber"] == 233
    )
    pbp["response"]["game"]["actions"].append(copy.deepcopy(duplicate))

    payload = dc.derive(
        shots,
        {"0022500025": (pbp, box)},
        source_shot_payload="tests/fixtures/derived.golden.json",
    )
    row = next(r for r in payload["shots"] if r["gameEventId"] == 233)
    assert row["eventMatch"] == "duplicateEvent"
    assert row["assistStatus"] == "notApplicable"


def test_event_identity_contradiction_is_not_treated_as_a_match():
    shots = load_fixture("derived.golden.json")
    pbp = load_fixture("playbyplay.truncated.json")
    box = load_fixture("boxscore.truncated.json")
    event = next(
        action
        for action in pbp["response"]["game"]["actions"]
        if action["actionNumber"] == 233
    )
    event["shotValue"] = 3

    payload = dc.derive(
        shots,
        {"0022500025": (pbp, box)},
        source_shot_payload="tests/fixtures/derived.golden.json",
    )
    row = next(r for r in payload["shots"] if r["gameEventId"] == 233)
    assert row["eventMatch"] == "contradiction"
    assert row["failureReason"] == "identityContradiction"
