"""One-command hero add: player name + season -> a scaffolded, data-complete add.

THE STANDING ADD RECIPE, ORCHESTRATED (ADR-0066; the ADR-0063/0065
boundaries): this chains the commands a hero add has always run by hand, in
dependency order —

  1. pull_shots            (raw shot snapshot + gate report)
  2. pull_tracking         (raw tracking snapshot; league baseline if absent)
  3. pull_league_totals    (Gate 5 oracle + usage-source artifacts, if absent)
  4. derive_payload        (first contract; the game-id discovery source)
  5. pull_play_by_play     (only the corpus's MISSING games, via --game-ids —
                            the "pre-deploy hero-add path" that flag names)
  6. derive_creation / derive_shot_context / derive_freethrow
  7. hero:scaffold         (module + guard skeleton + registry entry, ADR-0063)
  8. headshot download     (the ADR-0065 formula — a mechanical asset,
                            "a headshot needs no authoring")
  9. cards:generate        (the hero's share card, from committed assets —
                            ADR-0067; mechanical, like the headshot)
 10. hero:sync             (deploy all four payloads)
 11. hero:report --deployed (the authoring input: the story + claim headroom)

WHAT THIS NEVER DOES (the ADR-0063 boundary — structure, never judgment):
after a successful run the suite is RED ON PURPOSE via the authoring
tripwire, until a human authors the verdict, kicker, alt text, and focal
points, declares the guard claims, and lands the banner photo. The closing
checklist names exactly that remaining work.

RESUMABLE BY CONSTRUCTION: raw pulls are append-only and skipped when their
snapshots exist; play-by-play pulls only games the shared corpus lacks;
derives recompute freely (the regenerable layer); the scaffold is skipped
once its guard file exists; the headshot is skipped once committed.
Rerunning after a failure continues where it left off.

LOCAL ONLY: chains stats.nba.com pulls (blocks cloud IPs) — a dev machine,
never CI or the deployed app. For COMPLETED seasons (the standing add
recipe); a living season belongs to the season loop (ADR-0057).

Usage:
  npm run hero:add -- "Donovan Mitchell" 2025-26
  python ingestion/hero_add.py "Donovan Mitchell" 2025-26
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

# Reuse the corpus's own pair/orphan check — one source of truth for what
# "this game is already pulled" means (a half-pair must halt, never skip).
from pull_play_by_play import paired_snapshot_exists

REPO = Path(__file__).resolve().parents[1]
SEASON_PATTERN = re.compile(r"^\d{4}-\d{2}$")

# The ADR-0065 headshot formula: the standard NBA headshot for a player id,
# a transparent-background PNG on the league CDN.
HEADSHOT_URL = "https://cdn.nba.com/headshots/nba/latest/1040x760/{player_id}.png"

# cdn.nba.com's edge hangs non-browser TLS fingerprints: python-requests read-
# times-out on every attempt while curl succeeds immediately (observed
# 2026-07-27). Prefer the system curl; requests is the fallback path.
BROWSER_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")


def slug_of(player_name: str) -> str:
    """The one slug rule, shared with every pull/derive script."""
    return player_name.lower().replace(" ", "-")


def game_ids_of(shot_payload: dict) -> list[str]:
    """Sorted unique game ids across a derived shot payload's rows."""
    return sorted({str(shot["gameId"]) for shot in shot_payload.get("shots", [])})


def missing_game_ids(ids: list[str], raw_root: Path) -> list[str]:
    """Games with no complete play-by-play/box pair in the shared corpus."""
    return [gid for gid in ids if not paired_snapshot_exists(raw_root, gid)]


def latest_json(directory: Path) -> Path | None:
    """Latest dated artifact in a directory (ISO names sort lexically)."""
    candidates = sorted(p for p in directory.glob("*.json") if p.is_file())
    return candidates[-1] if candidates else None


def step(index: int, total: int, title: str) -> None:
    print(f"\n=== [{index:>2}/{total}] {title} ".ljust(70, "=") + "\n", flush=True)


def run(cmd: list[str], resume_hint: str) -> None:
    """Run a child inheriting stdio; a failure halts loudly and names the fix."""
    print(f"$ {' '.join(cmd)}", flush=True)
    result = subprocess.run(cmd, cwd=REPO)
    if result.returncode != 0:
        sys.exit(
            f"\nstep failed (exit {result.returncode}): {' '.join(cmd)}\n"
            f"{resume_hint}\n"
            "Fix the cause and rerun hero:add — completed steps are skipped."
        )


def npm() -> str:
    path = shutil.which("npm")
    if path is None:
        sys.exit("npm not found on PATH — hero:add chains npm run scripts.")
    return path


def download_headshot(player_id: int, dest: Path, retries: int = 3) -> None:
    url = HEADSHOT_URL.format(player_id=player_id)
    by_hand = f"fetch it by hand to {dest} and rerun hero:add."
    dest.parent.mkdir(parents=True, exist_ok=True)

    curl = shutil.which("curl")
    if curl is not None:
        print(f"GET {url}  (curl)")
        result = subprocess.run(
            [curl, "-sS", "--fail", "--max-time", "60", "-A", BROWSER_UA,
             "-H", "Referer: https://www.nba.com/", "-o", str(dest), url])
        if (result.returncode == 0 and dest.exists()
                and dest.read_bytes().startswith(b"\x89PNG")):
            print(f"saved headshot -> {dest} ({dest.stat().st_size:,} bytes)")
            return
        dest.unlink(missing_ok=True)
        print("curl fetch failed — falling back to python requests")

    import time

    import requests  # nba_api dependency; present wherever the pulls run

    response = None
    for attempt in range(1, retries + 1):
        print(f"GET {url}" + (f"  (attempt {attempt}/{retries})" if attempt > 1 else ""))
        try:
            response = requests.get(
                url, timeout=60,
                headers={"User-Agent": BROWSER_UA, "Referer": "https://www.nba.com/"},
            )
            break
        except requests.RequestException as exc:
            if attempt == retries:
                sys.exit(f"headshot download failed after {retries} attempts "
                         f"({exc}) — {by_hand}")
            time.sleep(2 * attempt)
    assert response is not None  # the loop either broke with one or exited
    if response.status_code != 200:
        sys.exit(f"headshot download failed (HTTP {response.status_code}) — {by_hand}")
    if not response.content.startswith(b"\x89PNG"):
        sys.exit(f"headshot response is not a PNG — {by_hand}")
    dest.write_bytes(response.content)
    print(f"saved headshot -> {dest} ({len(response.content):,} bytes)")


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # Windows cp1252 guard

    ap = argparse.ArgumentParser(
        description="Orchestrate the standing hero-add recipe for one season."
    )
    ap.add_argument("player", help='full player name, e.g. "Donovan Mitchell"')
    ap.add_argument("season", help="completed season, e.g. 2025-26")
    ap.add_argument("--raw-root", default="data/raw")
    ap.add_argument("--derived-root", default="data/derived")
    args = ap.parse_args()

    if not SEASON_PATTERN.match(args.season):
        sys.exit(f"invalid season {args.season!r} — expected e.g. 2025-26")

    player, season = args.player, args.season
    slug = slug_of(player)
    raw_root = REPO / args.raw_root
    python = sys.executable
    total = 11

    print(f"hero:add  {player} ({slug})  {season}")

    # -- 1: raw shot snapshot (append-only; skip when one exists) --------------
    step(1, total, "shot snapshot (pull_shots)")
    if latest_json(raw_root / slug / season):
        print("snapshot exists — skip")
    else:
        run([python, "ingestion/pull_shots.py", "--player", player,
             "--seasons", season],
            "The shot pull is append-only; nothing to clean up.")

    # -- 2: raw tracking snapshot (player; league baseline only if absent) -----
    step(2, total, "tracking snapshot (pull_tracking)")
    if latest_json(raw_root / slug / season / "tracking"):
        print("tracking snapshot exists — skip")
    else:
        cmd = [python, "ingestion/pull_tracking.py", "--players", player,
               "--season", season]
        if latest_json(raw_root / "_league" / season / "tracking"):
            cmd.append("--skip-league")
        run(cmd, "The tracking pull is append-only; nothing to clean up.")

    # -- 3: league season artifacts (Gate 5 oracle + usage source) -------------
    step(3, total, "league totals + advanced (pull_league_totals)")
    if latest_json(raw_root / "_league" / season / "totals") and latest_json(
        raw_root / "_league" / season / "advanced"
    ):
        print("league totals + advanced artifacts exist — skip")
    else:
        # The script skips whichever class the season already has (per-class
        # append-only guards), so this pulls only what is missing.
        run([python, "ingestion/pull_league_totals.py", "--season", season],
            "The league pulls are append-only; nothing to clean up.")

    # -- 4: derive the shot payload (also the game-id discovery source) --------
    step(4, total, "derive shot payload (derive_payload)")
    run([python, "ingestion/derive_payload.py", "--player", player,
         "--season", season],
        "Derives recompute freely from the latest snapshot.")
    shot_payload_path = latest_json(REPO / args.derived_root / slug / season)
    if shot_payload_path is None:
        sys.exit(f"derive reported success but no payload under "
                 f"{args.derived_root}/{slug}/{season}")
    shot_payload = json.loads(shot_payload_path.read_text(encoding="utf-8"))
    meta = shot_payload["_meta"]
    if meta["season"] != season:
        sys.exit(f"derived payload is {meta['season']}, not {season}")
    player_id = int(meta["playerId"])

    # -- 5: complete the shared play-by-play corpus (Gates 4/5 raw input) ------
    step(5, total, "play-by-play corpus (pull_play_by_play --game-ids)")
    ids = game_ids_of(shot_payload)
    missing = missing_game_ids(ids, raw_root)
    print(f"{len(ids)} games in the season; {len(missing)} missing from the corpus")
    if missing:
        run([python, "ingestion/pull_play_by_play.py", "--game-ids", *missing],
            "Game pulls are append-only pairs; the rerun pulls only what is "
            "still missing.")
    else:
        print("corpus already complete — skip")

    # -- 6-7-8: the three sibling derives --------------------------------------
    step(6, total, "derive creation payload (derive_creation)")
    run([python, "ingestion/derive_creation.py", "--player", player,
         "--season", season],
        "Derives recompute freely from the latest snapshots.")

    step(7, total, "derive shot-context payload (derive_shot_context)")
    run([python, "ingestion/derive_shot_context.py",
         "--shot-payload-file", str(shot_payload_path)],
        "Derives recompute freely from the corpus.")

    step(8, total, "derive free-throw payload (derive_freethrow)")
    run([python, "ingestion/derive_freethrow.py",
         "--shot-payload-file", str(shot_payload_path)],
        "Derives recompute freely from the corpus.")

    # -- 9: scaffold + headshot (the mechanical authoring surface) -------------
    step(9, total, "scaffold + headshot (hero:scaffold, ADR-0063/0065)")
    guard_path = REPO / "src" / "heroes" / f"{slug}.{season}.guard.test.ts"
    if guard_path.exists():
        print(f"{guard_path.name} exists — scaffold already ran, skip")
    else:
        run([npm(), "run", "hero:scaffold", "--", slug, season],
            "The scaffold never overwrites; resolve its refusal and rerun.")
    headshot_path = REPO / "public" / "img" / f"{slug}-headshot.png"
    if headshot_path.exists():
        print(f"{headshot_path.name} exists — skip download")
    else:
        download_headshot(player_id, headshot_path)

    # -- 10: the share card (ADR-0067; registry-driven, so after scaffold) -----
    step(10, total, "share card (cards:generate, ADR-0067)")
    card_path = REPO / "public" / "social-cards" / f"{slug}.png"
    if card_path.exists():
        print(f"{card_path.name} exists — skip")
    else:
        run([npm(), "run", "cards:generate"],
            "Cards regenerate from committed assets; rerun freely.")

    # -- 11: deploy + the authoring report -------------------------------------
    step(11, total, "sync + report (hero:sync, hero:report --deployed)")
    run([npm(), "run", "hero:sync", "--", slug, season],
        "Sync copies the four derived payloads; rerun after fixing the derive.")
    run([npm(), "run", "hero:report", "--", slug, season, "--deployed"],
        "The report reads the deployed copies; rerun after hero:sync.")

    print(f"""
{'-' * 70}
hero:add complete: {player} {season} is scaffolded, data-complete, and
deployed. The suite is now RED ON PURPOSE (the ADR-0063 authoring
tripwire) until the judgment work is done:

  1. Land the banner photo at public/img/{slug}-hero.jpg
     (web-sized B&W derivative, ADR-0021) and credit it in
     docs/image-credits.md (the headshot credit too).
  2. Author the verdict, kicker, alt text, and focal points in
     src/heroes/{slug}.ts (replace every TODO(scaffold)), writing from
     the hero:report output above — the CLAIM HEADROOM section is the
     authoring aid.
  3. Declare the claims in src/heroes/{slug}.{season}.guard.test.ts.
  4. npm run cards:generate — the share card was skipped above because its
     eyebrow derives from the kicker; it generates once the kicker is
     authored (the committed-card guard stays red until then).
  5. Optional team mark: land a transparent PNG at
     public/img/<team>-logo.png, run
     python scripts/normalize_team_logo.py public/img/<team>-logo.png,
     and set teamLogoPath in the hero module.
  6. npm test && npm run lint && npm run build
""")


if __name__ == "__main__":
    main()
