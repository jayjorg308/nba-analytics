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

LOCAL-ONLY: stats.nba.com blocks cloud IPs. Run on the dev machine, via
scripts/season-update.ps1 under Task Scheduler for the daily cadence.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import date, datetime
from pathlib import Path

import live_pulls

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

def run(cmd: str, *, cwd: Path = REPO, timeout: int = 1800) -> subprocess.CompletedProcess:
    log(f"  $ {cmd}")
    return subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True,
                          text=True, timeout=timeout)


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
    league_tracking_path = live_pulls.pull_league_tracking_snapshot(
        season, raw_root / "_league" / season / "tracking",
        date_to=frontier, stamp=stamp, pull_date=pull_date, sleep=args.sleep)

    # 5. The four derives — every oracle is live; a failure is a halt.
    derived = REPO / "data" / "derived" / slug / season
    out = f"{pull_date}{stamp}.json"
    steps = [
        ("shot", f"python ingestion/derive_payload.py "
                 f"--snapshot-file \"{shot_path}\" --out-file \"{derived / out}\""),
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
    result = run(f"npm run hero:sync -- {slug} {season}")
    if result.returncode != 0:
        raise Halt(f"hero:sync failed:\n{result.stdout}\n{result.stderr}")
    gate_cmds = ["python -m pytest ingestion -q", "npm test",
                 "npm run lint", "npm run build"]
    for cmd in gate_cmds:
        result = run(cmd)
        if result.returncode != 0:
            raise Halt(f"gate red — publish halted (nothing ships until a "
                       f"human acts; a broken verdict guard means rewrite "
                       f"copy + mapping together):\n[{cmd}]\n"
                       f"{result.stdout[-4000:]}\n{result.stderr[-4000:]}")
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
    ap.add_argument("--slug", help="run one live season only")
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
    ap.add_argument("--sleep", type=float, default=1.5)
    args = ap.parse_args()

    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    entries = [e for e in config["liveSeasons"]
               if args.slug is None or e["slug"] == args.slug]
    if not entries:
        sys.exit(f"no live seasons matched (slug={args.slug!r}) in {args.config}")
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
    sys.exit(1 if halted else 0)


if __name__ == "__main__":
    main()
