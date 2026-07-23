"""Tests for the season loop's pure decision logic (ADR-0057/0058/0059).

The subprocess plumbing is exercised by the loop's own dry runs; what must
never regress silently is the decision layer: frontier candidacy, the
retreat-vs-halt coherence rule, pinned-shortfall arithmetic at mid-season
frontiers, the Gate 2 mechanical reading, and stuck detection.
"""

from __future__ import annotations

import json

import pytest

import season_update as su

GAMES = {
    "g1": "2026-10-22",
    "g2": "2026-10-24",
    "g3": "2026-10-26",
    "g4": "2026-10-28",
}


# --- Candidate frontier -----------------------------------------------------------

def test_candidate_is_latest_fully_paired_date():
    assert su.candidate_frontier(GAMES, {"g1", "g2", "g3", "g4"}) == "2026-10-28"
    # Last night's pair missing: the frontier waits at the previous date.
    assert su.candidate_frontier(GAMES, {"g1", "g2", "g3"}) == "2026-10-26"


def test_candidate_blocked_by_interior_hole():
    # A missing INTERIOR game caps the frontier below it — later pairs
    # cannot leapfrog a hole (every game <= D must be paired).
    assert su.candidate_frontier(GAMES, {"g1", "g3", "g4"}) == "2026-10-22"


def test_candidate_none_when_nothing_paired():
    assert su.candidate_frontier(GAMES, set()) is None


def test_same_night_doubleheader_needs_both():
    games = {**GAMES, "g4b": "2026-10-28"}
    # Two games on the frontier date: both pairs required to stand on it.
    assert su.candidate_frontier(games, {"g1", "g2", "g3", "g4"}) == "2026-10-26"
    assert su.candidate_frontier(games, {"g1", "g2", "g3", "g4", "g4b"}) == "2026-10-28"


def test_previous_game_date_retreats_one_step():
    assert su.previous_game_date(GAMES, "2026-10-28") == "2026-10-26"
    assert su.previous_game_date(GAMES, "2026-10-22") is None


# --- Pinned shortfall at a frontier (per-game registry) ---------------------------

PINS = {"g2": 3, "g4": 5}  # the Ace shape: two outage games


def test_pins_count_only_through_the_frontier():
    assert su.expected_shortfall_through(PINS, GAMES, "2026-10-22") == 0
    assert su.expected_shortfall_through(PINS, GAMES, "2026-10-24") == 3
    assert su.expected_shortfall_through(PINS, GAMES, "2026-10-26") == 3
    assert su.expected_shortfall_through(PINS, GAMES, "2026-10-28") == 8


def test_pin_for_unknown_game_never_counts():
    # A pin whose game the discovery pull does not know cannot explain
    # anything (games.get default '' > frontier is False-safe).
    assert su.expected_shortfall_through({"gX": 4}, GAMES, "2026-10-28") == 0


# --- The coherence rule: ok / retreat / halt ---------------------------------------

def test_exact_gap_is_ok():
    assert su.coherence_decision(official=100, tracking=100, expected=0) == "ok"
    assert su.coherence_decision(official=100, tracking=97, expected=3) == "ok"


def test_unexplained_shortfall_retreats_lag_defers():
    # Tracking hasn't processed the newest game: gap > pins -> retreat.
    assert su.coherence_decision(official=100, tracking=85, expected=0) == "retreat"
    assert su.coherence_decision(official=100, tracking=94, expected=3) == "retreat"


def test_over_attribution_halts_contradiction_never_outage():
    assert su.coherence_decision(official=100, tracking=101, expected=0) == "halt"
    # Gap smaller than the pins is ALSO contradiction: the pinned outage
    # attempts cannot come back — a shrunken gap means the sources moved.
    assert su.coherence_decision(official=100, tracking=99, expected=3) == "halt"


# --- Gate 2 mechanical reading (ADR-0059) ------------------------------------------

def test_zone_gate_requires_every_evaluation_zone_at_bar():
    ok, failing = su.zone_gate({z: 15 for z in su.EVAL_ZONES})
    assert ok and failing == []
    counts = {z: 40 for z in su.EVAL_ZONES}
    counts["Right Corner 3"] = 14
    ok, failing = su.zone_gate(counts)
    assert not ok and failing == ["Right Corner 3"]


# --- Commit message (the review artifact, ADR-0057) --------------------------------

def test_commit_message_carries_frontier_and_report():
    msg = su.build_commit_message("ace-bailey", "2026-27", "2026-11-20", 15, 1,
                                  ["frontier 2026-11-20", "full gate green"])
    subject = msg.splitlines()[0]
    assert subject == "data: ace-bailey 2026-27 through 2026-11-20 (15 games, +1 new)"
    assert "full gate green" in msg
    assert "ADR-0057" in msg


# --- Stuck detection ----------------------------------------------------------------

@pytest.fixture()
def status_dir(tmp_path):
    def write(name: str, deferred: bool):
        (tmp_path / name).write_text(json.dumps({"deferred": deferred}),
                                     encoding="utf-8")
    return tmp_path, write


def test_consecutive_deferrals_counts_latest_run(status_dir):
    d, write = status_dir
    write("2026-11-01T060000-ace-bailey-2026-27.json", False)
    write("2026-11-02T060000-ace-bailey-2026-27.json", True)
    write("2026-11-03T060000-ace-bailey-2026-27.json", True)
    assert su.consecutive_deferrals(d, "ace-bailey", "2026-27") == 2


def test_consecutive_deferrals_resets_on_clean_session(status_dir):
    d, write = status_dir
    write("2026-11-01T060000-ace-bailey-2026-27.json", True)
    write("2026-11-02T060000-ace-bailey-2026-27.json", False)
    assert su.consecutive_deferrals(d, "ace-bailey", "2026-27") == 0


def test_consecutive_deferrals_scopes_by_hero_season(status_dir):
    d, write = status_dir
    write("2026-11-02T060000-someone-else-2026-27.json", True)
    assert su.consecutive_deferrals(d, "ace-bailey", "2026-27") == 0
