"""The season loop (ADR-0057/0058/0059): one command from pull session to
data commit, for every designated live hero-season.

THE SHAPE (per session, per live season in season.config.json):
  1. DISCOVERY  — one unfiltered shotchartdetail pull enumerates the season's
     games (0 rows = season not started; a clean no-op, not a failure).
  2. PBP FILL   — missing play-by-play/box pairs pulled by game id (the
     shared game-owned layer, ADR-0045).
  3. FRONTIER   — candidate = the latest game date whose games all have
     pairs; then the coherence search (ADR-0058 amendment): one cheap
     anchored tracking pull per candidate, compared against the official
     row count minus the PINNED shortfall through that date
     (season.config.json trackingShortfalls — per game, because a
     mid-season frontier is only explained by pins at or before it).
     Unexplained gap = tracking lag = RETREAT one game date (deferral).
     Tracking exceeding official-minus-pins = contradiction = HALT.
  4. ANCHORED PULLS — shots, league totals, league tracking, all at
     DateTo = the settled frontier (live_pulls.py; the raw artifacts are
     self-describing).
  5. DERIVES    — the four production derives, explicit file args, every
     oracle live (Gates 3/4/5 are their hard-fails).
  6. GATES      — the five-gate evaluation; in dark mode the report's
     "GATES PASS" line is the live-flip starting gun (ADR-0059) and
     nothing publishes.
  7. PUBLISH    — live mode only: hero:sync, the FULL repository gate
     (pytest + vitest + lint + build — the reviewer, ADR-0057), and on
     green a data-only commit (public/data/<slug> only) pushed to main.
     Any red halts loudly: status file + nonzero exit; nothing ships.

STUCK DETECTION: a frontier deferred behind the candidate for
STUCK_SESSIONS consecutive sessions raises the staleness alarm in the
status (ADR-0058: a human decides whether to wait out the upstream gap).

REPLAY HOOK (Phase 4): --as-of <date> anchors the discovery pull too, so
the whole session runs against a completed season as if the calendar read
<date>. Same code path end to end; --no-commit/--no-push contain effects.

THE TEAM SESSION (ADR-0081/0082, per liveTeams entry, after the heroes):
  roster + team-wide discovery pulls, missing pairs, the pair frontier (no
  tracking coherence — no team tracking contract), then each unpublished
  game's own sources (ADR-0091: its pre-game ruler, both teams' one-day
  pulls reconciled to the box, a league game log that names it; a source
  that lags defers the game and the frontier with it), the anchored team
  pull, the team shot derive (record store or files), the game files and
  season index exported into data/derived against the published ones
  (ADR-0088: a published game that would change halts), the frontier gate,
  and in live mode team:sync -> cards:games for the new games -> full gate
  -> a data-only commit of public/data/_teams/<tricode>/ and those cards.
  A tool surface renders from game one, so there is no volume gate; dark
  mode still pulls and derives daily.

LOCAL-ONLY: stats.nba.com blocks cloud IPs. Run on the dev machine, via
scripts/season-update.ps1 under Task Scheduler for the daily cadence.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import date, datetime
from pathlib import Path

import live_pulls
import pull_opponent_games as pog
from pull_rulers import day_before

STUCK_SESSIONS = 3
RETREAT_LIMIT = 10
EVAL_ZONES = [
    "Restricted Area", "In The Paint (Non-RA)", "Mid-Range",
    "Left Corner 3", "Right Corner 3", "Above the Break 3",
]
ZONE_INCLUSION_MIN_ATTEMPTS = 15  # mirrors src/domain/constants.ts

REPO = Path(__file__).resolve().parents[1]
STATUS_DIR = REPO / "data" / "season-loop"


def log(msg: str) -> None:
    print(msg, flush=True)


# --- Pure helpers (unit-tested in test_season_update.py) -----------------------

def candidate_frontier(games: dict[str, str], paired: set[str]) -> str | None:
    """The latest game date D such that EVERY game dated <= D has a valid
    pair on disk. Games beyond D simply wait (deferral, never failure)."""
    dates = sorted(set(games.values()))
    best: str | None = None
    for d in dates:
        if all(gid in paired for gid, gd in games.items() if gd <= d):
            best = d
        else:
            break
    return best


def previous_game_date(games: dict[str, str], frontier: str) -> str | None:
    """The next-lower game date to retreat to; None when there is nowhere
    left to retreat."""
    earlier = sorted({d for d in games.values() if d < frontier})
    return earlier[-1] if earlier else None


def expected_shortfall_through(pins: dict[str, int], games: dict[str, str],
                               frontier: str) -> int:
    """The pinned tracking shortfall a frontier must expect: only pinned
    games the discovery pull knows, AT OR BEFORE the frontier, explain a
    gap (per-game registry; an unknown game id explains nothing)."""
    return sum(n for gid, n in pins.items()
               if gid in games and games[gid] <= frontier)


def coherence_decision(official: int, tracking: int, expected: int) -> str:
    """ok = the gap is exactly the pinned expectation; retreat = an
    unexplained shortfall (tracking lag — the newest games wait); halt =
    tracking exceeds official minus pins (contradiction, never outage)."""
    gap = official - tracking
    if gap == expected:
        return "ok"
    if gap > expected:
        return "retreat"
    return "halt"


def zone_gate(zone_counts: dict[str, int]) -> tuple[bool, list[str]]:
    """Gate 2's mechanical reading (ADR-0059): every evaluation zone at or
    above the inclusion bar."""
    failing = [z for z in EVAL_ZONES
               if zone_counts.get(z, 0) < ZONE_INCLUSION_MIN_ATTEMPTS]
    return (not failing, failing)


def build_commit_message(slug: str, season: str, frontier: str, games: int,
                         new_games: int, report_lines: list[str]) -> str:
    """The data commit's structured message (ADR-0057): subject carries the
    frontier, body carries the day's report — the review artifact."""
    subject = (f"data: {slug} {season} through {frontier} "
               f"({games} games, +{new_games} new)")
    body = "\n".join(report_lines)
    return f"{subject}\n\n{body}\n\nAutomated season-loop data commit (ADR-0057)."


def consecutive_deferrals(status_dir: Path, slug: str, season: str) -> int:
    """How many of the most recent sessions for this hero-season ended
    deferred (candidate ahead of the published frontier) — the stuck-frontier
    alarm counts these (ADR-0058)."""
    files = sorted(status_dir.glob(f"*-{slug}-{season}.json"), reverse=True)
    run = 0
    for f in files:
        try:
            status = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            break
        if status.get("deferred"):
            run += 1
        else:
            break
    return run


# --- Session plumbing -----------------------------------------------------------

def run(cmd: str, *, cwd: Path = REPO, timeout: int = 1800,
        extra_env: dict[str, str] | None = None) -> subprocess.CompletedProcess:
    log(f"  $ {cmd}")
    env = {**os.environ, **extra_env} if extra_env else None
    return subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True,
                          text=True, timeout=timeout, env=env)


# The full repository gate a live publish must pass. NBA_REQUIRE_RECORD_STORE
# turns the record-store tests' skips (no Docker, daemon down, no psycopg,
# container failed; ingestion/conftest.py) into failures: a publish never
# rides on checks that did not run. Seen 2026-09-25, when Docker was down in
# the loop clone and the suite passed with 23 of them skipped.
GATE_COMMANDS = ("python -m pytest ingestion -q", "npm test",
                 "npm run lint", "npm run build")
GATE_ENV = {"NBA_REQUIRE_RECORD_STORE": "1"}


def run_gate(on_red: str = "") -> None:
    """Run the full gate; Halt on the first red command. `on_red` adds the
    session's own remedy to the halt message."""
    for cmd in GATE_COMMANDS:
        result = run(cmd, extra_env=GATE_ENV)
        if result.returncode != 0:
            raise Halt(f"gate red — publish halted{on_red}:\n[{cmd}]\n"
                       f"{result.stdout[-4000:]}\n{result.stderr[-4000:]}")


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def shot_rows(snapshot: dict) -> tuple[list[str], list[list]]:
    for rs in snapshot["response"].get("resultSets", []):
        if rs.get("name") == "Shot_Chart_Detail":
            return rs["headers"], rs["rowSet"]
    return [], []


def tracking_general_fga(snapshot: dict) -> int:
    for rs in snapshot["response"].get("resultSets", []):
        if rs.get("name") == "GeneralShooting":
            fga_i = rs["headers"].index("FGA")
            return sum(int(r[fga_i]) for r in rs["rowSet"])
    return -1


def paired_game_exists(raw_root: Path, game_id: str) -> bool:
    pbp = raw_root / "play-by-play" / game_id
    box = raw_root / "box-score" / game_id
    return (pbp.is_dir() and any(pbp.glob("*.json"))
            and box.is_dir() and any(box.glob("*.json")))


class Halt(Exception):
    """A condition a human must resolve — never published around."""


# --- The branch guard (docs/plans/jazz-first-site.md, operations) --------------
#
# Two actions are only safe from main. Loading into the PRODUCTION record
# store: every loader applies every migration file on the checked-out
# branch, so a feature branch's unmerged migration would land in production
# under a name main may later change (the 0007_team_shots -> 0009 rename is
# the case that made this rule — a recorded migration renamed runs again).
# And a DATA COMMIT: it must land on main's history, gated by code that is
# committed there, so the tree may carry no tracked change outside the paths
# the loop itself writes. A scratch store (--db-url) and --no-commit runs
# are unaffected — which is what keeps replays and dry runs usable from any
# branch. The scheduled wrapper pulls main before the session; this guard is
# the backstop for a checkout left on the wrong branch.

LOOP_OWNED_PATHS = ("public/data/", "data/")


def current_branch() -> str:
    return run("git rev-parse --abbrev-ref HEAD").stdout.strip()


def require_main(action: str, remedy: str) -> None:
    branch = current_branch()
    if branch != "main":
        raise Halt(f"branch guard: {action} runs only from main, and this "
                   f"checkout is on {branch!r} — {remedy}")


def guard_production_store(args: argparse.Namespace) -> None:
    """Loading without --db-url means the production store (DSN from
    NBA_DB_URL or .env): main only."""
    if args.db_url is None:
        require_main("loading into the production record store",
                     "switch to main, or pass --db-url for a scratch store")


def tracked_changes_outside_loop_paths() -> list[str]:
    """Porcelain v1 lines for tracked changes the loop did not make."""
    dirty = []
    for line in run("git status --porcelain --untracked-files=no").stdout.splitlines():
        path = line[3:]
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        path = path.strip().strip('"').replace("\\", "/")
        if path and not path.startswith(LOOP_OWNED_PATHS):
            dirty.append(line)
    return dirty


def guard_publish() -> None:
    """A data commit: main only, with no tracked change outside the data the
    loop writes (the gate must have run on committed code)."""
    require_main("a data commit",
                 "switch to main (or run the loop from its own clone)")
    dirty = tracked_changes_outside_loop_paths()
    if dirty:
        raise Halt("branch guard: a data commit needs a clean tree, but "
                   "tracked files outside the loop's paths are modified:\n"
                   + "\n".join(dirty))


def db_derive(args: argparse.Namespace, player: str, season: str,
              shot_path: Path, advanced_path: Path, tracking_path: Path,
              league_tracking_path: Path, totals_path: Path,
              universe: set[str], derived: Path, out: str,
              report: list[str]) -> None:
    """The DB-engine derive phase (ADR-0080): load the session's snapshots
    into the record store (every reconciliation live; change detection halts
    on corrections, growth flows), then export the four payloads to the same
    derived paths the file derives use. A LoadHalt or any loader/export
    hard-fail is a session Halt."""
    guard_production_store(args)
    import derive_payload as dp
    import export_creation_payload as ecr
    import export_freethrow_payload as efp
    import export_shot_context_payload as ecp
    import export_shot_payload as esp
    import load_game_corpus as lgc
    import load_hero_season as lhs
    import load_tracking as lt
    import record_store as rs

    with rs.connect(rs.resolve_dsn(args.db_url)) as conn:
        rs.apply_migrations(conn)
        try:
            lhs.load_hero_season(conn, snapshot_path=shot_path,
                                 advanced_path=advanced_path)
            lt.load_tracking(conn, player, season,
                             snapshot_path=tracking_path,
                             league_path=league_tracking_path)
            lgc.load_game_corpus(conn, player, season,
                                 totals_path=totals_path,
                                 universe_games=universe)
        except lhs.LoadHalt as halt:
            raise Halt(f"record-store load halted: {halt}") from halt
        except SystemExit as exc:
            raise Halt(f"record-store load failed: {exc}") from exc
        report.append("record-store loads ok (change-detected, oracles live)")

        shot_out = derived / out
        exports = [
            ("shot", esp, shot_out, {}),
            ("creation", ecr, derived / "creation" / out, {}),
            ("shot-context", ecp, derived / "shot-context" / out,
             {"source_shot_payload": dp.repo_relative(shot_out)}),
            ("freethrow", efp, derived / "freethrow" / out,
             {"source_shot_payload": dp.repo_relative(shot_out)}),
        ]
        for name, mod, path, kwargs in exports:
            try:
                payload = mod.export_payload(conn, player, season, **kwargs)
            except SystemExit as exc:
                raise Halt(f"{name} export failed: {exc}") from exc
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(mod.payload_text(payload), encoding="utf-8",
                            newline="\n")
            report.append(f"{name} export ok (record store)")


def run_season(entry: dict, pins_all: dict, args: argparse.Namespace) -> dict:
    slug, player = entry["slug"], entry["player"]
    player_id, season = int(entry["playerId"]), entry["season"]
    mode = entry["mode"]
    pins: dict[str, int] = pins_all.get(f"{slug}/{season}", {})
    pull_date = date.today().isoformat()
    stamp = live_pulls.stamp_now()
    raw_root = REPO / "data" / "raw"
    season_dir = raw_root / slug / season
    report: list[str] = []
    status: dict = {"slug": slug, "season": season, "mode": mode,
                    "session": f"{pull_date}{stamp}", "asOf": args.as_of}

    log(f"\n=== season loop: {player} {season} [{mode}]"
        f"{' as-of ' + args.as_of if args.as_of else ''} ===")

    # 1. Discovery.
    discovery_path = live_pulls.pull_shot_snapshot(
        player, player_id, season, season_dir,
        date_to=args.as_of, stamp=f"{stamp}-discovery", pull_date=pull_date)
    log(f"  discovery -> {discovery_path.name}")
    headers, rows = shot_rows(read_json(discovery_path))
    if not rows:
        status.update(outcome="no-data",
                      note="season has no shots yet — nothing to derive")
        log("  no shots yet — clean no-op")
        return status
    gid_i, gd_i = headers.index("GAME_ID"), headers.index("GAME_DATE")
    games = {}
    for r in rows:
        d = str(r[gd_i])
        games[str(r[gid_i])] = f"{d[:4]}-{d[4:6]}-{d[6:]}"

    # 2. Fill missing pbp/box pairs.
    missing = sorted(g for g in games if not paired_game_exists(raw_root, g))
    if missing:
        log(f"  pulling {len(missing)} missing game pair(s)")
        run(f"python ingestion/pull_play_by_play.py --game-ids {' '.join(missing)}",
            timeout=3600)
    paired = {g for g in games if paired_game_exists(raw_root, g)}
    new_games = len(missing) - len([g for g in missing if g not in paired])

    # 3. Frontier: candidate from pair availability, then coherence search.
    candidate = candidate_frontier(games, paired)
    if candidate is None:
        status.update(outcome="deferred", deferred=True,
                      note="no game has a complete pair yet — frontier unset")
        log("  DEFERRED: no publishable frontier yet")
        return status

    # No-change early exit (live mode): if upstream is byte-identical to the
    # previous session's discovery AND the deployed payload already sits at
    # the candidate frontier, there is nothing to publish — most off-day
    # mornings end here, before any anchored pull. A halted prior session
    # cannot slip through: its deployed payload is stale, failing the
    # frontier/count checks. Content-only upstream corrections always change
    # the discovery rowset, so they run the full session; --force skips this
    # exit entirely.
    deployed_shot = REPO / "public" / "data" / slug / f"{season}.json"
    prior_discoveries = sorted(p for p in season_dir.glob("*-discovery.json")
                               if p != discovery_path)
    if (mode == "live" and not args.force and deployed_shot.exists()
            and prior_discoveries):
        deployed_meta = read_json(deployed_shot)["_meta"]
        _, prior_rows = shot_rows(read_json(prior_discoveries[-1]))
        pre_drop = (deployed_meta["totalShots"]
                    + deployed_meta["zoneConflictsDropped"])
        if (deployed_meta["dataThrough"] == candidate
                and pre_drop == len(rows) and prior_rows == rows):
            status.update(outcome="no-change", frontier=candidate,
                          note="upstream identical to previous session; "
                               "deployed already at the candidate frontier")
            log("  no change upstream — session ends before anchored pulls")
            return status

    frontier = candidate
    tracking_path: Path | None = None
    for attempt in range(RETREAT_LIMIT):
        time.sleep(args.sleep)
        tracking_path = live_pulls.pull_tracking_snapshot(
            player, player_id, season, season_dir / "tracking",
            date_to=frontier, stamp=f"{stamp}-c{attempt}", pull_date=pull_date)
        tracking_sum = tracking_general_fga(read_json(tracking_path))
        official = sum(1 for r in rows
                       if f"{str(r[gd_i])[:4]}-{str(r[gd_i])[4:6]}-{str(r[gd_i])[6:]}" <= frontier)
        expected = expected_shortfall_through(pins, games, frontier)
        decision = coherence_decision(official, tracking_sum, expected)
        log(f"  coherence @ {frontier}: official {official} · tracking {tracking_sum}"
            f" · pinned {expected} -> {decision}")
        if decision == "ok":
            break
        if decision == "halt":
            raise Halt(
                f"tracking ({tracking_sum}) exceeds official ({official}) minus "
                f"pins ({expected}) at {frontier} — contradiction, never outage")
        prev = previous_game_date(games, frontier)
        if prev is None:
            status.update(outcome="deferred", deferred=True,
                          note=f"tracking lags every frontier candidate "
                               f"(last tried {frontier})")
            log("  DEFERRED: tracking lags all candidates")
            return status
        frontier = prev
    else:
        status.update(outcome="deferred", deferred=True,
                      note=f"retreat limit hit at {frontier}")
        log("  DEFERRED: retreat limit")
        return status

    deferred = frontier != candidate or len(paired) < len(games)
    status.update(frontier=frontier, candidate=candidate, deferred=deferred)
    report.append(f"frontier {frontier} (candidate {candidate})"
                  + (" — deferred games pending upstream" if deferred else ""))
    if deferred:
        prior = consecutive_deferrals(STATUS_DIR, slug, season)
        if prior + 1 >= STUCK_SESSIONS:
            status["stuckAlarm"] = True
            report.append(
                f"!! STALENESS ALARM: frontier behind candidate for "
                f"{prior + 1} consecutive sessions — characterize the gap "
                f"(outage -> pin it in season.config.json; ADR-0058)")

    # 4. Anchored pulls at the settled frontier.
    max_disc_date = max(games.values())
    if frontier == max_disc_date and (args.as_of is None or args.as_of == frontier):
        shot_path = discovery_path  # discovery already ends at the frontier
    else:
        time.sleep(args.sleep)
        shot_path = live_pulls.pull_shot_snapshot(
            player, player_id, season, season_dir,
            date_to=frontier, stamp=f"{stamp}-frontier", pull_date=pull_date)
    time.sleep(args.sleep)
    totals_path = live_pulls.pull_league_totals_snapshot(
        season, raw_root / "_league" / season / "totals",
        date_to=frontier, stamp=stamp, pull_date=pull_date)
    time.sleep(args.sleep)
    # The usage source (ADR-0069), anchored like its totals sibling. A lag
    # surfaces as the shot derive's FGA-oracle failure — a halt, the same
    # class as a lagging totals artifact failing Gate 5.
    advanced_path = live_pulls.pull_league_advanced_snapshot(
        season, raw_root / "_league" / season / "advanced",
        date_to=frontier, stamp=stamp, pull_date=pull_date)
    league_tracking_path = live_pulls.pull_league_tracking_snapshot(
        season, raw_root / "_league" / season / "tracking",
        date_to=frontier, stamp=stamp, pull_date=pull_date, sleep=args.sleep)

    # 5. The four derives — every oracle is live; a failure is a halt.
    #    --engine files: the production file derives (subprocesses).
    #    --engine db: load -> check -> export through the record store
    #    (ADR-0080), writing the SAME derived file paths, so gates, sync,
    #    and the replay's oracles are engine-blind.
    derived = REPO / "data" / "derived" / slug / season
    out = f"{pull_date}{stamp}.json"
    if args.engine == "db":
        universe = {gid for gid, gd in games.items() if gd <= frontier}
        db_derive(args, player, season, shot_path, advanced_path,
                  tracking_path, league_tracking_path, totals_path,
                  universe, derived, out, report)
    else:
        steps = [
            ("shot", f"python ingestion/derive_payload.py "
                     f"--snapshot-file \"{shot_path}\" "
                     f"--advanced-file \"{advanced_path}\" "
                     f"--out-file \"{derived / out}\""),
            ("creation", f"python ingestion/derive_creation.py "
                         f"--snapshot-file \"{tracking_path}\" "
                         f"--league-file \"{league_tracking_path}\" "
                         f"--shot-payload-file \"{derived / out}\" "
                         f"--out-file \"{derived / 'creation' / out}\""),
            ("shot-context", f"python ingestion/derive_shot_context.py "
                             f"--shot-payload-file \"{derived / out}\" "
                             f"--out-file \"{derived / 'shot-context' / out}\""),
            ("freethrow", f"python ingestion/derive_freethrow.py "
                          f"--shot-payload-file \"{derived / out}\" "
                          f"--league-totals-file \"{totals_path}\" "
                          f"--out-file \"{derived / 'freethrow' / out}\""),
        ]
        for name, cmd in steps:
            result = run(cmd)
            if result.returncode != 0:
                raise Halt(f"{name} derive failed:\n{result.stdout}\n{result.stderr}")
            report.append(f"{name} derive ok")

    # 6. Gates (ADR-0059): 1 from the baseline frame, 2 from the rows,
    #    3/4/5 are the derives' own hard-fails, plus Gate 4's corpus check.
    shot_payload = read_json(derived / out)
    zone_counts: dict[str, int] = {}
    for s in shot_payload["shots"]:
        zone_counts[s["zoneBasic"]] = zone_counts.get(s["zoneBasic"], 0) + 1
    g2_ok, g2_failing = zone_gate(zone_counts)
    context_meta = read_json(derived / "shot-context" / out)["_meta"]
    g4_ok = context_meta["gamesLoaded"] == context_meta["gamesExpected"]
    gates_pass = g2_ok and g4_ok and not deferred
    status["gates"] = {"volume": g2_ok, "volumeFailing": g2_failing,
                       "playByPlay": g4_ok, "pass": gates_pass}
    report.append(
        "GATES PASS — ready for the live flip (ADR-0059)" if gates_pass
        else f"gates not yet passing (volume failing: {g2_failing or 'none'})")

    if mode == "dark":
        status.update(outcome="dark", flipReady=gates_pass)
        log(f"  dark mode: derived + reported, publishing nothing"
            f"{' — GATES PASS, flip is ready' if gates_pass else ''}")
        return status

    # 7. Publish (live mode): sync -> full gate -> data commit on green.
    if not args.no_commit:
        guard_publish()
    result = run(f"npm run hero:sync -- {slug} {season}")
    if result.returncode != 0:
        raise Halt(f"hero:sync failed:\n{result.stdout}\n{result.stderr}")
    run_gate(" (nothing ships until a human acts; a broken verdict guard "
             "means rewrite copy + mapping together)")
    report.append("full gate green")

    changed = run(f"git status --porcelain public/data/{slug}/").stdout.strip()
    if not changed:
        status.update(outcome="no-change")
        report.append("deployed payloads unchanged — nothing to commit")
        log("  no change — nothing to commit")
        return status
    if args.no_commit:
        status.update(outcome="dry-run", wouldCommit=True)
        log("  --no-commit: gate green, commit skipped")
        return status
    msg_file = STATUS_DIR / f"commit-msg-{slug}.txt"
    msg_file.parent.mkdir(parents=True, exist_ok=True)
    msg_file.write_text(
        build_commit_message(slug, season, frontier, len(games), new_games,
                             report),
        encoding="utf-8")
    for cmd in (f"git add public/data/{slug}",
                f"git commit -F \"{msg_file}\""):
        result = run(cmd)
        if result.returncode != 0:
            raise Halt(f"git step failed:\n[{cmd}]\n{result.stderr}")
    if not args.no_push:
        result = run("git push")
        if result.returncode != 0:
            raise Halt(f"git push failed (commit is local):\n{result.stderr}")
    status.update(outcome="published", pushed=not args.no_push)
    log(f"  published through {frontier}")
    return status


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="The season loop (ADR-0057/0058/0059).")
    ap.add_argument("--config", default=str(REPO / "season.config.json"))
    ap.add_argument("--slug", help="run one live hero season only")
    ap.add_argument("--team", help="run one live team only (tricode, e.g. UTA — "
                                   "ADR-0081/0082)")
    ap.add_argument("--as-of", dest="as_of",
                    help="replay hook (Phase 4): anchor the whole session at "
                         "this ISO date as if the calendar read it")
    ap.add_argument("--no-commit", action="store_true",
                    help="stop after the full gate; never commit")
    ap.add_argument("--force", action="store_true",
                    help="skip the no-change early exit (re-derive and "
                         "re-gate even when upstream looks identical)")
    ap.add_argument("--no-push", action="store_true",
                    help="commit locally but never push")
    ap.add_argument("--engine", choices=("files", "db"), default="db",
                    help="derive phase (ADR-0080, cutover 2026-08-24): "
                         "load->export through the record store (default), "
                         "or the legacy file derives (fallback)")
    ap.add_argument("--db-url",
                    help="record-store DSN for --engine db (default: "
                         "NBA_DB_URL / .env — the production store; the "
                         "replay passes its own scratch store)")
    ap.add_argument("--sleep", type=float, default=1.5)
    args = ap.parse_args()

    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    # Selection: --slug runs one hero, --team one team; either alone skips
    # the other class; neither runs every live season and every live team.
    only_teams = args.team is not None and args.slug is None
    only_heroes = args.slug is not None and args.team is None
    entries = [] if only_teams else [
        e for e in config["liveSeasons"] if args.slug is None or e["slug"] == args.slug]
    team_entries = [] if only_heroes else [
        e for e in config.get("liveTeams", [])
        if args.team is None or e["tricode"].lower() == args.team.lower()]
    if not entries and not team_entries:
        sys.exit(f"no live seasons or teams matched (slug={args.slug!r}, "
                 f"team={args.team!r}) in {args.config}")
    pins_all = config.get("trackingShortfalls", {})

    STATUS_DIR.mkdir(parents=True, exist_ok=True)
    session = f"{date.today().isoformat()}{datetime.now().strftime('T%H%M%S')}"
    halted = False
    for entry in entries:
        try:
            status = run_season(entry, pins_all, args)
        except Halt as halt:
            status = {"slug": entry["slug"], "season": entry["season"],
                      "mode": entry["mode"], "outcome": "halt",
                      "error": str(halt)}
            log(f"  HALT: {halt}")
            halted = True
        status_path = (STATUS_DIR
                       / f"{session}-{entry['slug']}-{entry['season']}.json")
        status_path.write_text(json.dumps(status, indent=2), encoding="utf-8")
        log(f"  status -> {status_path}")
    for entry in team_entries:
        slug = team_slug(entry)
        try:
            status = run_team(entry, args)
        except Halt as halt:
            status = {"slug": slug, "team": entry["team"], "season": entry["season"],
                      "mode": entry.get("mode", "dark"), "outcome": "halt",
                      "error": str(halt)}
            log(f"  HALT: {halt}")
            halted = True
        status_path = STATUS_DIR / f"{session}-{slug}-{entry['season']}.json"
        status_path.write_text(json.dumps(status, indent=2), encoding="utf-8")
        log(f"  status -> {status_path}")
    sys.exit(1 if halted else 0)



# --- The team session (ADR-0081/0082, the Jazz surface plan) -------------------

def team_slug(entry: dict) -> str:
    """The status-file and commit-subject key for a team entry."""
    return f"team-{entry['tricode'].lower()}"


# --- Game publishing (ADR-0088/0089/0091) ---------------------------------------
#
# A game publishes as one immutable file, so everything it names must be
# stable from the session that first writes it: its pre-game ruler, the
# league game log behind the ruler's game count, and BOTH teams' one-day
# pulls. The subject reads its own one-day pull, not the season pull, because
# the season pull's source head moves every session and an immutable file
# cannot name a moving source (ADR-0091).

CARDS_DIR = "public/social-cards/"


def latest_json(directory: Path) -> Path | None:
    """The latest snapshot in a raw directory (stamped names sort in pull
    order), or None when it has none."""
    snaps = sorted(directory.glob("*.json")) if directory.is_dir() else []
    return snaps[-1] if snaps else None


def one_day_pull_dir(raw_root: Path, tricode: str, season: str) -> Path:
    """Where a team's one-day pulls land, one directory per game."""
    return raw_root / "_teams" / tricode.lower() / season / "games"


def logged_games(log_path: Path) -> set[str]:
    """The game ids a league game log snapshot names."""
    headers, rows = live_pulls.result_rows(read_json(log_path)["response"], "LeagueGameLog")
    return {str(r[headers.index("GAME_ID")]) for r in rows}


def unpublished_games(games: dict[str, str], paired: set[str], through: str,
                      published_dir: Path) -> dict[str, str]:
    """The paired games through a date that have no published game file:
    the ones this session sources and, on green, publishes."""
    return {gid: gd for gid, gd in games.items()
            if gd <= through and gid in paired
            and not (published_dir / "games" / f"{gid}.json").exists()}


def ensure_game_sources(new: dict[str, str], season: str, raw_root: Path, *,
                        as_of: str | None, stamp: str, pull_date: str,
                        sleep: float) -> dict[str, str]:
    """Put on disk what each new game's file reads, pulling only what is
    missing: the pre-game ruler (the league frame through the day before,
    ADR-0089), both teams' one-day pulls (the teams read from the game's box
    score; one on disk that does not reconcile with the box is pulled
    again), and a league game log that names every new game (one fresh pull
    when the latest on disk does not). Returns {game_id: reason} for the
    games whose sources still fall short: lag, which defers (ADR-0058)."""
    lagging: dict[str, str] = {}
    rulers = raw_root / "_league" / season / "rulers"
    for gid, gdate in sorted(new.items(), key=lambda g: (g[1], g[0])):
        through = day_before(gdate)
        if latest_json(rulers / through) is None:
            time.sleep(sleep)
            live_pulls.pull_ruler_snapshot(season, rulers, through=through,
                                           stamp=stamp, pull_date=pull_date)
            log(f"  ruler through {through} pulled")
        for side in pog.box_teams(gid, raw_root):
            out_dir = one_day_pull_dir(raw_root, side["teamTricode"], season)
            snap = latest_json(out_dir / gid)
            if snap is not None and pog.reconciles(read_json(snap)["_meta"], gid, side):
                continue
            time.sleep(sleep)
            snap = live_pulls.pull_team_game_snapshot(
                f"{side['teamCity']} {side['teamName']}", int(side["teamId"]), season,
                out_dir, game_id=gid, game_date=gdate, stamp=stamp, pull_date=pull_date)
            meta = read_json(snap)["_meta"]
            log(f"  {gid} {side['teamTricode']} one-day pull: {meta['shot_rows']} rows, "
                f"box FGA {pog.box_fga(side)}")
            if not pog.reconciles(meta, gid, side):
                lagging[gid] = (f"{side['teamTricode']} one-day pull has {meta['shot_rows']} "
                                f"rows for {meta['games_in_rows']}, box FGA {pog.box_fga(side)}")
    needed = set(new) - set(lagging)
    if needed:
        log_dir = raw_root / "_league" / season / "game-log"
        log_path = latest_json(log_dir)
        if log_path is None or needed - logged_games(log_path):
            time.sleep(sleep)
            log_path = live_pulls.pull_league_game_log_snapshot(
                season, log_dir, date_to=as_of, stamp=stamp, pull_date=pull_date)
            log(f"  league game log -> {log_path.name}")
        for gid in sorted(needed - logged_games(log_path)):
            lagging[gid] = "not yet in the league game log"
    return lagging


def db_export_games(args: argparse.Namespace, team: str, season: str,
                    universe: dict[str, str], raw_root: Path, out_dir: Path,
                    published_dir: Path, report: list[str]) -> list[str]:
    """The game step (ADR-0088/0091): load every universe game's sources
    (both one-day pulls, its pre-game ruler, the latest league game log),
    then export the game files and the season index into out_dir, each game
    checked against its published file. Identical bytes stay put, a game
    with no published file is written, and a published game whose bytes
    would change halts the session (a correction travels by PR). Returns the
    slugs of the games written."""
    guard_production_store(args)
    import export_game_payload as egp
    import load_hero_season as lhs
    import load_rulers as lr
    import load_team_games as ltg
    import record_store as rs

    rulers = raw_root / "_league" / season / "rulers"
    ruler_paths: list[Path] = []
    for through in sorted({day_before(d) for d in universe.values()}):
        path = latest_json(rulers / through)
        if path is None:
            raise Halt(f"no ruler on disk through {through} for a game inside the frontier")
        ruler_paths.append(path)
    pull_paths: list[Path] = []
    for gid in sorted(universe):
        for side in pog.box_teams(gid, raw_root):
            path = latest_json(one_day_pull_dir(raw_root, side["teamTricode"], season) / gid)
            if path is None:
                raise Halt(f"game {gid}: no one-day pull on disk for {side['teamTricode']}")
            pull_paths.append(path)
    log_path = latest_json(raw_root / "_league" / season / "game-log")
    if log_path is None:
        raise Halt(f"no league game log on disk for {season}")

    with rs.connect(rs.resolve_dsn(args.db_url)) as conn:
        rs.apply_migrations(conn)
        try:
            ltg.load_team_games(conn, pull_paths)
            lr.load_rulers(conn, ruler_paths, log_path)
        except lhs.LoadHalt as halt:
            raise Halt(f"record-store load halted: {halt}") from halt
        except SystemExit as exc:
            raise Halt(f"record-store load failed: {exc}") from exc
        report.append(f"game sources loaded: {len(pull_paths)} one-day pulls, "
                      f"{len(ruler_paths)} rulers, the league game log")
        try:
            counts = egp.export_season(conn, team, season, out_dir,
                                       published_dir=published_dir)
        except SystemExit as exc:
            raise Halt(f"game export failed: {exc}") from exc
    written = {p.stem for p in (out_dir / "games").glob("*.json")}
    slugs = [g["slug"] for g in read_json(out_dir / "index.json")["games"]
             if g["gameId"] in written]
    report.append(f"game export ok: {len(slugs)} new ({', '.join(slugs) or 'none'}), "
                  f"{counts['unchanged']} published and unchanged")
    return slugs


def changed_team_cards() -> list[str]:
    """Team share cards new or changed in the tree: the files under a team's
    subdirectory of public/social-cards/ (hero cards sit at its top level and
    never ride a data commit)."""
    paths = []
    status = run(f"git status --porcelain --untracked-files=all {CARDS_DIR}").stdout
    for line in status.splitlines():
        path = line[3:].strip().strip('"').replace("\\", "/")
        if path.startswith(CARDS_DIR) and "/" in path[len(CARDS_DIR):]:
            paths.append(path)
    return paths


def db_derive_team(args: argparse.Namespace, team: str, season: str,
                   shot_path: Path, roster_path: Path, universe: set[str],
                   out_path: Path, report: list[str]) -> None:
    """The team session's DB-engine derive (ADR-0080/0082): load the team
    shot + roster snapshots, load the universe's game pairs hero-free, then
    export the team shot payload with every oracle live (the per-player
    per-game box oracle refuses a game without its pair)."""
    guard_production_store(args)
    import export_ledger_facts as elf
    import export_team_shot_payload as etp
    import ledger_facts as lf
    import load_game_corpus as lgc
    import load_hero_season as lhs
    import load_team_season as lts
    import record_store as rs
    import team_payload as tp

    with rs.connect(rs.resolve_dsn(args.db_url)) as conn:
        rs.apply_migrations(conn)
        try:
            lts.load_team_season(conn, shot_path, roster_path)
            lgc.load_game_pairs(conn, universe, raw_root=REPO / "data" / "raw")
        except lhs.LoadHalt as halt:
            raise Halt(f"record-store load halted: {halt}") from halt
        except SystemExit as exc:
            raise Halt(f"record-store load failed: {exc}") from exc
        report.append("record-store team loads ok (change-detected, box oracle live)")
        try:
            payload = etp.export_payload(conn, team, season)
        except SystemExit as exc:
            raise Halt(f"team shot export failed: {exc}") from exc
        tp.write_payload(out_path, payload)
        report.append("team shot export ok (record store)")
        try:
            ledger = elf.export_ledger(conn, team, season, out_path)
        except SystemExit as exc:
            raise Halt(f"ledger export failed: {exc}") from exc
        lf.write_payload(out_path.parent / "ledger" / out_path.name, ledger)
        report.append("ledger export ok (record store)")


def run_team(entry: dict, args: argparse.Namespace) -> dict:
    """One team session: roster + discovery pulls, missing pairs, the pair
    frontier (no tracking coherence — no team tracking contract), each
    unpublished game's own sources (lag retreats the frontier), the anchored
    team pull, the derive, the frontier gate, the game export, and in live
    mode the sync -> cards -> full gate -> data commit. A tool surface
    renders from game one (ADR-0081), so 'gates' here means frontier
    exactness, never volume."""
    team, team_id, season = entry["team"], int(entry["teamId"]), entry["season"]
    tricode = entry["tricode"].lower()
    mode = entry.get("mode", "dark")
    slug = team_slug(entry)
    pull_date = date.today().isoformat()
    stamp = live_pulls.stamp_now()
    raw_root = REPO / "data" / "raw"
    team_root = raw_root / "_teams" / tricode / season
    published_dir = REPO / "public" / "data" / "_teams" / tricode / season
    report: list[str] = []
    status: dict = {"slug": slug, "team": team, "season": season, "mode": mode,
                    "session": f"{pull_date}{stamp}", "asOf": args.as_of}

    log(f"\n=== season loop (team): {team} {season} [{mode}]"
        f"{' as-of ' + args.as_of if args.as_of else ''} ===")
    if mode == "live" and args.engine != "db":
        raise Halt("a live team session publishes game payloads, which are born "
                   "DB-native (ADR-0088) — run it with --engine db")

    # 1. Roster (current state — the roster has no DateTo; under --as-of the
    #    replay still observes today's roster, and the payload says so).
    roster_path = live_pulls.pull_roster_snapshot(
        team, team_id, season, team_root / "roster", stamp=stamp, pull_date=pull_date)
    log(f"  roster -> {roster_path.name}")
    time.sleep(args.sleep)

    # 2. Discovery.
    discovery_path = live_pulls.pull_team_shot_snapshot(
        team, team_id, season, team_root,
        date_to=args.as_of, stamp=f"{stamp}-discovery", pull_date=pull_date)
    log(f"  discovery -> {discovery_path.name}")
    headers, rows = shot_rows(read_json(discovery_path))
    if not rows:
        status.update(outcome="no-data", note="season has no shots yet — nothing to derive")
        log("  no shots yet — clean no-op")
        return status
    gid_i, gd_i = headers.index("GAME_ID"), headers.index("GAME_DATE")
    games: dict[str, str] = {}
    for r in rows:
        d = str(r[gd_i])
        games[str(r[gid_i])] = f"{d[:4]}-{d[4:6]}-{d[6:]}"

    # 3. Fill missing pbp/box pairs — the one hard opening-night requirement.
    missing = sorted(g for g in games if not paired_game_exists(raw_root, g))
    if missing:
        log(f"  pulling {len(missing)} missing game pair(s)")
        run("python ingestion/pull_play_by_play.py --game-ids " + " ".join(missing),
            timeout=3600)
    paired = {g for g in games if paired_game_exists(raw_root, g)}

    # 4. Frontier candidate: pair availability (ADR-0058; no tracking to
    #    reconcile).
    candidate = candidate_frontier(games, paired)
    if candidate is None:
        status.update(outcome="deferred", deferred=True,
                      note="no game has a complete pair yet — frontier unset")
        log("  DEFERRED: no publishable frontier yet")
        return status

    deployed = REPO / "public" / "data" / "_teams" / tricode / f"{season}.json"
    deployed_index = published_dir / "index.json"
    prior_discoveries = sorted(p for p in team_root.glob("*-discovery.json")
                               if p != discovery_path)
    if (mode == "live" and not args.force and deployed.exists()
            and deployed_index.exists() and prior_discoveries):
        deployed_meta = read_json(deployed)["_meta"]
        _, prior_rows = shot_rows(read_json(prior_discoveries[-1]))
        pre_drop = deployed_meta["totalShots"] + deployed_meta["zoneConflictsDropped"]
        if (deployed_meta["dataThrough"] == candidate
                and read_json(deployed_index)["_meta"]["dataThrough"] == candidate
                and pre_drop == len(rows) and prior_rows == rows):
            status.update(outcome="no-change", frontier=candidate,
                          note="upstream identical to previous session; "
                               "deployed already at the candidate frontier")
            log("  no change upstream — session ends before anchored pulls")
            return status

    # 5. Each unpublished game's own sources (ADR-0091). A source that lags
    #    defers its game, and the frontier, being whole dates, stops before it.
    lagging: dict[str, str] = {}
    if args.engine == "db":
        new = unpublished_games(games, paired, candidate, published_dir)
        if new:
            log(f"  sourcing {len(new)} unpublished game(s)")
            lagging = ensure_game_sources(new, season, raw_root, as_of=args.as_of,
                                          stamp=stamp, pull_date=pull_date,
                                          sleep=args.sleep)
        for gid, why in sorted(lagging.items()):
            report.append(f"game {gid} ({games[gid]}) deferred: {why}")
        if lagging:
            status["lagging"] = lagging  # the status file says why, published or not
    frontier = candidate_frontier(games, paired - set(lagging))
    if frontier is None:
        status.update(outcome="deferred", deferred=True, candidate=candidate,
                      note="no game's sources are complete yet — frontier unset")
        log("  DEFERRED: no game's sources are complete yet")
        return status
    deferred = len(paired) < len(games) or frontier != candidate
    status.update(frontier=frontier, candidate=candidate, deferred=deferred)
    report.append(f"frontier {frontier}"
                  + (f" (candidate {candidate})" if frontier != candidate else "")
                  + (" — deferred games pending upstream" if deferred else ""))
    if deferred:
        prior = consecutive_deferrals(STATUS_DIR, slug, season)
        if prior + 1 >= STUCK_SESSIONS:
            status["stuckAlarm"] = True
            report.append(f"!! STALENESS ALARM: games deferred behind the candidate for "
                          f"{prior + 1} consecutive sessions (ADR-0058)")

    # 6. The anchored team pull at the settled frontier.
    max_disc_date = max(games.values())
    if frontier == max_disc_date and (args.as_of is None or args.as_of == frontier):
        shot_path = discovery_path
    else:
        time.sleep(args.sleep)
        shot_path = live_pulls.pull_team_shot_snapshot(
            team, team_id, season, team_root,
            date_to=frontier, stamp=f"{stamp}-frontier", pull_date=pull_date)

    # 7. Derive — the record store (production) or the file derive (fallback);
    #    same derived path either way, so sync and gates are engine-blind.
    derived = REPO / "data" / "derived" / "_teams" / tricode / season
    out_path = derived / f"{pull_date}{stamp}.json"
    universe = {gid for gid, gd in games.items() if gd <= frontier}
    if args.engine == "db":
        db_derive_team(args, team, season, shot_path, roster_path, universe, out_path, report)
    else:
        result = run("python ingestion/derive_team_payload.py "
                     f"--snapshot-file \"{shot_path}\" --roster-file \"{roster_path}\" "
                     f"--out-file \"{out_path}\"")
        if result.returncode != 0:
            raise Halt(f"team derive failed:\n{result.stdout}\n{result.stderr}")
        report.append("team shot derive ok (files)")
        result = run("python ingestion/derive_ledger_facts.py "
                     f"--team-payload-file \"{out_path}\" "
                     f"--out-file \"{out_path.parent / 'ledger' / out_path.name}\"")
        if result.returncode != 0:
            raise Halt(f"ledger derive failed:\n{result.stdout}\n{result.stderr}")
        report.append("ledger derive ok (files)")

    # 8. The frontier gate: the payload states exactly the settled frontier.
    meta = read_json(out_path)["_meta"]
    frontier_ok = (meta["dataThrough"] == frontier
                   and meta["gamesIncluded"] == len(universe))
    if not frontier_ok:
        raise Halt(f"team payload frontier {meta['dataThrough']} / "
                   f"{meta['gamesIncluded']} games != settled {frontier} / "
                   f"{len(universe)} games — contradiction")
    status["gates"] = {"frontierExact": True, "pass": not deferred}
    report.append(f"team payload: {meta['totalShots']} shots, {meta['gamesIncluded']} "
                  f"games through {meta['dataThrough']}, "
                  f"{meta['zoneConflictsDropped']} conflict(s) dropped")

    # 9. The game files and the season index (ADR-0088), into data/derived
    #    beside the team payload, checked against the published files. Born
    #    DB-native, so the files engine (dark only, above) skips them.
    new_slugs: list[str] = []
    if args.engine == "db":
        new_slugs = db_export_games(
            args, team, season, {gid: games[gid] for gid in universe}, raw_root,
            derived / "games" / out_path.stem, published_dir, report)
    else:
        report.append("game payloads skipped: born DB-native (ADR-0088)")
    status["newGames"] = new_slugs

    if mode == "dark":
        status.update(outcome="dark")
        log("  dark mode: derived + reported, publishing nothing")
        return status

    # 10. Publish (live mode): sync -> share cards -> full gate -> a data
    #     commit on green (ADR-0057, as amended by ADR-0091).
    if not args.no_commit:
        guard_publish()
    result = run(f"npm run team:sync -- {tricode} {season}")
    if result.returncode != 0:
        raise Halt(f"team:sync failed:\n{result.stdout}\n{result.stderr}")
    # Every published game missing its card: the new games', plus any a
    # halted session left undrawn. Drawn from committed files only.
    result = run("npm run cards:games -- --missing")
    if result.returncode != 0:
        raise Halt(f"cards:games failed:\n{result.stdout}\n{result.stderr}")
    run_gate()
    report.append("full gate green")

    deployed_dir = f"public/data/_teams/{tricode}/"
    cards = changed_team_cards()
    if cards:
        report.append(f"share cards: {', '.join(Path(c).stem for c in cards)}")
    if not run(f"git status --porcelain {deployed_dir}").stdout.strip() and not cards:
        status.update(outcome="no-change")
        report.append("deployed team payloads unchanged — nothing to commit")
        log("  no change — nothing to commit")
        return status
    if args.no_commit:
        status.update(outcome="dry-run", wouldCommit=True)
        log("  --no-commit: gate green, commit skipped")
        return status
    msg_file = STATUS_DIR / f"commit-msg-{slug}.txt"
    msg_file.parent.mkdir(parents=True, exist_ok=True)
    msg_file.write_text(
        build_commit_message(slug, season, frontier, len(universe), len(new_slugs), report),
        encoding="utf-8")
    adds = [f"git add {deployed_dir}"] + ([f"git add -- {' '.join(cards)}"] if cards else [])
    for cmd in (*adds, f"git commit -F \"{msg_file}\""):
        result = run(cmd)
        if result.returncode != 0:
            raise Halt(f"git step failed:\n[{cmd}]\n{result.stderr}")
    if not args.no_push:
        result = run("git push")
        if result.returncode != 0:
            raise Halt(f"git push failed (commit is local):\n{result.stderr}")
    status.update(outcome="published", pushed=not args.no_push)
    log(f"  published through {frontier}")
    return status


if __name__ == "__main__":
    main()
