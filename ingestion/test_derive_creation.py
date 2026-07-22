"""Tests for the creation derive step — the ADR-0030 reconciliation guards.

Run from the repo root:  python -m pytest ingestion -q
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

import derive_creation as dc

REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURES = REPO_ROOT / "tests" / "fixtures"

GOLDEN_REGEN = "npm run golden:regen"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def derive_fixtures(player=None, league=None, season_fga=15) -> dict:
    return dc.derive(
        player if player is not None else load_fixture("tracking.truncated.json"),
        league if league is not None else load_fixture("tracking.league.truncated.json"),
        season_fga,
        "tests/fixtures/tracking.truncated.json",
        "tests/fixtures/tracking.league.truncated.json",
    )


# --- Golden (the cross-language handshake; see tests/fixtures/README.md) --------

def test_golden_matches_derive_output():
    golden = load_fixture("creation.golden.json")
    assert derive_fixtures() == golden, \
        f"creation payload shape changed — regenerate: {GOLDEN_REGEN}"


def test_fixture_pair_reconciles_with_shot_golden():
    """The creation golden's seasonFga IS the shot golden's pre-drop total —
    the ADR-0030 cross-payload identity, exercised at fixture grain."""
    creation = load_fixture("creation.golden.json")
    shot = load_fixture("derived.golden.json")
    assert creation["_meta"]["seasonFga"] == (
        shot["_meta"]["totalShots"] + shot["_meta"]["zoneConflictsDropped"]
    )


# --- Sparse rows (spike trap #1): absent contexts are zero-filled ----------------

def test_sparse_rows_zero_filled_in_canonical_order():
    payload = derive_fixtures()
    general = payload["general"]["player"]
    assert [e["context"] for e in general] == dc.GENERAL_CONTEXTS
    other = general[-1]
    assert other == dc.entry("Other")  # absent row -> all-zero entry

    clock = payload["shotClock"]["player"]
    assert [e["context"] for e in clock] == dc.SHOT_CLOCK_BANDS
    assert clock[0] == dc.entry("24-22")


def test_unknown_context_literal_fails():
    player = load_fixture("tracking.truncated.json")
    rs = player["response"]["resultSets"][0]
    idx = rs["headers"].index("SHOT_TYPE")
    rs["rowSet"][0][idx] = "Step Backs"  # a vocabulary the contract doesn't know
    with pytest.raises(SystemExit, match="unknown SHOT_TYPE"):
        derive_fixtures(player=player)


def test_duplicated_context_row_fails():
    player = load_fixture("tracking.truncated.json")
    rs = player["response"]["resultSets"][0]
    rs["rowSet"].append(list(rs["rowSet"][0]))
    with pytest.raises(SystemExit, match="duplicated context rows"):
        derive_fixtures(player=player)


# --- The General identity (ADR-0030 as amended): exact-or-reported ---------------

def test_tracking_shortfall_zero_when_exact():
    payload = derive_fixtures()
    assert payload["_meta"]["trackingShortfall"] == 0


def test_tracking_shortfall_counted_never_guessed():
    # Official pre-drop total 16 vs tracking Overall 15: an NBA-side outage.
    # The derive persists the measured shortfall (ADR-0019 exclude-and-report,
    # ADR-0030 as amended) — it no longer vetoes the payload.
    payload = derive_fixtures(season_fga=16)
    assert payload["_meta"]["trackingShortfall"] == 1
    assert payload["_meta"]["seasonFga"] == 16
    # Family coverage is measured against the TRACKING Overall (15), not the
    # official total — the clock gap stays 1 (15 - 14), unchanged by the
    # shortfall.
    assert payload["_meta"]["shotClockUnattributed"] == 1


def test_general_over_attribution_fails():
    # Tracking exceeding the official record is contradiction, not outage —
    # the hard fail survives the amendment.
    with pytest.raises(SystemExit, match="EXCEEDING the shot payload"):
        derive_fixtures(season_fga=14)


def test_shot_clock_overrun_fails():
    # Σ clock bands exceeding the tracking Overall means the snapshot
    # disagrees with itself — never persist, never truncate. Inflate one band
    # (keeping the row internally sane) so Σ clock = 16 while General still
    # sums to 15.
    player = load_fixture("tracking.truncated.json")
    rs = player["response"]["resultSets"][1]
    h = rs["headers"]
    row = rs["rowSet"][2]  # '15-7 Average': FGA 5 -> 7
    row[h.index("FGA")], row[h.index("FG2A")] = 7, 5
    row[h.index("FG_PCT")] = 0.286  # 2/7
    with pytest.raises(SystemExit, match="exceeding the tracking Overall"):
        derive_fixtures(player=player)


def test_shot_clock_unattributed_counted():
    payload = derive_fixtures()
    assert payload["_meta"]["shotClockUnattributed"] == 1   # 15 - 14
    assert payload["_meta"]["leagueShotClockUnattributed"] == 2  # 250 - 248


# --- League baseline: residual by subtraction, never guessed ---------------------

def test_league_other_is_residual_by_count_subtraction():
    payload = derive_fixtures()
    other = [e for e in payload["general"]["league"] if e["context"] == "Other"][0]
    assert other == dc.entry("Other", fga=10, fgm=5, fg2a=10, fg2m=5)


def test_negative_league_residual_fails():
    league = load_fixture("tracking.league.truncated.json")
    # Shrink Overall (250 -> 230) below the resolved contexts' sum (240),
    # keeping the mutated row internally sane so the residual check — not the
    # frame-sanity check — is what fires.
    rs = league["overall"]["resultSets"][0]
    h = rs["headers"]
    row = rs["rowSet"][1]  # Suns: FGA 100 -> 80 (drop 20 two-point attempts)
    row[h.index("FGA")], row[h.index("FGM")] = 80, 35
    row[h.index("FG2A")], row[h.index("FG2M")] = 40, 20
    row[h.index("FG_PCT")] = 0.438  # 35/80
    with pytest.raises(SystemExit, match="negative league residual"):
        derive_fixtures(league=league)


def test_multiple_unresolved_general_contexts_fail():
    league = load_fixture("tracking.league.truncated.json")
    del league["_meta"]["resolved_filters"]["Pull Ups"]
    with pytest.raises(SystemExit, match="multiple unresolved General contexts"):
        derive_fixtures(league=league)


def test_missing_league_shot_clock_band_fails():
    league = load_fixture("tracking.league.truncated.json")
    del league["shot_clock"]["7-4 Late"]
    with pytest.raises(SystemExit, match="missing Shot Clock context"):
        derive_fixtures(league=league)


def test_missing_league_defender_range_fails():
    league = load_fixture("tracking.league.truncated.json")
    del league["closest_defender"]["4-6 Feet - Open"]
    with pytest.raises(SystemExit, match="missing Closest Defender context"):
        derive_fixtures(league=league)


def test_defender_coverage_counted_independently():
    payload = derive_fixtures()
    # sparse 'Very Tight' zero-filled; Σ defender = 13 of 15 -> gap 2, while
    # the clock family's own gap stays 1 — independent coverage counters
    assert payload["_meta"]["defenderUnattributed"] == 2
    assert payload["_meta"]["shotClockUnattributed"] == 1
    assert payload["_meta"]["leagueDefenderUnattributed"] == 5  # 250 - 245
    ranges = [e["context"] for e in payload["closestDefender"]["player"]]
    assert ranges == dc.DEFENDER_RANGES
    assert payload["closestDefender"]["player"][0] == dc.entry("0-2 Feet - Very Tight")


def test_defender_overrun_fails():
    player = load_fixture("tracking.truncated.json")
    rs = player["response"]["resultSets"][2]  # ClosestDefenderShooting
    h = rs["headers"]
    row = rs["rowSet"][0]  # '2-4 Feet - Tight': FGA 5 -> 8 (sane: all 2s)
    row[h.index("FGA")], row[h.index("FG2A")] = 8, 7
    row[h.index("FG_PCT")] = 0.375  # 3/8
    with pytest.raises(SystemExit, match="Closest Defender family sums to 16"):
        derive_fixtures(player=player)


def test_missing_resolved_filter_response_fails():
    league = load_fixture("tracking.league.truncated.json")
    del league["general"]["Pullups"]  # _meta still claims it resolved
    with pytest.raises(SystemExit, match="no response for General filter"):
        derive_fixtures(league=league)


# --- Frame sanity: corrupt counts never flow on ----------------------------------

def _general_rs(player: dict) -> dict:
    return player["response"]["resultSets"][0]


def test_split_counts_not_summing_fails():
    player = load_fixture("tracking.truncated.json")
    rs = _general_rs(player)
    rs["rowSet"][0][rs["headers"].index("FG2A")] = 2  # 2 + 3 != 4
    with pytest.raises(SystemExit, match="FGA != FG2A"):
        derive_fixtures(player=player)


def test_fg_pct_not_reconciling_fails():
    player = load_fixture("tracking.truncated.json")
    rs = _general_rs(player)
    rs["rowSet"][0][rs["headers"].index("FG_PCT")] = 0.9
    with pytest.raises(SystemExit, match="FG_PCT does not reconcile"):
        derive_fixtures(player=player)


def test_changed_headers_fail():
    player = load_fixture("tracking.truncated.json")
    _general_rs(player)["headers"][0] = "SURPRISE"
    with pytest.raises(SystemExit, match="headers changed"):
        derive_fixtures(player=player)


def test_season_mismatch_between_snapshots_fails():
    league = load_fixture("tracking.league.truncated.json")
    league["_meta"]["season"] = "2024-25"
    with pytest.raises(SystemExit, match="league snapshot season"):
        derive_fixtures(league=league)


# --- The sibling lookup: the identity is never confirmed against the wrong file --

def test_season_fga_target_reads_pre_drop_total(tmp_path):
    shot_payload = {"_meta": {"player": "Test Player", "season": "2025-26",
                              "totalShots": 880, "zoneConflictsDropped": 1}}
    p = tmp_path / "shot.json"
    p.write_text(json.dumps(shot_payload), encoding="utf-8")
    assert dc.season_fga_target(p, "Test Player", "2025-26") == 881


def test_season_fga_target_rejects_wrong_sibling(tmp_path):
    shot_payload = {"_meta": {"player": "Someone Else", "season": "2025-26",
                              "totalShots": 100, "zoneConflictsDropped": 0}}
    p = tmp_path / "shot.json"
    p.write_text(json.dumps(shot_payload), encoding="utf-8")
    with pytest.raises(SystemExit, match="wrong sibling"):
        dc.season_fga_target(p, "Test Player", "2025-26")


# --- Determinism ------------------------------------------------------------------

def test_derive_is_deterministic():
    a = derive_fixtures()
    b = derive_fixtures()
    assert a == b
    assert json.dumps(a) == json.dumps(b)  # field order stable too


def test_derive_does_not_mutate_inputs():
    player = load_fixture("tracking.truncated.json")
    league = load_fixture("tracking.league.truncated.json")
    p_copy, l_copy = copy.deepcopy(player), copy.deepcopy(league)
    derive_fixtures(player=player, league=league)
    assert player == p_copy
    assert league == l_copy
