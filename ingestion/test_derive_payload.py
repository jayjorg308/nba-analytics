"""Tests for the derive step — including the ADR-0004 reconciliation invariant.

Run from the repo root:  python -m pytest ingestion -q
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

import derive_payload as dp

REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURES = REPO_ROOT / "tests" / "fixtures"

GOLDEN_REGEN = ("python ingestion/derive_payload.py "
                "--snapshot-file tests/fixtures/snapshot.truncated.json "
                "--out-file tests/fixtures/derived.golden.json")


def load_truncated() -> dict:
    return json.loads((FIXTURES / "snapshot.truncated.json").read_text(encoding="utf-8"))


def minimal_snapshot() -> dict:
    """Smallest snapshot that passes validation: one RA make, one league row
    per evaluation zone."""
    shot = ["Shot Chart Detail", "0022500001", 1, 1642262, "Test Player",
            1610612762, "Utah Jazz", 1, 10, 30, "Made Shot", "Layup",
            "2PT Field Goal", "Restricted Area", "Center(C)", "Less Than 8 ft.",
            1, 5, 3, 1, 1, "20251101", "UTA", "PHX"]

    def league_range(zone: str) -> str:
        if zone in dp.THREE_POINT_ZONES:
            return "24+ ft."
        if zone == "Mid-Range":
            return "8-16 ft."
        return "Less Than 8 ft."

    league_rows = [
        ["League Averages", zone, "Center(C)", league_range(zone), 100, 50, 0.5]
        for zone in dp.EVAL_ZONES
    ]
    return {
        "_meta": {
            "player": "Test Player",
            "player_id": 1642262,
            "season": "2025-26",
            "season_type": "Regular Season",
            "pull_date": "2026-07-09",
            "shot_rows": 1,
        },
        "response": {
            "resultSets": [
                {"name": "Shot_Chart_Detail", "headers": list(dp.SHOT_HEADERS),
                 "rowSet": [shot]},
                {"name": "LeagueAverages", "headers": list(dp.LEAGUE_HEADERS),
                 "rowSet": league_rows},
            ],
        },
    }


# --- ADR-0004: rollup sums makes/attempts, never averages rates ---------------

def test_rollup_reconciliation_synthetic():
    """Sharp-toothed variant: wildly unequal sub-zones, where averaging rates
    is obviously wrong."""
    rows = [
        ["League Averages", "Mid-Range", "Center(C)", "8-16 ft.", 100, 50, 0.5],
        ["League Averages", "Mid-Range", "Left Side(L)", "16-24 ft.", 10, 1, 0.1],
    ]
    league = pd.DataFrame(rows, columns=dp.LEAGUE_HEADERS)
    basic = {e["zone"]: e for e in dp.rollup_baseline(league) if e["grain"] == "basic"}
    mr = basic["Mid-Range"]

    assert (mr["fga"], mr["fgm"]) == (110, 51)
    rolled_pct = mr["fgm"] / mr["fga"]
    assert rolled_pct == pytest.approx(51 / 110)          # hand: 0.4636...
    assert rolled_pct * 2 == pytest.approx(0.92727, abs=1e-5)  # hand-computed PPS

    averaged = (0.5 + 0.1) / 2  # the forbidden computation
    assert abs(rolled_pct - averaged) > 0.15, "summing must differ from averaging here"


def test_rollup_reconciliation_real_frame():
    """Over the verbatim league frame in the fixture: Mid-Range must roll to
    9179/22025 (PPS hand-computed: 2 x 9179/22025 = 0.8335073), and the naive
    FG_PCT average must disagree — proving summation on real data."""
    snapshot = load_truncated()
    league = dp.result_set(snapshot["response"], "LeagueAverages")
    basic = {e["zone"]: e for e in dp.rollup_baseline(league) if e["grain"] == "basic"}
    mr = basic["Mid-Range"]

    assert (mr["fga"], mr["fgm"]) == (22025, 9179)
    assert 2 * mr["fgm"] / mr["fga"] == pytest.approx(0.8335073, abs=2e-6)

    mid_rows = league[league["SHOT_ZONE_BASIC"] == "Mid-Range"]
    naive = mid_rows["FG_PCT"].mean()
    assert abs(mr["fgm"] / mr["fga"] - naive) > 0.001


def test_band_rollup_and_atb3_backcourt_row():
    snapshot = load_truncated()
    league = dp.result_set(snapshot["response"], "LeagueAverages")
    entries = dp.rollup_baseline(league)

    bands = {e["band"]: e for e in entries if e["grain"] == "midRangeBand"}
    assert (bands["8-16 ft"]["fga"], bands["8-16 ft"]["fgm"]) == (11270, 4869)
    assert (bands["16-24 ft"]["fga"], bands["16-24 ft"]["fgm"]) == (10755, 4310)
    assert "Less Than 8 ft" not in bands  # no such mid-range rows in 2025-26

    # Basic-grain membership decides the rollup: the ATB3 fine row with
    # Back Court(BC) area must sum into Above the Break 3, not Backcourt.
    basic = {e["zone"]: e for e in entries if e["grain"] == "basic"}
    atb3 = basic["Above the Break 3"]
    assert (atb3["fga"], atb3["fgm"]) == (67375, 23585)
    without_bc = league[(league["SHOT_ZONE_BASIC"] == "Above the Break 3")
                        & (league["SHOT_ZONE_AREA"] != "Back Court(BC)")]
    assert atb3["fga"] != int(without_bc["FGA"].sum())


# --- Normalization -------------------------------------------------------------

def test_normalize_range():
    assert dp.normalize_range("16-24 ft.") == "16-24 ft"
    assert dp.normalize_range("Less Than 8 ft.") == "Less Than 8 ft"
    assert dp.normalize_range("24+ ft.") == "24+ ft"
    assert dp.normalize_range("Back Court Shot") == "Back Court Shot"
    # idempotent — already-normalized input passes through
    assert dp.normalize_range("16-24 ft") == "16-24 ft"


# --- Enrichment ----------------------------------------------------------------

def test_enrich_shots_field_mapping():
    made_2pt = ["Shot Chart Detail", "0022500025", 233, 1642262, "Cody Williams",
                1610612762, "Utah Jazz", 2, 7, 52, "Made Shot", "Layup",
                "2PT Field Goal", "Restricted Area", "Center(C)", "Less Than 8 ft.",
                1, 13, 3, 1, 1, "20251031", "PHX", "UTA"]
    missed_3pt = ["Shot Chart Detail", "0022500025", 239, 1642262, "Cody Williams",
                  1610612762, "Utah Jazz", 4, 0, 9, "Missed Shot", "Jump Shot",
                  "3PT Field Goal", "Left Corner 3", "Left Side(L)", "24+ ft.",
                  23, -234, 27, 1, 0, "20251031", "PHX", "UTA"]
    shots = pd.DataFrame([made_2pt, missed_3pt], columns=dp.SHOT_HEADERS)

    assert dp.enrich_shots(shots) == [
        {
            "gameId": "0022500025", "gameEventId": 233, "gameDate": "2025-10-31",
            "opponent": "PHX", "home": False,  # Jazz row, HTM=PHX -> away at PHX
            "period": 2, "minutesRemaining": 7, "secondsRemaining": 52,
            "made": True, "pointValue": 2, "zoneBasic": "Restricted Area",
            "zoneArea": "Center(C)", "zoneRange": "Less Than 8 ft",
            "distanceFt": 1, "locX": 13, "locY": 3,
        },
        {
            "gameId": "0022500025", "gameEventId": 239, "gameDate": "2025-10-31",
            "opponent": "PHX", "home": False,
            "period": 4, "minutesRemaining": 0, "secondsRemaining": 9,
            "made": False, "pointValue": 3, "zoneBasic": "Left Corner 3",
            "zoneArea": "Left Side(L)", "zoneRange": "24+ ft",
            "distanceFt": 23, "locX": -234, "locY": 27,
        },
    ]


# --- Matchup derivation (v3: opponent/home derive here, ADR-0011) ----------------

def test_matchup_home_and_away():
    # per-row TEAM_NAME lookup — HTM side is home, the other abbrev is the opponent
    assert dp.matchup("Utah Jazz", "UTA", "PHX") == ("PHX", True)
    assert dp.matchup("Utah Jazz", "PHX", "UTA") == ("PHX", False)
    assert dp.matchup("Phoenix Suns", "PHX", "UTA") == ("UTA", True)


def test_matchup_unknown_team_name_fails():
    with pytest.raises(SystemExit, match="unknown TEAM_NAME"):
        dp.matchup("Seattle SuperSonics", "UTA", "PHX")


def test_matchup_team_not_in_game_fails():
    # a mapped abbreviation that is neither HTM nor VTM means the map or the
    # row is wrong — never guess a matchup into the payload
    with pytest.raises(SystemExit, match="maps to UTA but the game is BOS @ MIA"):
        dp.matchup("Utah Jazz", "MIA", "BOS")


def test_team_abbrev_map_covers_thirty_teams():
    assert len(dp.TEAM_ABBREV) == 30
    assert len(set(dp.TEAM_ABBREV.values())) == 30
    assert all(2 <= len(a) <= 3 and a.isupper() for a in dp.TEAM_ABBREV.values())


# --- Validation ----------------------------------------------------------------

def test_validate_minimal_snapshot_passes():
    meta, shots, league, conflicts = dp.validate_snapshot(minimal_snapshot())
    assert meta["player"] == "Test Player"
    assert len(shots) == 1
    assert len(league) == len(dp.EVAL_ZONES)
    assert conflicts == 0


def _shot_rs(snapshot):
    return snapshot["response"]["resultSets"][0]


def _league_rs(snapshot):
    return snapshot["response"]["resultSets"][1]


def _drop_league(s):
    s["response"]["resultSets"] = [_shot_rs(s)]


def _wrong_shot_rows(s):
    s["_meta"]["shot_rows"] = 2


def _unknown_zone(s):
    _shot_rs(s)["rowSet"][0][dp.SHOT_HEADERS.index("SHOT_ZONE_BASIC")] = "Deep Two"


def _empty_league(s):
    _league_rs(s)["rowSet"] = []


def _renamed_header(s):
    _shot_rs(s)["headers"][0] = "SURPRISE"


def _attempted_zero(s):
    _shot_rs(s)["rowSet"][0][dp.SHOT_HEADERS.index("SHOT_ATTEMPTED_FLAG")] = 0


def _bad_game_date(s):
    _shot_rs(s)["rowSet"][0][dp.SHOT_HEADERS.index("GAME_DATE")] = "2025-11-01"


def _corrupt_fg_pct(s):
    _league_rs(s)["rowSet"][0][dp.LEAGUE_HEADERS.index("FG_PCT")] = 0.9


def _uncovered_band(s):
    row = _shot_rs(s)["rowSet"][0]
    row[dp.SHOT_HEADERS.index("SHOT_ZONE_BASIC")] = "Mid-Range"
    row[dp.SHOT_HEADERS.index("SHOT_ZONE_RANGE")] = "16-24 ft."  # league only has 8-16


@pytest.mark.parametrize(
    ("mutate", "match"),
    [
        (_drop_league, "LeagueAverages missing"),
        (_wrong_shot_rows, "shot_rows"),
        (_unknown_zone, "unknown SHOT_ZONE_BASIC"),
        (_empty_league, "Gate 1"),
        (_renamed_header, "headers changed"),
        (_attempted_zero, "SHOT_ATTEMPTED_FLAG"),
        (_bad_game_date, "unparseable GAME_DATE"),
        (_corrupt_fg_pct, "does not reconcile"),
        (_uncovered_band, "no covering league rows"),
    ],
    ids=lambda x: getattr(x, "__name__", x),
)
def test_validation_failures(mutate, match):
    snapshot = minimal_snapshot()
    mutate(snapshot)
    with pytest.raises(SystemExit, match=match):
        dp.validate_snapshot(snapshot)


# --- Zone-point conflicts (ADR-0019) ---------------------------------------------

def test_zone_point_conflict_dropped_and_counted():
    """A row whose SHOT_TYPE contradicts its zone's point value is DROPPED and
    COUNTED — never guessed into a zone, never swallowed silently, and never
    fatal to the rest of the snapshot (ADR-0019). Found in the wild: Keyonte
    George 2025-26 has one (a foot-on-the-line step-back scored 2PT but zoned
    Above the Break 3)."""
    snapshot = minimal_snapshot()
    shot_rs = snapshot["response"]["resultSets"][0]
    clean = list(shot_rs["rowSet"][0])
    clean[dp.SHOT_HEADERS.index("GAME_EVENT_ID")] = 2
    conflicted = list(shot_rs["rowSet"][0])
    conflicted[dp.SHOT_HEADERS.index("SHOT_TYPE")] = "3PT Field Goal"  # zone says RA
    shot_rs["rowSet"] = [conflicted, clean]
    snapshot["_meta"]["shot_rows"] = 2

    meta, shots, league, conflicts = dp.validate_snapshot(snapshot)
    assert conflicts == 1
    assert len(shots) == 1  # the clean row survives
    assert int(shots.iloc[0]["GAME_EVENT_ID"]) == 2

    payload = dp.build_payload(
        meta, "test", dp.enrich_shots(shots), dp.rollup_baseline(league), conflicts
    )
    assert payload["_meta"]["zoneConflictsDropped"] == 1
    assert payload["_meta"]["totalShots"] == 1  # post-drop count


# --- Snapshot selection ----------------------------------------------------------

def test_latest_snapshot_selection(tmp_path):
    season_dir = tmp_path / "cody-williams" / "2025-26"
    season_dir.mkdir(parents=True)
    (season_dir / "2026-01-01.json").write_text("{}")
    (season_dir / "2026-07-09.json").write_text("{}")
    picked = dp.latest_snapshot_path(tmp_path, "cody-williams", "2025-26")
    assert picked.name == "2026-07-09.json"


# --- Golden (the cross-language handshake; see tests/fixtures/README.md) --------

def test_golden_matches_derive_output():
    snapshot = load_truncated()
    meta, shots, league, conflicts = dp.validate_snapshot(snapshot)
    payload = dp.build_payload(
        meta,
        "tests/fixtures/snapshot.truncated.json",
        dp.enrich_shots(shots),
        dp.rollup_baseline(league),
        conflicts,
    )
    golden = json.loads((FIXTURES / "derived.golden.json").read_text(encoding="utf-8"))
    assert payload == golden, f"payload shape changed — regenerate: {GOLDEN_REGEN}"
