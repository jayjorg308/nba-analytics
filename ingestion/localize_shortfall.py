"""Localize a hero-season's tracking shortfall to its outage games (ADR-0072).

WHAT THIS IS: the characterization step the shortfall pins require. The
tracking dashboards are season-aggregate — no GAME_ID anywhere — so a
shortfall's per-game attribution cannot be read off any snapshot. But the
endpoint respects DateTo (the season loop's coherence-check mechanics,
live_pulls.py / ADR-0058), so the cumulative shortfall through date X —
official pre-drop FGA through X minus the tracking General family's Σ FGA
through X — is a non-decreasing step function over the hero's game dates.
Bisection finds every step in ~log2(games) pulls per outage game instead of
one pull per game.

Official cumulative FGA comes from the latest raw shot snapshot (per-shot
rows carry GAME_DATE/GAME_ID); the target is the PRE-drop total, the same
denominator the General identity is stated against (ADR-0030).

Output is the per-game pin candidate for `season.config.json`'s
trackingShortfalls registry. The pin itself still travels by PR with the
evidence recorded in the _readme (ADR-0058, as amended) — this tool
produces the characterization, it never writes the config.

SNAPSHOTS: investigation pulls land in `tracking/investigation/`, a
subdirectory on purpose — derive_creation treats the lexicographically last
`*.json` in the flat `tracking/` dir as the latest real snapshot, so a
stamped investigation file there would hijack every later derive. Existing
investigation snapshots are reused instead of re-pulled (append-only holds,
and a rerun or a second hero on the same night is free where it overlaps).

LOCAL-ONLY (guardrail): stats.nba.com blocks cloud/data-center IPs. Run on
your own machine — never from CI or the deployed app.

USAGE:
  python ingestion/localize_shortfall.py --slug alex-sarr --season 2025-26
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from live_pulls import pull_tracking_snapshot  # noqa: E402

SLEEP = 1.5


def deployed_meta(slug: str, season: str) -> dict:
    """Player identity from the deployed shot payload — no hardcoded ids."""
    payload = Path("public/data") / slug / f"{season}.json"
    if not payload.exists():
        sys.exit(f"no deployed shot payload at {payload} — run the derives + hero:sync first")
    return json.loads(payload.read_text(encoding="utf-8"))["_meta"]


def shot_rows(slug: str, season: str) -> tuple[list[str], list[list]]:
    """The latest raw shot snapshot's per-shot rows (GAME_DATE/GAME_ID grain)."""
    snaps = sorted((Path("data/raw") / slug / season).glob("*.json"))
    if not snaps:
        sys.exit(f"no raw shot snapshot under data/raw/{slug}/{season} — local data required")
    raw = json.loads(snaps[-1].read_text(encoding="utf-8"))
    for rs in raw["response"]["resultSets"]:
        h = rs["headers"]
        if "GAME_DATE" in h and "GAME_ID" in h:
            return h, rs["rowSet"]
    sys.exit("no shot rows with GAME_DATE/GAME_ID in the raw snapshot")


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Bisect DateTo-anchored tracking pulls to localize a shortfall.")
    ap.add_argument("--slug", required=True)
    ap.add_argument("--season", default="2025-26")
    ap.add_argument("--sleep", type=float, default=SLEEP)
    args = ap.parse_args()

    meta = deployed_meta(args.slug, args.season)
    player, player_id = meta["player"], int(meta["playerId"])
    headers, rows = shot_rows(args.slug, args.season)
    di, gi = headers.index("GAME_DATE"), headers.index("GAME_ID")

    per_game: dict[str, int] = {}
    game_ids: dict[str, str] = {}
    for row in rows:
        d = str(row[di])
        iso = f"{d[:4]}-{d[4:6]}-{d[6:]}"
        per_game[iso] = per_game.get(iso, 0) + 1
        game_ids[iso] = str(row[gi])

    dates = sorted(per_game)
    cum: dict[str, int] = {}
    running = 0
    for d in dates:
        running += per_game[d]
        cum[d] = running
    print(f"{player}: {len(dates)} game dates, {running} official pre-drop FGA "
          f"({dates[0]} .. {dates[-1]})")

    inv_dir = Path("data/raw") / args.slug / args.season / "tracking" / "investigation"
    pull_date = date.today().isoformat()
    cache: dict[str, int] = {}
    pulls = 0

    def general_fga_through(iso: str) -> int:
        """Anchored General Σ through a date — cached, then reused from any
        prior investigation snapshot, then pulled."""
        nonlocal pulls
        if iso in cache:
            return cache[iso]
        existing = sorted(inv_dir.glob(f"*invest-to-{iso}.json"))
        if existing:
            raw = json.loads(existing[-1].read_text(encoding="utf-8"))
        else:
            time.sleep(args.sleep)
            pulls += 1
            path = pull_tracking_snapshot(
                player, player_id, args.season, inv_dir,
                date_to=iso, stamp=f"-invest-to-{iso}", pull_date=pull_date,
            )
            raw = json.loads(path.read_text(encoding="utf-8"))
        total = 0
        for rs in raw["response"]["resultSets"]:
            if rs["name"] == "GeneralShooting":
                fi = rs["headers"].index("FGA")
                total = sum(int(r[fi]) for r in rs["rowSet"])
        cache[iso] = total
        return total

    def shortfall_at(idx: int) -> int:
        d = dates[idx]
        s = cum[d] - general_fga_through(d)
        print(f"  f({d}) = {cum[d]} official − {cache[d]} tracking = {s}"
              f"   [{pulls} pulls]")
        return s

    total = shortfall_at(len(dates) - 1)
    print(f"season shortfall: {total}")
    if total == 0:
        print("nothing to localize — if a pin exists for this hero-season, the "
              "source may have healed under it (the coherence halt case, ADR-0058)")
        return
    if total < 0:
        sys.exit("NEGATIVE shortfall: tracking exceeds the official record — "
                 "contradiction, never outage (ADR-0030); investigate the sources")

    # Every step of the non-decreasing function f is one outage game.
    steps: list[tuple[str, int]] = []

    def bisect(lo: int, lo_val: int, hi: int, hi_val: int) -> None:
        """Invariant: f(lo)=lo_val < f(hi)=hi_val; find all steps in (lo, hi]."""
        if hi - lo == 1:
            steps.append((dates[hi], hi_val - lo_val))
            return
        mid = (lo + hi) // 2
        mid_val = shortfall_at(mid)
        if mid_val > lo_val:
            bisect(lo, lo_val, mid, mid_val)
        if hi_val > mid_val:
            bisect(mid, mid_val, hi, hi_val)

    first_val = shortfall_at(0)
    if first_val > 0:
        steps.append((dates[0], first_val))
    if total > first_val:
        bisect(0, first_val, len(dates) - 1, total)

    print(f"\n{'=' * 62}")
    print(f"LOCALIZED in {pulls} pulls:")
    attributed = 0
    for d, n in sorted(steps):
        attributed += n
        print(f"  {d}  game {game_ids[d]}  missing {n} of {per_game[d]} attempts")
    print(f"  Σ attributed = {attributed} (season shortfall {total})")
    if attributed != total:
        sys.exit("attribution does not sum to the season shortfall — do not pin; investigate")
    print("\nseason.config.json trackingShortfalls candidate (pin travels by PR "
          "with its evidence in the _readme — ADR-0058/0072):")
    pins = {game_ids[d]: n for d, n in sorted(steps)}
    print(json.dumps({f"{args.slug}/{args.season}": pins}, indent=2))


if __name__ == "__main__":
    main()
