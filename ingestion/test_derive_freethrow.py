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


def test_partial_trip_sequences_count_as_splits_and_still_reconcile():
    # ADR-0053 as amended: a duplicate-free partial sequence is a SPLIT
    # fragment — the visit's other throws belong to a teammate — counted in
    # splitFtm/splitFta, never a trip. The per-game box identity still
    # bites: dropping "1 of 2" (a make) without adjusting the box line must
    # fail the reconciliation, because the box still credits both throws.
    shot, pbp, box, league = fixture_inputs()
    actions = pbp["response"]["game"]["actions"]
    actions.remove(find_action(pbp, 302))  # drop "1 of 2", keep "2 of 2"

    with pytest.raises(SystemExit, match="!= box-score line"):
        run_derive(shot, pbp, box, league)


def test_duplicated_trip_sequences_still_hard_fail():
    # Duplicates are data anomalies, not splits: never absorbed.
    shot, pbp, box, league = fixture_inputs()
    action = find_action(pbp, 302)  # "1 of 2"
    dupe = dict(action)
    pbp["response"]["game"]["actions"].insert(
        pbp["response"]["game"]["actions"].index(action) + 1, dupe
    )

    with pytest.raises(SystemExit, match="duplicated trip sequence"):
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


def _write_pair(
    raw_root: Path, game_id: str, home_players: list, away_players: list
) -> None:
    pull_date = "2026-07-29"
    pbp = {
        "_meta": {"game_id": game_id, "source": "NBA Stats PlayByPlayV3", "pull_date": pull_date},
        "response": {"game": {"gameId": game_id, "actions": []}},
    }
    box = {
        "_meta": {
            "game_id": game_id,
            "source": "NBA Stats BoxScoreTraditionalV3",
            "pull_date": pull_date,
        },
        "response": {
            "boxScoreTraditional": {
                "gameId": game_id,
                "homeTeam": {"players": home_players},
                "awayTeam": {"players": away_players},
            }
        },
    }
    for kind, doc in (("play-by-play", pbp), ("box-score", box)):
        game_dir = raw_root / kind / game_id
        game_dir.mkdir(parents=True)
        (game_dir / f"{pull_date}.json").write_text(json.dumps(doc), encoding="utf-8")


def test_corpus_discovery_includes_shotless_free_throw_games(tmp_path):
    """ADR-0054's remedy, made mechanical: a pulled pair for a game where the
    hero shot free throws without a field-goal attempt joins the
    reconstruction universe; a 0/0 shotless game and a hero-absent game do
    not (so discovery is byte-neutral for every prior hero)."""
    hero = 99

    def player(person_id: int, ftm: int, fta: int) -> dict:
        return {
            "personId": person_id,
            "statistics": {"freeThrowsMade": ftm, "freeThrowsAttempted": fta},
        }

    _write_pair(tmp_path, "0022500001", [player(hero, 2, 2)], [])  # shot game
    _write_pair(tmp_path, "0022500002", [player(hero, 3, 4)], [])  # shotless FT game
    _write_pair(tmp_path, "0022500003", [player(hero, 0, 0)], [])  # shotless, no FT
    _write_pair(tmp_path, "0022500004", [player(12345, 5, 6)], [])  # hero absent
    # Another season's game: the corpus is shared, the derive is not
    # (season_game_prefix; Keyonte George's 2026-27 opener, 2026-10-22).
    _write_pair(tmp_path, "0022600005", [player(hero, 5, 7)], [])

    shot_payload = {"_meta": {"season": "2025-26", "seasonType": "Regular Season"},
                    "shots": [{"gameId": "0022500001"}]}
    games = df.load_freethrow_game_snapshots(
        shot_payload, tmp_path, hero, allow_missing_games=False
    )
    assert sorted(games) == ["0022500001", "0022500002"]


def test_season_game_prefix_reads_the_season_out_of_the_game_id():
    assert df.season_game_prefix("2025-26") == "00225"
    assert df.season_game_prefix("2026-27") == "00226"
    assert df.season_game_prefix("2025-26", "Playoffs") == "00425"
    with pytest.raises(SystemExit, match="no game-ID prefix"):
        df.season_game_prefix("")


# The late-stamped and-one (ADR-0053 as amended 2026-10-22), shaped like
# game 0022600089: George's made three at PT08M11.00S, the shooting foul and
# his one free throw at PT08M10.00S.
GEORGE, UTA, MEM, WELLS = 1641718, 1610612762, 1610612763, 1642377


def _act(number: int, clock: str, action_type: str, sub_type: str,
         description: str, person: int = GEORGE, team: int = UTA) -> dict:
    return {"actionNumber": number, "clock": clock, "period": 1, "teamId": team,
            "personId": person, "actionType": action_type, "subType": sub_type,
            "description": description}


def _late_and_one_game(make_clock: str = "PT08M11.00S", maker: int = GEORGE,
                       between: tuple = ()) -> list:
    return [
        _act(45, make_clock, "Made Shot", "Jump Shot",
             "George 25' 3PT Jump Shot (5 PTS) (Hayes 1 AST)", person=maker),
        *between,
        _act(47, "PT08M10.00S", "Foul", "Shooting", "Wells S.FOUL (P1.T4) (A.Nagy)",
             person=WELLS, team=MEM),
        _act(49, "PT08M10.00S", "Free Throw", "Free Throw 1 of 1",
             "MISS George Free Throw 1 of 1"),
    ]


def test_a_late_stamped_and_one_links_to_the_shooters_make():
    trips, *_ = df.reconstruct_game_trips("0022600089", _late_and_one_game(), GEORGE, {45})
    assert [(t.trip_class, t.ftm, t.fta, t.shot_id) for t in trips] == [("andOne", 0, 1, 45)]


@pytest.mark.parametrize("game", [
    # Three seconds is past AND_ONE_MAX_CLOCK_GAP.
    _late_and_one_game(make_clock="PT08M13.00S"),
    # Someone else's make is the nearest one: it could have earned the throw.
    _late_and_one_game(between=(_act(46, "PT08M11.00S", "Made Shot", "Layup",
                                     "Hayes 2' Layup (4 PTS)", person=1629637),)),
    # The nearest make is a teammate's, not the shooter's.
    _late_and_one_game(maker=1629637),
])
def test_the_late_and_one_fallback_stays_narrow(game):
    with pytest.raises(SystemExit, match="unclassifiable trip"):
        df.reconstruct_game_trips("0022600089", game, GEORGE, {45, 46})


# The mislabeled technical (ADR-0053 as amended 2026-10-28), shaped like game
# 0022600100: Hayes dunks, draws a hanging technical, and Bey's one throw is
# labeled 'Free Throw 1 of 1', all at PT08M14.00S.
BEY, HAYES, NOP = 1630180, 1629637, 1610612740


def _mislabeled_technical_game(foul_subtype: str = "Hanging Technical",
                               foul_clock: str = "PT08M14.00S",
                               foul_team: int = UTA,
                               throws: tuple = ("Free Throw 1 of 1",)) -> list:
    return [
        _act(592, "PT08M14.00S", "Made Shot", "Alley Oop Dunk Shot",
             "Hayes 7' Alley Oop Dunk (15 PTS) (Sensabaugh 2 AST)", person=HAYES),
        _act(594, foul_clock, "Foul", foul_subtype,
             "Hayes HANGING.TECH.FOUL (P2.T2) (J.Capers)", person=HAYES, team=foul_team),
        *(_act(595 + i, "PT08M14.00S", "Free Throw", sub_type,
               f"Bey {sub_type} (18 PTS)", person=BEY, team=NOP)
          for i, sub_type in enumerate(throws)),
    ]


def test_a_mislabeled_technical_counts_with_the_technicals():
    trips, tftm, tfta, sftm, sfta = df.reconstruct_game_trips(
        "0022600100", _mislabeled_technical_game(), BEY, set())
    assert trips == []
    assert (tftm, tfta, sftm, sfta) == (1, 1, 0, 0)


@pytest.mark.parametrize("game", [
    # A double technical awards no throws.
    _mislabeled_technical_game(foul_subtype="Double Technical"),
    # The technical is a second away from the throw.
    _mislabeled_technical_game(foul_clock="PT08M15.00S"),
    # The shooter's own team drew the technical.
    _mislabeled_technical_game(foul_team=NOP),
    # A two-throw visit is never a technical's.
    _mislabeled_technical_game(throws=("Free Throw 1 of 2", "Free Throw 2 of 2")),
])
def test_the_mislabeled_technical_fallback_stays_narrow(game):
    with pytest.raises(SystemExit, match="unclassifiable trip"):
        df.reconstruct_game_trips("0022600100", game, BEY, set())
