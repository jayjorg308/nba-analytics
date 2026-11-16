"""Tests for the season loop's decision logic (ADR-0057/0058/0059/0091).

The subprocess plumbing is exercised by the loop's own dry runs; what must
never regress silently is the decision layer: frontier candidacy, the
retreat-vs-halt coherence rule, pinned-shortfall arithmetic at mid-season
frontiers, the Gate 2 mechanical reading, stuck detection, the branch
guard's decisions (git itself is faked), and the team session's game
publishing: what each new game pulls, lag deferring the frontier, and the
live publish's order (pulls, git, and npm faked; the record-store steps
stubbed, plus one run of the game step against a real store); the
no-change early exit, which a correction a halted session already saw never
passes; an upstream failure halting only its own session; and the
published-game drift check (a real game log fixture against published
lines: a match, a post-publish correction, and a game the log does not list
yet), report-only after every team session.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path

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


# --- The branch guard (docs/plans/jazz-first-site.md, operations) ---------------

def fake_git(monkeypatch, *, branch: str = "main", porcelain: str = "") -> list[str]:
    """Replace the loop's subprocess seam: rev-parse answers `branch`, status
    answers `porcelain`. Returns the commands the guard issued."""
    calls: list[str] = []

    def fake_run(cmd, **_kw):
        calls.append(cmd)
        out = branch + "\n" if "rev-parse" in cmd else porcelain
        return subprocess.CompletedProcess(cmd, 0, stdout=out, stderr="")

    monkeypatch.setattr(su, "run", fake_run)
    return calls


def test_production_store_requires_main(monkeypatch):
    fake_git(monkeypatch, branch="feature_JazzSite")
    with pytest.raises(su.Halt, match="production record store"):
        su.guard_production_store(argparse.Namespace(db_url=None))


def test_production_store_from_main_passes(monkeypatch):
    fake_git(monkeypatch, branch="main")
    su.guard_production_store(argparse.Namespace(db_url=None))


def test_scratch_store_runs_from_any_branch(monkeypatch):
    # Replays pass --db-url; the guard never even asks git.
    calls = fake_git(monkeypatch, branch="feature_JazzSite")
    su.guard_production_store(argparse.Namespace(db_url="postgresql://scratch"))
    assert calls == []


def test_publish_requires_main(monkeypatch):
    fake_git(monkeypatch, branch="task_Anything")
    with pytest.raises(su.Halt, match="data commit"):
        su.guard_publish()


def test_publish_ignores_the_loops_own_paths(monkeypatch):
    fake_git(monkeypatch, porcelain=(" M public/data/ace-bailey/2026-27.json\n"
                                     " M data/season-loop/status.json\n"))
    su.guard_publish()


def test_publish_halts_on_tracked_changes_elsewhere(monkeypatch):
    fake_git(monkeypatch, porcelain=(" M public/data/ace-bailey/2026-27.json\n"
                                     " M src/App.tsx\n"
                                     "R  db/migrations/a.sql -> db/migrations/b.sql\n"))
    with pytest.raises(su.Halt, match="clean tree") as exc:
        su.guard_publish()
    assert "src/App.tsx" in str(exc.value)
    assert "b.sql" in str(exc.value)
    assert "ace-bailey" not in str(exc.value)


# --- The live gate (docs/plans/jazz-first-site.md, Phase 2) ---------------------

def test_gate_requires_the_record_store_tests(monkeypatch):
    calls = []

    def fake_run(cmd, **kw):
        calls.append((cmd, kw.get("extra_env")))
        return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")

    monkeypatch.setattr(su, "run", fake_run)
    su.run_gate()
    assert [cmd for cmd, _ in calls] == list(su.GATE_COMMANDS)
    assert all(env == {"NBA_REQUIRE_RECORD_STORE": "1"} for _, env in calls)


def test_gate_halts_on_the_first_red_command(monkeypatch):
    calls = []

    def fake_run(cmd, **kw):
        calls.append(cmd)
        code = 1 if cmd == "npm test" else 0
        return subprocess.CompletedProcess(cmd, code, stdout="boom", stderr="")

    monkeypatch.setattr(su, "run", fake_run)
    with pytest.raises(su.Halt, match="npm test") as exc:
        su.run_gate(" (the session's remedy)")
    assert "(the session's remedy)" in str(exc.value)
    assert calls == ["python -m pytest ingestion -q", "npm test"]


# --- Game publishing (ADR-0088/0089/0091) ----------------------------------------
#
# The team session's game step with every pull faked: the fakes write the
# raw-layer snapshots live_pulls would (append-only, self-describing _meta),
# the derive and export are stubbed where the record store is not the point,
# and the subprocess seam answers like a green gate on main.

JAZZ = {"teamId": 1610612762, "teamTricode": "UTA", "teamCity": "Utah", "teamName": "Jazz"}
MEM = {"teamId": 1610612763, "teamTricode": "MEM", "teamCity": "Memphis",
       "teamName": "Grizzlies"}
NOP = {"teamId": 1610612740, "teamTricode": "NOP", "teamCity": "New Orleans",
       "teamName": "Pelicans"}
# The 2026-27 opening week: (date, home, away).
NIGHTS = {"0022600011": ("2026-10-21", MEM, JAZZ), "0022600025": ("2026-10-23", JAZZ, NOP)}
SIDE_FGA = 80
SESSION = {"as_of": None, "stamp": "T000000", "pull_date": "2026-10-24", "sleep": 0}


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def write_pair(raw, game_id, home, away):
    """A game's pbp/box pair on disk; each side's box FGA is SIDE_FGA."""
    players = [{"statistics": {"fieldGoalsAttempted": SIDE_FGA // 2}}] * 2
    write_json(raw / "play-by-play" / game_id / "2026-10-24.json", {"_meta": {}})
    write_json(raw / "box-score" / game_id / "2026-10-24.json", {"_meta": {}, "response": {
        "boxScoreTraditional": {"homeTeam": {**home, "players": players},
                                "awayTeam": {**away, "players": players}}}})


def shot_snapshot(rows):
    """A shotchartdetail snapshot as the raw layer holds one."""
    return {"_meta": {}, "response": {"resultSets": [{
        "name": "Shot_Chart_Detail", "headers": ["GAME_ID", "GAME_DATE", "SHOT_TYPE"],
        "rowSet": rows}]}}


def night_rows(date_to=None, corrected=()):
    """Two threes a game through date_to. A corrected game's first shot reads
    as a two: the 2026-11-09 shape (game 0022600168, event 278, reclassified
    3PT to 2PT), the same games and the same count with one row's content
    changed."""
    return [[gid, d.replace("-", ""),
             "2PT Field Goal" if gid in corrected and i == 0 else "3PT Field Goal"]
            for gid, (d, _, _) in NIGHTS.items()
            for i in range(2) if date_to is None or d <= date_to]


class FakePulls:
    """Every live_pulls call the team session makes, recorded. `short`
    names (game_id, tricode) one-day pulls that land a row short of the box;
    `logged` the games a fresh league game log names (default: all);
    `corrected` the games whose shots upstream has corrected (night_rows)."""

    def __init__(self, monkeypatch, *, short=(), logged=None, corrected=()):
        self.calls: list[tuple] = []
        self.short, self.logged, self.corrected = set(short), logged, set(corrected)
        for name in ("pull_ruler_snapshot", "pull_team_game_snapshot",
                     "pull_league_game_log_snapshot", "pull_roster_snapshot",
                     "pull_team_shot_snapshot"):
            monkeypatch.setattr(su.live_pulls, name, getattr(self, name))

    def pull_ruler_snapshot(self, season, out_dir, *, through, stamp, pull_date):
        self.calls.append(("ruler", through))
        return write_json(out_dir / through / f"{pull_date}{stamp}.json", {"_meta": {}})

    def pull_team_game_snapshot(self, team, team_id, season, out_dir, *, game_id,
                                game_date, stamp, pull_date):
        tricode = out_dir.parent.parent.name.upper()
        self.calls.append(("one-day", game_id, tricode))
        rows = SIDE_FGA - 1 if (game_id, tricode) in self.short else SIDE_FGA
        return write_json(out_dir / game_id / f"{pull_date}{stamp}.json", {"_meta": {
            "team": team, "game_id": game_id, "game_date": game_date,
            "games_in_rows": [game_id], "shot_rows": rows}})

    def pull_league_game_log_snapshot(self, season, out_dir, *, date_to, stamp, pull_date):
        self.calls.append(("game-log", date_to))
        ids = list(NIGHTS) if self.logged is None else self.logged
        return write_json(out_dir / f"{pull_date}{stamp}.json", {"_meta": {}, "response": {
            "resultSets": [{"name": "LeagueGameLog", "headers": ["GAME_ID"],
                            "rowSet": [[gid] for gid in ids]}]}})

    def pull_roster_snapshot(self, team, team_id, season, out_dir, *, stamp, pull_date):
        return write_json(out_dir / f"{pull_date}{stamp}.json", {"_meta": {}})

    def pull_team_shot_snapshot(self, team, team_id, season, out_dir, *, date_to, stamp,
                                pull_date):
        self.calls.append(("team", date_to))
        return write_json(out_dir / f"{pull_date}{stamp}.json",
                          shot_snapshot(night_rows(date_to, self.corrected)))


def test_unpublished_games_are_paired_through_the_date_without_a_file(tmp_path):
    write_json(tmp_path / "games" / "g1.json", {})
    assert su.unpublished_games(GAMES, {"g1", "g2", "g4"}, "2026-10-26", tmp_path) == {
        "g2": "2026-10-24"}


def test_new_games_pull_their_ruler_both_sides_and_one_game_log(tmp_path, monkeypatch):
    raw = tmp_path / "raw"
    for gid, (_, home, away) in NIGHTS.items():
        write_pair(raw, gid, home, away)
    pulls = FakePulls(monkeypatch)
    new = {gid: night[0] for gid, night in NIGHTS.items()}
    assert su.ensure_game_sources(new, "2026-27", raw, **SESSION) == {}
    assert pulls.calls == [
        ("ruler", "2026-10-20"), ("one-day", "0022600011", "MEM"),
        ("one-day", "0022600011", "UTA"), ("ruler", "2026-10-22"),
        ("one-day", "0022600025", "UTA"), ("one-day", "0022600025", "NOP"),
        ("game-log", None),
    ]
    # Everything is on disk now: a rerun pulls nothing.
    pulls.calls.clear()
    assert su.ensure_game_sources(new, "2026-27", raw, **SESSION) == {}
    assert pulls.calls == []


def test_a_replay_anchors_the_game_log_at_its_date(tmp_path, monkeypatch):
    raw = tmp_path / "raw"
    write_pair(raw, "0022600011", MEM, JAZZ)
    pulls = FakePulls(monkeypatch)
    su.ensure_game_sources({"0022600011": "2026-10-21"}, "2026-27", raw,
                           **{**SESSION, "as_of": "2026-10-21"})
    assert pulls.calls[-1] == ("game-log", "2026-10-21")


def test_a_pull_short_of_the_box_is_pulled_again_and_lags(tmp_path, monkeypatch):
    raw = tmp_path / "raw"
    write_pair(raw, "0022600011", MEM, JAZZ)
    # Last night's pull landed short; tonight's re-pull is short again.
    write_json(raw / "_teams" / "uta" / "2026-27" / "games" / "0022600011"
               / "2026-10-21T234500.json",
               {"_meta": {"games_in_rows": ["0022600011"], "shot_rows": 61}})
    pulls = FakePulls(monkeypatch, short={("0022600011", "UTA")})
    lagging = su.ensure_game_sources({"0022600011": "2026-10-21"}, "2026-27", raw, **SESSION)
    assert list(lagging) == ["0022600011"]
    assert "UTA one-day pull has 79 rows" in lagging["0022600011"]
    assert ("one-day", "0022600011", "UTA") in pulls.calls
    assert not any(c[0] == "game-log" for c in pulls.calls)  # nothing left to log


def test_a_game_the_league_log_does_not_name_yet_lags(tmp_path, monkeypatch):
    raw = tmp_path / "raw"
    for gid, (_, home, away) in NIGHTS.items():
        write_pair(raw, gid, home, away)
    pulls = FakePulls(monkeypatch, logged=["0022600011"])
    new = {gid: night[0] for gid, night in NIGHTS.items()}
    lagging = su.ensure_game_sources(new, "2026-27", raw, **SESSION)
    assert lagging == {"0022600025": "not yet in the league game log"}
    assert [c for c in pulls.calls if c[0] == "game-log"] == [("game-log", None)]


# --- The team session, wired end to end (record store stubbed) ------------------

LIVE_UTA = {"tricode": "UTA", "teamId": 1610612762, "team": "Utah Jazz",
            "season": "2026-27", "mode": "live"}
CARD = "public/social-cards/jazz/2026-10-21-mem.png"


def session_args(**overrides):
    return argparse.Namespace(**{"as_of": None, "force": False, "no_commit": False,
                                 "no_push": True, "engine": "db",
                                 "db_url": "postgresql://scratch", "sleep": 0,
                                 **overrides})


@pytest.fixture()
def jazz_world(tmp_path, monkeypatch):
    """A repo in tmp_path with the opening week's pairs on disk, the
    record-store steps stubbed (they record the universe they were handed),
    and git and npm answering like a green gate on main. Each test fakes
    the pulls itself."""
    monkeypatch.setattr(su, "REPO", tmp_path)
    monkeypatch.setattr(su, "STATUS_DIR", tmp_path / "data" / "season-loop")
    raw = tmp_path / "data" / "raw"
    for gid, (_, home, away) in NIGHTS.items():
        write_pair(raw, gid, home, away)
    world = {"commands": [], "derived": [], "exported": [], "tmp": tmp_path}

    def derive(args, team, season, shot_path, roster_path, universe, out_path, report):
        world["derived"].append(set(universe))
        write_json(out_path, {"_meta": {
            "dataThrough": max(NIGHTS[g][0] for g in universe),
            "gamesIncluded": len(universe), "totalShots": 2 * len(universe),
            "zoneConflictsDropped": 0}})

    def export(args, team, season, universe, raw_root, out_dir, published_dir, report):
        world["exported"].append(dict(universe))
        return [f"{d}-{(a if h is JAZZ else h)['teamTricode'].lower()}"
                for gid, (d, h, a) in NIGHTS.items() if gid in universe]

    def fake_run(cmd, **_kw):
        world["commands"].append(cmd)
        out = ""
        if "rev-parse" in cmd:
            out = "main\n"
        elif cmd.startswith("git status") and "social-cards" in cmd:
            out = f"?? {CARD}\n?? public/social-cards/ace-bailey.png\n"
        elif cmd.startswith("git status") and "_teams" in cmd:
            out = "?? public/data/_teams/uta/2026-27/\n"
        return subprocess.CompletedProcess(cmd, 0, stdout=out, stderr="")

    monkeypatch.setattr(su, "db_derive_team", derive)
    monkeypatch.setattr(su, "db_export_games", export)
    monkeypatch.setattr(su, "run", fake_run)
    return world


def published_commands(world) -> list[str]:
    return [c for c in world["commands"]
            if not c.startswith("git status") and "rev-parse" not in c]


def commit_message(world) -> str:
    return (world["tmp"] / "data" / "season-loop" / "commit-msg-team-uta.txt").read_text(
        encoding="utf-8")


def test_a_live_team_session_publishes_new_games_with_their_cards(jazz_world, monkeypatch):
    pulls = FakePulls(monkeypatch)
    status = su.run_team(LIVE_UTA, session_args())
    assert (status["outcome"], status["frontier"], status["deferred"]) == (
        "published", "2026-10-23", False)
    assert status["newGames"] == ["2026-10-21-mem", "2026-10-23-nop"]
    assert jazz_world["exported"] == [{"0022600011": "2026-10-21", "0022600025": "2026-10-23"}]
    assert ("ruler", "2026-10-20") in pulls.calls and ("ruler", "2026-10-22") in pulls.calls
    # Sync, then the cards, then the full gate, then a commit that carries
    # the team's cards and never a hero's.
    commands = published_commands(jazz_world)
    assert commands == [
        "npm run team:sync -- uta 2026-27",
        "npm run cards:games -- --missing",
        *su.GATE_COMMANDS,
        "git add public/data/_teams/uta/",
        f"git add -- {CARD}",
        commands[-1],
    ]
    assert commands[-1].startswith("git commit -F")
    message = commit_message(jazz_world)
    assert message.splitlines()[0] == (
        "data: team-uta 2026-27 through 2026-10-23 (2 games, +2 new)")
    assert "share cards: 2026-10-21-mem" in message


def test_a_lagging_game_holds_the_frontier_before_it(jazz_world, monkeypatch):
    pulls = FakePulls(monkeypatch, short={("0022600025", "NOP")})
    status = su.run_team(LIVE_UTA, session_args())
    assert (status["candidate"], status["frontier"], status["deferred"]) == (
        "2026-10-23", "2026-10-21", True)
    assert list(status["lagging"]) == ["0022600025"]
    assert ("team", "2026-10-21") in pulls.calls  # the anchored pull at the frontier
    assert jazz_world["derived"] == [{"0022600011"}]
    assert jazz_world["exported"] == [{"0022600011": "2026-10-21"}]
    assert ("game 0022600025 (2026-10-23) deferred: NOP one-day pull has 79 rows"
            in commit_message(jazz_world))


def test_a_dark_team_session_exports_but_publishes_nothing(jazz_world, monkeypatch):
    FakePulls(monkeypatch)
    status = su.run_team({**LIVE_UTA, "mode": "dark"}, session_args())
    assert status["outcome"] == "dark"
    assert status["newGames"] == ["2026-10-21-mem", "2026-10-23-nop"]
    assert published_commands(jazz_world) == []


def test_the_no_change_exit_needs_the_index_at_the_candidate(jazz_world, monkeypatch):
    pulls = FakePulls(monkeypatch)
    team_root = jazz_world["tmp"] / "data" / "raw" / "_teams" / "uta" / "2026-27"
    su.live_pulls.pull_team_shot_snapshot("Utah Jazz", 0, "2026-27", team_root, date_to=None,
                                          stamp="T000000-discovery", pull_date="2026-10-23")
    deployed = jazz_world["tmp"] / "public" / "data" / "_teams" / "uta"
    write_json(deployed / "2026-27.json", {"_meta": {
        "dataThrough": "2026-10-23", "totalShots": 4, "zoneConflictsDropped": 0,
        "sourceSnapshot": "data/raw/_teams/uta/2026-27/2026-10-23T000000-discovery.json"}})
    # The team payload already stands at the candidate, but no season index
    # does (a session that never published its games): no early exit.
    assert su.run_team(LIVE_UTA, session_args())["outcome"] == "published"

    write_json(deployed / "2026-27" / "index.json", {"_meta": {"dataThrough": "2026-10-23"}})
    pulls.calls.clear()
    status = su.run_team(LIVE_UTA, session_args())
    assert status["outcome"] == "no-change"
    assert pulls.calls == [("team", None)]  # the discovery pull alone


# The no-change exit after a halt (2026-11-09/10). Upstream corrected one
# row's content (game 0022600168, event 278, 3PT to 2PT) with the frontier and
# the count unchanged. The 23:45 session halted at the store on the changed
# row, so the store and the deployed payload kept the old one; the 06:30
# session's discovery then equaled the halted session's, and it exited
# no-change with the correction still unloaded. The exit now compares against
# the rows the deployed payload was built from.

DEPLOYED_SOURCE = "data/raw/_teams/uta/2026-27/2026-10-24T091545-discovery.json"


def deploy_opening_week(world, source):
    """The deployed team payload, season index, and both game files at
    2026-10-23, the payload built from the snapshot `source` names."""
    deployed = world["tmp"] / "public" / "data" / "_teams" / "uta"
    write_json(deployed / "2026-27.json", {"_meta": {
        "dataThrough": "2026-10-23", "totalShots": 4, "zoneConflictsDropped": 0,
        "sourceSnapshot": source}})
    write_json(deployed / "2026-27" / "index.json", {"_meta": {"dataThrough": "2026-10-23"}})
    for gid in NIGHTS:
        write_json(deployed / "2026-27" / "games" / f"{gid}.json", {})


def test_a_correction_a_halted_session_saw_is_never_no_change(jazz_world, monkeypatch):
    write_json(jazz_world["tmp"] / DEPLOYED_SOURCE, shot_snapshot(night_rows()))
    deploy_opening_week(jazz_world, DEPLOYED_SOURCE)
    FakePulls(monkeypatch, corrected={"0022600011"})
    stamps = iter(["T234500", "T234501", "T234502"])
    monkeypatch.setattr(su.live_pulls, "stamp_now", lambda: next(stamps))

    def refuse(*_args):
        raise su.Halt("record-store load halted: shot 0022600011 #1 changed")

    monkeypatch.setattr(su, "db_derive_team", refuse)
    # The session that first sees the correction halts at the store; the
    # next one, whose discovery equals the halted session's, halts again.
    for _ in range(2):
        with pytest.raises(su.Halt, match="changed"):
            su.run_team(LIVE_UTA, session_args())
    # Once a published payload is built from the corrected rows, the exit
    # holds again.
    team_root = jazz_world["tmp"] / "data" / "raw" / "_teams" / "uta" / "2026-27"
    (halted,) = team_root.glob("*T234500-discovery.json")
    deploy_opening_week(jazz_world, halted.relative_to(jazz_world["tmp"]).as_posix())
    assert su.run_team(LIVE_UTA, session_args())["outcome"] == "no-change"


class PastTheExit(Exception):
    """The hero session went on to its coherence search: no early exit."""


def test_a_hero_session_never_reads_an_unloaded_correction_as_no_change(
        jazz_world, monkeypatch):
    hero = {"slug": "keyonte-george", "player": "Keyonte George", "playerId": 1641718,
            "season": "2026-27", "mode": "live"}
    season_dir = jazz_world["tmp"] / "data" / "raw" / "keyonte-george" / "2026-27"
    published = write_json(season_dir / "2026-10-24T091545-discovery.json",
                           shot_snapshot(night_rows()))
    # The halted session's discovery, which already carries the correction.
    halted = write_json(season_dir / "2026-10-24T234500-discovery.json",
                        shot_snapshot(night_rows(corrected={"0022600011"})))
    deployed = jazz_world["tmp"] / "public" / "data" / "keyonte-george" / "2026-27.json"

    def deploy(source):
        write_json(deployed, {"_meta": {
            "dataThrough": "2026-10-23", "totalShots": 4, "zoneConflictsDropped": 0,
            "sourceSnapshot": source.relative_to(jazz_world["tmp"]).as_posix()}})

    def pull_shot(player, player_id, season, out_dir, *, date_to, stamp, pull_date):
        return write_json(out_dir / f"{pull_date}{stamp}.json",
                          shot_snapshot(night_rows(date_to, {"0022600011"})))

    def pull_tracking(*_args, **_kwargs):
        raise PastTheExit

    monkeypatch.setattr(su.live_pulls, "pull_shot_snapshot", pull_shot)
    monkeypatch.setattr(su.live_pulls, "pull_tracking_snapshot", pull_tracking)
    stamps = iter(["T063007", "T063008"])
    monkeypatch.setattr(su.live_pulls, "stamp_now", lambda: next(stamps))
    deploy(published)
    with pytest.raises(PastTheExit):
        su.run_season(hero, {}, session_args())
    deploy(halted)
    assert su.run_season(hero, {}, session_args())["outcome"] == "no-change"


def test_the_no_change_exit_needs_the_deployed_source_on_disk(jazz_world):
    meta = {"dataThrough": "2026-10-23", "totalShots": 4, "zoneConflictsDropped": 0}
    rows = night_rows()
    assert not su.upstream_matches_deployed(meta, "2026-10-23", rows)  # names none
    meta["sourceSnapshot"] = DEPLOYED_SOURCE
    assert not su.upstream_matches_deployed(meta, "2026-10-23", rows)  # not on disk
    write_json(jazz_world["tmp"] / DEPLOYED_SOURCE, shot_snapshot(rows))
    assert su.upstream_matches_deployed(meta, "2026-10-23", rows)
    assert not su.upstream_matches_deployed(meta, "2026-10-24", rows)
    assert not su.upstream_matches_deployed(
        meta, "2026-10-23", night_rows(corrected={"0022600025"}))


def test_a_live_team_session_on_the_files_engine_halts_first(jazz_world, monkeypatch):
    pulls = FakePulls(monkeypatch)
    with pytest.raises(su.Halt, match="DB-native"):
        su.run_team(LIVE_UTA, session_args(engine="files"))
    assert pulls.calls == []


# --- The game step against a real store (Docker; skips without it) --------------

def test_the_game_step_exports_new_games_from_the_raw_layer(pg_dsn, tmp_path):
    """db_export_games on the fixture game laid out as the raw layer holds
    it: both teams' one-day pulls, the ruler through the day before, the
    league game log. The file is the golden but for its provenance; a rerun
    over the published file writes nothing; a published file that would
    change halts the session."""
    import load_game_corpus as lgc
    import load_team_season as lts
    import record_store as rs
    from regen_game_golden import FIXTURES, GAME_ID, GOLDEN, INDEX_GOLDEN, TEAM
    from test_game_payload import subject_one_day_pull

    raw = tmp_path / "raw"

    def place(source, *parts):
        dest = raw.joinpath(*parts)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, dest)

    place(FIXTURES / "game-boxscore.truncated.json", "box-score", GAME_ID, "2026-07-16.json")
    place(FIXTURES / "game-ruler.json", "_league", "2025-26", "rulers", "2026-01-02",
          "2026-09-26.json")
    place(FIXTURES / "game-log.truncated.json", "_league", "2025-26", "game-log",
          "2026-10-14.json")
    place(FIXTURES / "game-opponent-snapshot.truncated.json", "_teams", "gsw", "2025-26",
          "games", GAME_ID, "2026-09-28.json")
    place(subject_one_day_pull(tmp_path / "made"), "_teams", "uta", "2025-26", "games",
          GAME_ID, "2026-10-15.json")
    with rs.connect(pg_dsn) as conn:  # what the team derive has loaded by now
        rs.apply_migrations(conn)
        lgc.load_game_pairs(conn, [GAME_ID], pairs=[
            (FIXTURES / "game-playbyplay.truncated.json",
             FIXTURES / "game-boxscore.truncated.json")])
        lts.load_team_season(conn, FIXTURES / "game-team-snapshot.truncated.json",
                             FIXTURES / "team-roster.truncated.json")

    args, published = argparse.Namespace(db_url=pg_dsn), tmp_path / "public"
    universe = {GAME_ID: "2026-01-03"}
    slugs = su.db_export_games(args, TEAM, "2025-26", universe, raw, tmp_path / "out1",
                               published, [])
    assert slugs == ["2026-01-03-gsw"]

    def provenance_free(text: str) -> dict:
        game = json.loads(text)
        for side in game["sides"]:
            side.pop("sourceShotSnapshot")
        game["_meta"]["ruler"].pop("sourceSnapshot")
        return game

    game_text = (tmp_path / "out1" / "games" / f"{GAME_ID}.json").read_text(encoding="utf-8")
    subject_source = json.loads(game_text)["sides"][0]["sourceShotSnapshot"]
    assert subject_source.endswith(f"_teams/uta/2025-26/games/{GAME_ID}/2026-10-15.json")
    assert provenance_free(game_text) == provenance_free(GOLDEN.read_text(encoding="utf-8"))
    assert (tmp_path / "out1" / "index.json").read_text(encoding="utf-8") == (
        INDEX_GOLDEN.read_text(encoding="utf-8"))

    shutil.copytree(tmp_path / "out1" / "games", published / "games")
    assert su.db_export_games(args, TEAM, "2025-26", universe, raw, tmp_path / "out2",
                              published, []) == []
    (published / "games" / f"{GAME_ID}.json").write_text("{}", encoding="utf-8")
    with pytest.raises(su.Halt, match="immutable"):
        su.db_export_games(args, TEAM, "2025-26", universe, raw, tmp_path / "out3",
                           published, [])


def test_the_store_reports_a_heros_shots_past_his_frontier(pg_dsn):
    # ADR-0080 as amended 2026-10-28: the team load writes George's shots in
    # the 2026-01-03 game, so a hero session whose tracking stops at
    # 2026-01-02 finds the store past its frontier and defers.
    import load_team_season as lts
    import record_store as rs
    from regen_game_golden import FIXTURES

    with rs.connect(pg_dsn) as conn:
        rs.apply_migrations(conn)
        lts.load_team_season(conn, FIXTURES / "game-team-snapshot.truncated.json",
                             FIXTURES / "team-roster.truncated.json")
    args = argparse.Namespace(db_url=pg_dsn)
    george = 1641718
    assert su.store_shots_after(args, george, "2025-26", "2026-01-02") == "2026-01-03"
    assert su.store_shots_after(args, george, "2025-26", "2026-01-03") is None
    assert su.store_shots_after(args, george, "2026-27", "2025-10-01") is None


# ---------------------------------------------------- one session's upstream failure


def test_upstream_failure_halts_only_its_own_session(monkeypatch, tmp_path):
    # A pull that stays down through live_pulls' retries halts its session
    # like any Halt; the sessions after it still run (before 2026-10-16 the
    # exception ended the process, so a hero's 500 cost the morning's team
    # session), and the run still exits non-zero so the wrapper toasts.
    config = {
        "liveSeasons": [
            {"slug": "first-hero", "season": "2026-27", "mode": "dark"},
            {"slug": "second-hero", "season": "2026-27", "mode": "dark"},
        ],
        "liveTeams": [{"tricode": "UTA", "team": "Utah Jazz", "teamId": 1610612762,
                       "season": "2026-27", "mode": "dark"}],
    }
    config_path = tmp_path / "season.config.json"
    config_path.write_text(json.dumps(config), encoding="utf-8")
    ran: list[str] = []

    def fake_season(entry, _pins, _args):
        ran.append(entry["slug"])
        if entry["slug"] == "first-hero":
            raise su.live_pulls.UpstreamUnavailable(
                "playerdashptshots (player_id=1): stats.nba.com failed 4 attempts")
        return {"slug": entry["slug"], "season": entry["season"], "outcome": "no-data"}

    def fake_team(entry, _args):
        ran.append(entry["tricode"])
        return {"slug": su.team_slug(entry), "season": entry["season"], "outcome": "no-data"}

    monkeypatch.setattr(su, "run_season", fake_season)
    monkeypatch.setattr(su, "run_team", fake_team)
    monkeypatch.setattr(su, "published_drift_step", lambda _entry, _args: {})  # no live log
    monkeypatch.setattr(su, "STATUS_DIR", tmp_path / "status")
    monkeypatch.setattr(su.sys, "argv", ["season_update.py", "--config", str(config_path)])
    with pytest.raises(SystemExit) as exited:
        su.main()
    assert exited.value.code == 1
    assert ran == ["first-hero", "second-hero", "UTA"]
    def status(key: str) -> dict:
        (path,) = (tmp_path / "status").glob(f"*-{key}-2026-27.json")
        return json.loads(path.read_text(encoding="utf-8"))

    halted = status("first-hero")
    assert halted["outcome"] == "halt" and "failed 4 attempts" in halted["error"]
    assert status("second-hero")["outcome"] == "no-data"
    assert status("team-uta")["outcome"] == "no-data"


def test_accepted_frame_changes_reach_the_report_and_the_status_record():
    # ADR-0080 as amended 2026-10-22: what a loop load accepted becomes a
    # report line (the data commit's body) and the status file's record.
    record = {"through": "2026-10-21", "snapshot": "data/raw/x.json",
              "changes": ["league_zone_baseline {...}: fga 304 -> 303"]}
    report: list[str] = []
    assert su.accepted_frame_changes({"_leagueFrameChanges": record}, report) == record
    assert report == ["league frame: 1 change(s) accepted (frame through 2026-10-21)"]
    report = []
    assert su.accepted_frame_changes({"shot": {"changed": 0}}, report) is None
    assert report == []


def test_accepted_player_renames_reach_the_report_and_the_status_record():
    # ADR-0080 as amended 2026-10-28, the frame's rule for player names.
    renames = ["player {'player_id': 1630619}: name 'Moussa Cisse' -> 'Moussa Cissé'"]
    report: list[str] = []
    assert su.accepted_player_renames({"_playerRenames": renames}, report) == renames
    assert report == ["player names: 1 rename(s) accepted"]
    report = []
    assert su.accepted_player_renames({"player": {"changed": 0}}, report) is None
    assert report == []


def test_accepted_tracking_changes_reach_the_report_and_the_status_record():
    # ADR-0080 as amended 2026-11-02: the tracking baseline under the frame's rule.
    record = {"through": "2026-10-31", "snapshot": "data/raw/t.json",
              "changes": ["league_creation_team {...}: fg3a 1 -> 0"]}
    report: list[str] = []
    assert su.accepted_frame_changes({"_leagueTrackingChanges": record}, report,
                                     key="_leagueTrackingChanges",
                                     label="league tracking") == record
    assert report == ["league tracking: 1 change(s) accepted (frame through 2026-10-31)"]


def test_accepted_season_fact_changes_reach_the_report_and_the_status_record():
    # ADR-0080 as amended 2026-11-02: other players' season facts.
    changes = ["player_season {'player_id': 1643417, ...}: fga 17 -> 16"]
    report: list[str] = []
    assert su.accepted_season_fact_changes(
        {"_leagueSeasonFactChanges": changes}, report) == changes
    assert report == ["league season facts: 1 change(s) accepted"]
    report = []
    assert su.accepted_season_fact_changes({"player_season": {"changed": 0}}, report) is None
    assert report == []


# --- Published game drift (ADR-0091 as amended 2026-11-16) ------------------------
#
# The real league game log of 2026-11-16 cut to two published Jazz games:
# Miami, unchanged since it published, and Orlando, whose Utah line the NBA
# corrected afterward (a Darryn Peterson trip, two of two, added: 106 to 108).
# The published lines below are the committed ones of that morning; the
# 2026-11-15 game is published too, and the cut leaves it out of the log.

FIXTURES = Path(__file__).resolve().parents[1] / "tests" / "fixtures"
DRIFT_LOG = FIXTURES / "game-log.drift.truncated.json"
UTA_ID = 1610612762


def box(points, fgm, fga, tpm, tpa, ftm, fta, ast):
    return {"points": points, "fgm": fgm, "fga": fga, "tpm": tpm, "tpa": tpa,
            "ftm": ftm, "fta": fta, "ast": ast}


# gameId: (slug, opponent, opponent's team id, Jazz line, opponent's line)
PUBLISHED = {
    "0022600214": ("2026-11-10-mia", "MIA", 1610612748,
                   box(109, 41, 84, 13, 33, 14, 22, 28), box(115, 35, 89, 12, 41, 33, 44, 24)),
    "0022600224": ("2026-11-11-orl", "ORL", 1610612753,
                   box(106, 33, 81, 14, 44, 26, 32, 21), box(123, 41, 87, 18, 46, 23, 28, 24)),
    "0022600239": ("2026-11-15-sas", "SAS", 1610612759,
                   box(102, 41, 89, 17, 40, 3, 6, 26), box(110, 41, 85, 10, 33, 18, 20, 27)),
}


def publish(published_dir, game_ids, *, opponent_lines=None, game_files=True):
    """A published season as the check reads it: the season index (schema
    v2) and each game file (schema v1), cut to the fields the check reads.
    `opponent_lines` overrides an opponent's published line by game id."""
    opponent_lines = opponent_lines or {}
    rows = []
    for gid in game_ids:
        slug, opponent, opponent_id, jazz, theirs = PUBLISHED[gid]
        theirs = opponent_lines.get(gid, theirs)
        rows.append({"gameId": gid, "slug": slug, "gameDate": slug[:10],
                     "opponent": opponent, "home": True, "teamScore": jazz["points"],
                     "opponentScore": theirs["points"], "box": jazz, "players": []})
        if game_files:
            write_json(published_dir / "games" / f"{gid}.json", {
                "_meta": {"gameId": gid, "teamId": UTA_ID, "tricode": "UTA",
                          "opponentTeamId": opponent_id, "opponentTricode": opponent},
                "sides": [{"teamId": UTA_ID, "tricode": "UTA", "box": jazz},
                          {"teamId": opponent_id, "tricode": opponent, "box": theirs}]})
    write_json(published_dir / "index.json", {
        "_meta": {"schemaVersion": 2, "team": "Utah Jazz", "teamId": UTA_ID,
                  "tricode": "UTA", "season": "2026-27"},
        "games": rows})
    return published_dir


def drift_log(**meta):
    """The fixture log, its _meta overridden (a pull's date, a replay's bound)."""
    snapshot = json.loads(DRIFT_LOG.read_text(encoding="utf-8"))
    snapshot["_meta"].update(meta)
    return snapshot


ORL_DRIFT = {"gameId": "0022600224", "slug": "2026-11-11-orl", "gameDate": "2026-11-11",
             "diffs": ["UTA points 106 -> 108", "UTA ftm 26 -> 28", "UTA fta 32 -> 34"]}


def test_a_published_game_the_log_agrees_with_is_no_drift(tmp_path):
    published = publish(tmp_path, ["0022600214"])
    result = su.published_game_drift(published, drift_log())
    assert result == {"checked": 1, "unlisted": [], "drifted": []}
    assert su.drift_report_lines({"gameLog": "game-log/2026-11-16T094524.json", **result}) == [
        "published games: 1 match the league game log (2026-11-16T094524)"]


def test_a_correction_after_publishing_is_drift_named_stat_by_stat(tmp_path):
    published = publish(tmp_path, list(PUBLISHED))
    result = su.published_game_drift(published, drift_log())
    assert result == {"checked": 2, "unlisted": ["2026-11-15-sas"], "drifted": [ORL_DRIFT]}
    assert su.drift_report_lines({"gameLog": "game-log/2026-11-16T094524.json", **result}) == [
        "!! PUBLISHED GAME DRIFT: 1 of 2 published game(s) differ from the league game log "
        "(2026-11-16T094524), 1 not in it yet; a correction travels by PR",
        "   2026-11-11-orl (0022600224): UTA points 106 -> 108, UTA ftm 26 -> 28, "
        "UTA fta 32 -> 34",
    ]


def test_a_game_the_log_does_not_list_yet_is_lag_never_drift(tmp_path):
    # The log trails the box score on a game night (ADR-0058): the game is
    # compared next session, never reported as drift.
    published = publish(tmp_path, ["0022600239"])
    assert su.published_game_drift(published, drift_log()) == {
        "checked": 0, "unlisted": ["2026-11-15-sas"], "drifted": []}


def test_the_opponents_whole_line_is_read_from_its_game_file(tmp_path):
    # The index carries only the opponent's score; the game file carries
    # its box team line, which the report card shows.
    wrong = {"0022600214": {**PUBLISHED["0022600214"][4], "fga": 88}}
    published = publish(tmp_path / "files", ["0022600214"], opponent_lines=wrong)
    assert su.published_game_drift(published, drift_log())["drifted"] == [{
        "gameId": "0022600214", "slug": "2026-11-10-mia", "gameDate": "2026-11-10",
        "diffs": ["MIA fga 88 -> 89"]}]
    # Without its game file the opponent is held to the log on its score alone.
    wrong = {"0022600214": {**PUBLISHED["0022600214"][4], "points": 114, "fga": 88}}
    published = publish(tmp_path / "index", ["0022600214"], opponent_lines=wrong,
                        game_files=False)
    assert su.published_game_drift(published, drift_log())["drifted"][0]["diffs"] == [
        "MIA points 114 -> 115"]


def test_a_team_the_log_does_not_name_in_a_listed_game_is_drift(tmp_path):
    published = publish(tmp_path, ["0022600214"])
    snapshot = drift_log()
    rows = snapshot["response"]["resultSets"][0]["rowSet"]
    rows[:] = [r for r in rows if r[1] != 1610612748]  # the Miami row vanishes
    assert su.published_game_drift(published, snapshot)["drifted"][0]["diffs"] == [
        "MIA has no row in the league game log for this game"]


class LogPulls:
    """The drift check's one possible pull, recorded: it lands the fixture
    log stamped with the pull's date, as live_pulls would."""

    def __init__(self, monkeypatch, *, fail=False):
        self.calls: list[tuple] = []
        self.fail = fail
        monkeypatch.setattr(su.live_pulls, "pull_league_game_log_snapshot", self.pull)
        monkeypatch.setattr(su.live_pulls, "stamp_now", lambda: "T063500")

    def pull(self, season, out_dir, *, date_to, stamp, pull_date):
        self.calls.append((season, date_to, pull_date))
        if self.fail:
            raise su.live_pulls.UpstreamUnavailable(
                "leaguegamelog: stats.nba.com failed 4 attempts")
        return write_json(out_dir / f"{pull_date}{stamp}.json", drift_log(pull_date=pull_date))


def test_the_drift_log_is_todays_on_disk_or_one_fresh_pull(tmp_path, monkeypatch):
    raw = tmp_path / "raw"
    log_dir = raw / "_league" / "2026-27" / "game-log"
    pulls = LogPulls(monkeypatch)
    # Pulled today with no date bound (a game night's game step): reused.
    todays = write_json(log_dir / "2026-11-16T000100.json", drift_log(pull_date="2026-11-16"))
    assert su.drift_game_log("2026-27", raw, today="2026-11-16", sleep=0) == todays
    assert pulls.calls == []
    # A replay's bounded log of today is not the league's current record.
    write_json(log_dir / "2026-11-16T000200.json",
               drift_log(pull_date="2026-11-16", date_to="2026-11-10"))
    pulled = su.drift_game_log("2026-27", raw, today="2026-11-16", sleep=0)
    assert pulled.name == "2026-11-16T063500.json"
    assert pulls.calls == [("2026-27", None, "2026-11-16")]
    # Yesterday's log is stale: one fresh pull; none at all on disk: one pull.
    pulls.calls.clear()
    assert su.drift_game_log("2026-27", raw, today="2026-11-17", sleep=0).name == (
        "2026-11-17T063500.json")
    assert su.drift_game_log("2026-27", tmp_path / "empty", today="2026-11-17",
                             sleep=0).name == "2026-11-17T063500.json"
    assert pulls.calls == [("2026-27", None, "2026-11-17")] * 2


UTA_ENTRY = {"tricode": "UTA", "teamId": UTA_ID, "team": "Utah Jazz",
             "season": "2026-27", "mode": "live"}


@pytest.fixture()
def drift_repo(tmp_path, monkeypatch):
    """A repo in tmp_path with the 2026-11-16 morning's three games published
    and the calendar reading 2026-11-16."""
    class Today(su.date):
        @classmethod
        def today(cls):
            return cls(2026, 11, 16)

    monkeypatch.setattr(su, "REPO", tmp_path)
    monkeypatch.setattr(su, "date", Today)
    publish(tmp_path / "public" / "data" / "_teams" / "uta" / "2026-27", list(PUBLISHED))
    return tmp_path


def test_the_drift_step_names_the_drift_against_one_pull(drift_repo, monkeypatch):
    pulls = LogPulls(monkeypatch)
    result = su.published_drift_step(UTA_ENTRY, session_args())
    assert result == {"gameLog": "data/raw/_league/2026-27/game-log/2026-11-16T063500.json",
                      "checked": 2, "unlisted": ["2026-11-15-sas"], "drifted": [ORL_DRIFT]}
    # The game-night session later that day reads the same log: no second pull.
    assert su.published_drift_step(UTA_ENTRY, session_args()) == result
    assert pulls.calls == [("2026-27", None, "2026-11-16")]


def test_the_drift_step_never_halts_a_session(drift_repo, monkeypatch):
    pulls = LogPulls(monkeypatch, fail=True)
    assert su.published_drift_step(UTA_ENTRY, session_args()) == {
        "error": "leaguegamelog: stats.nba.com failed 4 attempts"}
    # A season with nothing published reads no log at all.
    dark = {**UTA_ENTRY, "season": "2027-28", "mode": "dark"}
    assert su.published_drift_step(dark, session_args()) == {
        "checked": 0, "unlisted": [], "drifted": []}
    assert len(pulls.calls) == 1


def test_every_team_session_records_its_drift_and_a_replay_skips_it(monkeypatch, tmp_path):
    # Whatever the session's outcome (here a halt), its status file carries
    # the check; under --as-of the check never runs (a replay reads no live log).
    config_path = write_json(tmp_path / "season.config.json", {
        "liveSeasons": [], "liveTeams": [{**UTA_ENTRY, "mode": "dark"}]})
    checked: list[str] = []

    def fake_team(entry, _args):
        raise su.Halt("discovery pull contradicted the store")

    def fake_drift(entry, _args):
        checked.append(entry["tricode"])
        return {"gameLog": "data/raw/_league/2026-27/game-log/2026-11-16T063500.json",
                "checked": 2, "unlisted": ["2026-11-15-sas"], "drifted": [ORL_DRIFT]}

    monkeypatch.setattr(su, "run_team", fake_team)
    monkeypatch.setattr(su, "published_drift_step", fake_drift)
    monkeypatch.setattr(su, "photo_candidates_step", lambda _entry: {})
    monkeypatch.setattr(su, "STATUS_DIR", tmp_path / "status")

    def run_main(*extra) -> dict:
        monkeypatch.setattr(su.sys, "argv", ["season_update.py", "--config",
                                             str(config_path), *extra])
        with pytest.raises(SystemExit):
            su.main()
        (path,) = (tmp_path / "status").glob("*-team-uta-2026-27.json")
        status = json.loads(path.read_text(encoding="utf-8"))
        path.unlink()
        return status

    status = run_main()
    assert status["outcome"] == "halt"
    assert status["publishedGameDrift"]["drifted"] == [ORL_DRIFT]
    assert checked == ["UTA"]
    status = run_main("--as-of", "2026-11-12")
    assert "publishedGameDrift" not in status and "photoCandidates" not in status
    assert checked == ["UTA"]
