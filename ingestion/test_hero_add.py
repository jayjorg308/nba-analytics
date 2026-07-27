"""Tests for the hero-add orchestrator's pure decision helpers.

The subprocess chain is exercised by real adds (each child hard-fails
loudly on its own); what must never regress silently is the decision
layer: the shared slug rule, game-id discovery from the derived payload,
and the missing-pair computation against the shared corpus — a wrong
"missing" set either re-pulls the whole corpus or silently skips a game
Gate 4 requires.
"""

from __future__ import annotations

import json

import pytest

import hero_add


# --- Slug rule --------------------------------------------------------------------

def test_slug_matches_the_pull_scripts_rule():
    assert hero_add.slug_of("Donovan Mitchell") == "donovan-mitchell"
    assert hero_add.slug_of("Shai Gilgeous-Alexander") == "shai-gilgeous-alexander"


def test_season_pattern():
    assert hero_add.SEASON_PATTERN.match("2025-26")
    assert not hero_add.SEASON_PATTERN.match("2025-2026")
    assert not hero_add.SEASON_PATTERN.match("25-26")


# --- Game-id discovery ------------------------------------------------------------

def test_game_ids_are_unique_and_sorted():
    payload = {"shots": [
        {"gameId": "0022500002"},
        {"gameId": "0022500001"},
        {"gameId": "0022500002"},
    ]}
    assert hero_add.game_ids_of(payload) == ["0022500001", "0022500002"]


def test_game_ids_of_empty_payload():
    assert hero_add.game_ids_of({"shots": []}) == []


# --- Missing-pair computation -----------------------------------------------------

def _write_pair(root, game_id: str, date: str = "2026-07-27") -> None:
    for kind in ("play-by-play", "box-score"):
        path = root / kind / game_id / f"{date}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({}), encoding="utf-8")


def test_missing_game_ids_skips_complete_pairs(tmp_path):
    _write_pair(tmp_path, "0022500001")
    ids = ["0022500001", "0022500002"]
    assert hero_add.missing_game_ids(ids, tmp_path) == ["0022500002"]


def test_missing_game_ids_halts_on_orphaned_half_pair(tmp_path):
    # A play-by-play snapshot with no box sibling must halt (the corpus's
    # own orphan rule), never be treated as complete or as missing.
    orphan = tmp_path / "play-by-play" / "0022500003" / "2026-07-27.json"
    orphan.parent.mkdir(parents=True)
    orphan.write_text(json.dumps({}), encoding="utf-8")
    with pytest.raises(SystemExit):
        hero_add.missing_game_ids(["0022500003"], tmp_path)


# --- Latest-artifact rule ---------------------------------------------------------

def test_latest_json_prefers_later_iso_date(tmp_path):
    (tmp_path / "2026-07-01.json").write_text("{}", encoding="utf-8")
    (tmp_path / "2026-07-15.json").write_text("{}", encoding="utf-8")
    latest = hero_add.latest_json(tmp_path)
    assert latest is not None and latest.name == "2026-07-15.json"


def test_latest_json_empty_dir(tmp_path):
    assert hero_add.latest_json(tmp_path) is None


# --- Headshot formula (ADR-0065) --------------------------------------------------

def test_headshot_url_formula():
    assert (
        hero_add.HEADSHOT_URL.format(player_id=1628378)
        == "https://cdn.nba.com/headshots/nba/latest/1040x760/1628378.png"
    )
