"""Team shot payload derive tests (ADR-0082): the golden handshake's Python
half over the truncated team fixtures, the box oracle's failure modes, and
the grammar's ordering and conflict rules. Database-free — the record-store
half lives in test_team_season.py.

Run from the repo root:  python -m pytest ingestion -q
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

import derive_team_payload as dtp
import team_payload as tp

REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURES = REPO_ROOT / "tests" / "fixtures"
SNAPSHOT = FIXTURES / "team-snapshot.truncated.json"
ROSTER = FIXTURES / "team-roster.truncated.json"
BOX = FIXTURES / "team-boxscore.truncated.json"
GOLDEN = FIXTURES / "team-shot.golden.json"
GAME = "0022500025"
UTA = 1610612762


def read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def derive_fixture(**overrides) -> dict:
    return dtp.derive(
        overrides.get("snapshot", SNAPSHOT),
        overrides.get("roster", ROSTER),
        raw_root=FIXTURES,
        box_files=[overrides.get("box", BOX)],
    )


def test_golden_matches_the_derive():
    """Regenerate with `npm run golden:regen`; never edit the golden by hand."""
    payload = derive_fixture()
    assert tp.payload_text(payload) == GOLDEN.read_text(encoding="utf-8")


def test_meta_states_the_frontier_from_the_rows():
    payload = derive_fixture()
    meta = payload["_meta"]
    assert meta["schemaVersion"] == tp.SCHEMA_VERSION
    assert meta["tricode"] == "UTA" and meta["teamId"] == UTA
    assert meta["dataThrough"] == max(s["gameDate"] for s in payload["shots"])
    assert meta["gamesIncluded"] == len({s["gameId"] for s in payload["shots"]})
    assert meta["totalShots"] == len(payload["shots"])
    # The synthetic 2PT-in-a-3PT-zone row is dropped and counted, never zoned.
    assert meta["zoneConflictsDropped"] == 1
    assert all(s["gameEventId"] != 9999 for s in payload["shots"])


def test_rows_are_chronological_and_carry_player_identity():
    payload = derive_fixture()
    keys = [
        (s["gameDate"], s["gameId"], s["period"], -s["minutesRemaining"],
         -s["secondsRemaining"], s["gameEventId"])
        for s in payload["shots"]
    ]
    assert keys == sorted(keys)
    assert all(isinstance(s["playerId"], int) and s["playerName"] for s in payload["shots"])
    # Matchup is team-relative: the Jazz were the visitors in PHX.
    assert {(s["opponent"], s["home"]) for s in payload["shots"]} == {("PHX", False)}


def test_roster_passes_through_in_response_order_with_verbatim_labels():
    payload = derive_fixture()
    names = [e["playerName"] for e in payload["roster"]]
    assert names == ["Keyonte George", "Cody Williams", "Svi Mykhailiuk",
                     "Hayden Gray", "Blake Hinson"]
    gray = next(e for e in payload["roster"] if e["playerName"] == "Hayden Gray")
    assert gray["number"] == "" and gray["experience"] == "R"


def test_box_oracle_rejects_a_disagreeing_line(tmp_path):
    box = read(BOX)
    side = box["response"]["boxScoreTraditional"]["awayTeam"]
    assert side["teamId"] == UTA
    side["players"][0]["statistics"]["fieldGoalsAttempted"] += 1
    doctored = tmp_path / "box.json"
    doctored.write_text(json.dumps(box), encoding="utf-8")
    with pytest.raises(SystemExit, match="box FGA"):
        derive_fixture(box=doctored)


def test_box_oracle_rejects_a_shooter_with_no_box_line(tmp_path):
    box = read(BOX)
    side = box["response"]["boxScoreTraditional"]["awayTeam"]
    side["players"] = [p for p in side["players"]
                       if p["statistics"]["fieldGoalsAttempted"] == 0]
    doctored = tmp_path / "box.json"
    doctored.write_text(json.dumps(box), encoding="utf-8")
    with pytest.raises(SystemExit, match="no box line"):
        derive_fixture(box=doctored)


def test_box_oracle_rejects_a_game_without_its_box(tmp_path):
    box = read(BOX)
    box["response"]["boxScoreTraditional"]["gameId"] = "0022500026"
    doctored = tmp_path / "box.json"
    doctored.write_text(json.dumps(box), encoding="utf-8")
    with pytest.raises(SystemExit, match="no box score"):
        derive_fixture(box=doctored)


def test_snapshot_must_be_one_team(tmp_path):
    snapshot = read(SNAPSHOT)
    rows = snapshot["response"]["resultSets"][0]
    idx = rows["headers"].index("TEAM_ID")
    rows["rowSet"][0] = list(rows["rowSet"][0])
    rows["rowSet"][0][idx] = 1610612756
    doctored = tmp_path / "snap.json"
    doctored.write_text(json.dumps(snapshot), encoding="utf-8")
    with pytest.raises(SystemExit, match="TEAM_ID"):
        derive_fixture(snapshot=doctored)


def test_roster_must_match_the_snapshot_team(tmp_path):
    roster = read(ROSTER)
    roster["_meta"]["team_id"] = 1610612756
    doctored = tmp_path / "roster.json"
    doctored.write_text(json.dumps(roster), encoding="utf-8")
    with pytest.raises(SystemExit, match="roster snapshot is team"):
        derive_fixture(roster=doctored)


def test_rollup_sums_pairs_never_rates():
    """ADR-0004 through the tuple rollup: the basic-grain entry equals the
    sum of its fine-grain rows, and the mid-range bands sum to Mid-Range."""
    snapshot = read(SNAPSHOT)
    league = next(rs for rs in snapshot["response"]["resultSets"]
                  if rs["name"] == "LeagueAverages")
    h = league["headers"]
    rows = [(r[h.index("SHOT_ZONE_BASIC")], r[h.index("SHOT_ZONE_RANGE")].rstrip("."),
             int(r[h.index("FGA")]), int(r[h.index("FGM")])) for r in league["rowSet"]]
    entries = tp.rollup_baseline(rows)
    mid = next(e for e in entries if e["grain"] == "basic" and e["zone"] == "Mid-Range")
    bands = [e for e in entries if e["grain"] == "midRangeBand"]
    assert sum(b["fga"] for b in bands) == mid["fga"]
    assert sum(b["fgm"] for b in bands) == mid["fgm"]
    assert mid["fga"] == sum(r[2] for r in rows if r[0] == "Mid-Range")


def test_builder_refuses_an_empty_roster():
    snapshot = read(SNAPSHOT)
    meta, shots, league = tp.validate_team_snapshot(snapshot)
    rows = tp.rows_from_snapshot(shots)
    box = read(BOX)["response"]["boxScoreTraditional"]
    box_fga = {GAME: tp.box_fga_from_box_game(box, UTA, GAME)}
    with pytest.raises(SystemExit, match="empty roster"):
        tp.build_team_payload(meta=meta, source="s", roster_source="r", rows=rows,
                              baseline_rows=tp.baseline_rows_from_frame(league),
                              roster=[], box_fga=box_fga)


def test_derive_and_builder_agree_on_untouched_inputs():
    """A second derive over identical inputs is byte-identical (determinism —
    the golden depends on it)."""
    a = tp.payload_text(derive_fixture())
    b = tp.payload_text(derive_fixture())
    assert a == b
    assert copy.deepcopy(json.loads(a)) == json.loads(b)
