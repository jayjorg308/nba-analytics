"""The replay proof (v3 Phase 4, ADR-0058): drive the REAL season loop over a
calendar of historical frontier dates against a completed season, and hold it
to oracles no simulation could fake.

WHY THIS IS HONEST: `season_update.py --as-of <date>` anchors the entire
session — discovery included — at a historical date, and the endpoints
compute the as-of slices themselves (the DateTo exactness the Phase 0 spike
proved). Real data, real endpoints, the production loop's own code path end
to end; the only fiction is the calendar.

THE ORACLES, per replay day:
  1. The session completes with no halt (every derive oracle live).
  2. The frontier settles exactly on the last hero game date at or before
     the as-of date — computed independently here from the COMMITTED
     deployed payload, never from the loop's own output.
  3. Nothing defers (the corpus is fully committed, tracking is settled).
  4. The five-gate evaluation matches the expectation computed from the
     committed rows — including the exact gate-pass boundary day (the
     ADR-0059 flip signal fires on the right morning, and not one earlier).
TERMINAL ORACLE (the exit condition of v3):
  5. On the season's final date, the replay's four derived payloads equal
     the committed deployed payloads EXACTLY, modulo provenance fields
     (pull dates and source paths — nothing else may differ by a byte).

Replay sessions run in dark mode (they derive and report, publish nothing);
their stamped derived outputs are deleted at the end so "latest derived"
stays canonical. Raw snapshots stay — the raw layer is append-only.

USAGE (local-only, like every pull):
  python ingestion/season_replay.py                      # Cody, auto calendar
  python ingestion/season_replay.py --dates 2026-01-15 2026-04-12
"""

from __future__ import annotations

import argparse
import copy
import json
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
STATUS_DIR = REPO / "data" / "season-loop"

EVAL_ZONES = [
    "Restricted Area", "In The Paint (Non-RA)", "Mid-Range",
    "Left Corner 3", "Right Corner 3", "Above the Break 3",
]
ZONE_INCLUSION_MIN_ATTEMPTS = 15

# Provenance: the fields a replay derive legitimately stamps differently
# (pull dates, source paths). EVERYTHING else must match byte-for-byte.
PROVENANCE_KEYS = {
    "pullDate", "sourceSnapshot", "leagueSourceSnapshot",
    "sourceShotPayload", "sourceLeagueTotals", "leagueTotalsPullDate",
}

failures: list[str] = []


def check(name: str, ok: bool, detail: str) -> None:
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}: {detail}", flush=True)
    if not ok:
        failures.append(f"{name}: {detail}")


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def strip_provenance(payload: dict) -> dict:
    slim = copy.deepcopy(payload)
    slim["_meta"] = {k: v for k, v in slim["_meta"].items()
                     if k not in PROVENANCE_KEYS}
    return slim


def expected_truths(deployed_shot: dict) -> tuple[list[str], str]:
    """Game dates and the expected gate-pass date, from the committed rows —
    the truth the loop is graded against, never derived from the loop."""
    by_date: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for s in deployed_shot["shots"]:
        by_date[s["gameDate"]][s["zoneBasic"]] += 1
    dates = sorted(by_date)
    cum: dict[str, int] = defaultdict(int)
    gate_pass = None
    for d in dates:
        for zone, n in by_date[d].items():
            cum[zone] += n
        if gate_pass is None and all(
            cum[z] >= ZONE_INCLUSION_MIN_ATTEMPTS for z in EVAL_ZONES
        ):
            gate_pass = d
    if gate_pass is None:
        sys.exit("season never passes Gate 2 — not a replayable subject")
    return dates, gate_pass


def auto_calendar(dates: list[str], gate_pass: str) -> list[str]:
    """Early date, the boundary pair, monthly game dates after, the finale."""
    boundary_i = dates.index(gate_pass)
    calendar = {dates[min(9, boundary_i)], dates[boundary_i - 1], gate_pass,
                dates[-1]}
    seen_months = set()
    for d in dates:
        month = d[:7]
        if d > gate_pass and month not in seen_months:
            seen_months.add(month)
            calendar.add(d)
    return sorted(calendar)


def latest_status(slug: str, season: str) -> dict:
    files = sorted(STATUS_DIR.glob(f"*-{slug}-{season}.json"),
                   key=lambda p: p.stat().st_mtime)
    if not files:
        sys.exit("no status file written — the loop did not run")
    return read_json(files[-1])


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Replay the season loop (Phase 4).")
    ap.add_argument("--slug", default="cody-williams")
    ap.add_argument("--season", default="2025-26")
    ap.add_argument("--dates", nargs="*",
                    help="explicit ISO replay dates (default: auto calendar)")
    ap.add_argument("--sleep", type=float, default=1.5)
    args = ap.parse_args()

    deployed_dir = REPO / "public" / "data" / args.slug
    deployed_shot = read_json(deployed_dir / f"{args.season}.json")
    player = deployed_shot["_meta"]["player"]
    player_id = deployed_shot["_meta"]["playerId"]
    game_dates, gate_pass = expected_truths(deployed_shot)
    calendar = sorted(args.dates) if args.dates else auto_calendar(game_dates, gate_pass)
    print(f"replay: {player} {args.season} · {len(calendar)} dates · "
          f"expected gate-pass {gate_pass} · finale {game_dates[-1]}")
    print(f"calendar: {', '.join(calendar)}")

    # The replay config: the subject in dark mode (derive + report, publish
    # nothing), pins carried over from the real config so a pinned subject
    # (e.g. Ace) replays through its outages the way live operation would.
    real_config = read_json(REPO / "season.config.json")
    replay_config = {
        "liveSeasons": [{"slug": args.slug, "player": player,
                         "playerId": player_id, "season": args.season,
                         "mode": "dark"}],
        "trackingShortfalls": real_config.get("trackingShortfalls", {}),
    }
    STATUS_DIR.mkdir(parents=True, exist_ok=True)
    config_path = STATUS_DIR / f"replay-config-{args.slug}.json"
    config_path.write_text(json.dumps(replay_config, indent=2), encoding="utf-8")

    derived_root = REPO / "data" / "derived" / args.slug / args.season
    replay_outputs: list[Path] = []
    first_flip_ready: str | None = None

    for as_of in calendar:
        expected_frontier = max((d for d in game_dates if d <= as_of),
                                default=None)
        print(f"\n=== replay day {as_of} (expect frontier {expected_frontier}) ===",
              flush=True)
        result = subprocess.run(
            f'python ingestion/season_update.py --config "{config_path}" '
            f'--slug {args.slug} --as-of {as_of} --sleep {args.sleep}',
            cwd=REPO, shell=True, capture_output=True, text=True, timeout=1800)
        sys.stdout.write(result.stdout)
        check("no halt", result.returncode == 0,
              f"exit {result.returncode}"
              + (f"\n{result.stdout[-2000:]}\n{result.stderr[-2000:]}"
                 if result.returncode else ""))
        if result.returncode != 0:
            continue
        status = latest_status(args.slug, args.season)
        session = status.get("session", "")
        for sub in ("", "creation", "shot-context", "freethrow"):
            replay_outputs.append(
                derived_root / sub / f"{session}.json" if sub
                else derived_root / f"{session}.json")

        check("frontier exact", status.get("frontier") == expected_frontier,
              f"loop {status.get('frontier')} vs truth {expected_frontier}")
        check("not deferred", status.get("deferred") is False,
              f"deferred={status.get('deferred')}")
        expect_pass = expected_frontier >= gate_pass
        actual_pass = bool(status.get("gates", {}).get("pass"))
        check("gates match truth", actual_pass == expect_pass,
              f"loop {actual_pass} vs truth {expect_pass} "
              f"(failing: {status.get('gates', {}).get('volumeFailing')})")
        if actual_pass and first_flip_ready is None:
            first_flip_ready = as_of

        # Terminal oracle: the final frame IS the committed deployment.
        if as_of == game_dates[-1]:
            print("  --- terminal oracle: replay frame vs committed payloads ---")
            pairs = [("", f"{args.season}.json"),
                     ("creation", f"{args.season}.creation.json"),
                     ("shot-context", f"{args.season}.context.json"),
                     ("freethrow", f"{args.season}.freethrow.json")]
            for sub, deployed_name in pairs:
                replay_path = (derived_root / sub / f"{session}.json" if sub
                               else derived_root / f"{session}.json")
                replayed = strip_provenance(read_json(replay_path))
                committed = strip_provenance(read_json(deployed_dir / deployed_name))
                check(f"terminal {deployed_name}", replayed == committed,
                      "byte-equal modulo provenance" if replayed == committed
                      else "DIFFERS beyond provenance")

    check("flip signal on the boundary day", first_flip_ready == gate_pass,
          f"first GATES PASS {first_flip_ready} vs truth {gate_pass}")

    # Cleanup: replay derived outputs go away so 'latest derived' stays
    # canonical; raw snapshots stay (append-only layer).
    removed = 0
    for p in replay_outputs:
        if p.exists():
            p.unlink()
            removed += 1
    print(f"\ncleanup: removed {removed} replay derived files")

    if failures:
        print(f"\nREPLAY VERDICT: {len(failures)} FAILURE(S)")
        for f in failures:
            print(f"  - {f.splitlines()[0]}")
        sys.exit(1)
    print("\nREPLAY VERDICT: every oracle exact — the season loop reproduces "
          "the committed season from live machinery (v3 Phase 4 complete).")


if __name__ == "__main__":
    main()
