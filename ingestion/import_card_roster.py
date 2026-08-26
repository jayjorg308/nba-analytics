"""The card-roster mass import (ADR-0081, phase 2). LOCAL ONLY.

Resumable end to end — every phase skips what exists, so a crashed or
interrupted run continues with the same command:

  A. ROSTER    — the mechanical criterion, as a query: every 2025-26 player
     at or above the FGA bar in league_season_totals (heroes are already
     deployed and skip through every phase). Duplicate full names cannot
     share a slug and are skipped loudly for manual follow-up.
  B. SHOTS     — one shotchartdetail snapshot per roster player without one,
     pulled by exact player_id through pull_shots' own internals (no name
     resolution), append-only per ADR-0006.
  C. LOADS     — load_hero_season per player (change-detected, FGA oracle).
  D. CORPUS    — the season's game universe from the store, minus pairs on
     disk, pulled via pull_play_by_play --game-ids (game-owned, shared).
  E. CARDS     — per player: load_game_corpus (trips + shot context rebuilt,
     every oracle live) and the game-log export; the committed games file is
     the phase's resume marker.
  F. INDEX     — the on-disk index rebuild.

CONNECTION DISCIPLINE: each phase opens its own connection and none is ever
held across a pull — Neon terminates idle-in-transaction sessions and
suspends idle computes, so a connection that outlives a seven-minute pull
phase is a crash, not a convenience. League artifacts resolve from the
STORE'S HEADS, never "latest file": replay runs leave frontier-anchored
artifacts in the _league dirs (ADR-0080 as amended).

Failures are collected per player and reported at the end (nonzero exit);
a failed player leaves no games file, so the rerun retries exactly the
stragglers. Rate limiting: --sleep between pulls (stats.nba.com is slow and
unofficial; run overnight for the full roster).

USAGE:
  python ingestion/import_card_roster.py --limit 3     # validation batch
  python ingestion/import_card_roster.py               # the full roster
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import time
import unicodedata
from datetime import date
from pathlib import Path

import psycopg

import export_gamelog_payload as egl
import load_game_corpus as lgc
import load_hero_season as lhs
import pull_shots
import record_store as rs

CONNECTION_ERRORS = (psycopg.OperationalError, psycopg.InterfaceError)

REPO = Path(__file__).resolve().parents[1]
RAW = REPO / "data" / "raw"
GAMES_ROOT = REPO / "public" / "data" / "games"
SEASON_TYPE = "Regular Season"
# Mirrors CARD_ROSTER_MIN_FGA (src/domain/constants.ts) — the mechanical
# card-roster bar (ADR-0081); the deployed guard enforces it on every
# committed non-registry games file.
MIN_FGA = 300


def log(msg: str) -> None:
    print(msg, flush=True)


def slug_of(name: str) -> str:
    """The RAW-layer directory rule — pull_shots' own naive form, kept
    byte-compatible so raw lookups find what the pullers wrote."""
    return name.lower().replace(" ", "-")


def url_slug_of(name: str) -> str:
    """The card slug: URL-clean and index-schema-legal (^[a-z0-9-]+$).
    'T.J. McConnell' -> 'tj-mcconnell', \"Royce O'Neale\" -> 'royce-oneale',
    'Vít Krejčí' -> 'vit-krejci'. Identical to slug_of for plain names, so
    hero slugs are unchanged."""
    folded = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9-]", "", folded.lower().replace(" ", "-"))


def latest(dir_: Path) -> Path | None:
    files = sorted(dir_.glob("*.json")) if dir_.exists() else []
    return files[-1] if files else None


def re_export_all(dsn: str, roster: list, season: str) -> None:
    """Re-export every roster player whose store data completes (a contract
    version move re-stamps all files); players whose corpus never finished
    (the taxonomy stragglers) skip and stay pending for the normal run.
    Reconnects on a lost connection like phase E."""
    import shutil

    if GAMES_ROOT.exists():
        shutil.rmtree(GAMES_ROOT)  # regenerable from the store; slugs may move
    exported = skipped = 0
    conn = rs.connect(dsn)
    try:
        rs.apply_migrations(conn)
        for pid, name, fga in roster:
            for attempt in (1, 2):
                try:
                    payload = egl.export_payload(conn, name, season)
                    out = GAMES_ROOT / url_slug_of(name) / f"{season}.json"
                    out.parent.mkdir(parents=True, exist_ok=True)
                    out.write_text(egl.payload_text(payload), encoding="utf-8",
                                   newline="\n")
                    exported += 1
                    break
                except CONNECTION_ERRORS:
                    if attempt == 1:
                        try:
                            conn.close()
                        except Exception:  # noqa: BLE001
                            pass
                        conn = rs.connect(dsn)
                        continue
                    skipped += 1
                except (SystemExit, Exception) as exc:  # noqa: BLE001
                    skipped += 1
                    log(f"skip {name}: {str(exc)[:100]}")
                    break
    finally:
        conn.close()
    log(f"re-exported {exported}, skipped {skipped}")
    egl.rebuild_index(GAMES_ROOT)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Mass-import the card roster (ADR-0081).")
    ap.add_argument("--season", default="2025-26")
    ap.add_argument("--min-fga", type=int, default=MIN_FGA)
    ap.add_argument("--limit", type=int, help="process at most N pending players")
    ap.add_argument("--sleep", type=float, default=1.5)
    ap.add_argument("--db-url", help="Postgres DSN (default: NBA_DB_URL)")
    ap.add_argument("--re-export-all", action="store_true",
                    help="wipe and re-export every completed roster player's "
                         "games file from the store (a contract version move)")
    args = ap.parse_args()
    season = args.season
    dsn = rs.resolve_dsn(args.db_url)
    pull_date = date.today().isoformat()
    failures: list[str] = []

    # A. The roster and the head-resolved league artifacts (one short-lived
    # connection; nothing survives into the pull phases).
    with rs.connect(dsn) as conn, conn.cursor() as cur:
        rs.apply_migrations(conn)
        cur.execute(
            "SELECT p.player_id, p.name, ls.fga FROM league_season_totals ls"
            " JOIN player p USING (player_id)"
            " WHERE ls.season = %s AND ls.season_type = %s AND ls.fga >= %s"
            " ORDER BY p.name",
            (season, SEASON_TYPE, args.min_fga),
        )
        roster = cur.fetchall()
        _, adv_rel, _, _ = rs.get_head(
            cur, rs.scope_key("league-advanced", season=season,
                              season_type=SEASON_TYPE))
        _, totals_rel, _, _ = rs.get_head(
            cur, rs.scope_key("league-totals", season=season,
                              season_type=SEASON_TYPE))
    advanced_path = REPO / adv_rel
    totals_path = REPO / totals_rel

    by_slug: dict[str, list] = {}
    for row in roster:
        by_slug.setdefault(url_slug_of(row[1]), []).append(row)
    clashes = {slug: rows for slug, rows in by_slug.items() if len(rows) > 1}
    for slug, rows in clashes.items():
        log(f"!! slug clash {slug!r}: "
            + ", ".join(f"{name} ({pid})" for pid, name, _ in rows)
            + " — skipped; needs a manual identity decision")
    roster = [r for r in roster if url_slug_of(r[1]) not in clashes]

    if args.re_export_all:
        re_export_all(dsn, roster, season)
        return

    pending = [
        (pid, name, fga) for pid, name, fga in roster
        if not (GAMES_ROOT / url_slug_of(name) / f"{season}.json").exists()
    ]
    if args.limit is not None:
        pending = pending[: args.limit]
    log(f"roster {len(roster)} at >= {args.min_fga} FGA · "
        f"{len(roster) - len(pending)} done · {len(pending)} pending"
        + (f" (limit {args.limit})" if args.limit is not None else ""))
    if not pending:
        egl.rebuild_index(GAMES_ROOT)
        return

    # B. Shot snapshots for pending players without one (no connection open).
    for pid, name, _ in pending:
        season_dir = RAW / slug_of(name) / season
        if latest(season_dir) is not None:
            continue
        log(f"pull shots: {name}")
        try:
            raw, shots, _league = pull_shots.pull_season(
                pid, season, SEASON_TYPE, timeout=60)
            snapshot = pull_shots.build_snapshot(
                {"full_name": name, "id": pid}, season, SEASON_TYPE,
                raw, shots, pull_date)
            pull_shots.write_snapshot(
                RAW, {"full_name": name, "id": pid}, season, snapshot, pull_date)
        except Exception as exc:  # noqa: BLE001 — collect, continue, retry on rerun
            failures.append(f"{name}: shot pull failed: {exc}")
            continue
        time.sleep(args.sleep)

    # C. Load each pending player's shot side (its own connection; loaders
    # commit per player, so the transaction never idles). A lost connection
    # reconnects and retries the player ONCE — Neon computes restart, and
    # the one thing a dead socket must never do is fail everyone after it.
    conn = rs.connect(dsn)
    try:
        for pid, name, _ in pending:
            snapshot_path = latest(RAW / slug_of(name) / season)
            if snapshot_path is None:
                continue  # pull failed above; already recorded
            for attempt in (1, 2):
                try:
                    lhs.load_hero_season(conn, snapshot_path=snapshot_path,
                                         advanced_path=advanced_path)
                    log(f"loaded shots: {name}")
                    break
                except CONNECTION_ERRORS as exc:
                    if attempt == 1:
                        log(f"connection lost at {name} — reconnecting")
                        try:
                            conn.close()
                        except Exception:  # noqa: BLE001
                            pass
                        conn = rs.connect(dsn)
                        continue
                    failures.append(f"{name}: shot load failed: {exc}")
                    log(f"load FAILED: {name} ({str(exc)[:120]})")
                except (SystemExit, Exception) as exc:  # noqa: BLE001 —
                    # per-player isolation: loaders roll back, the connection
                    # survives, the rerun retries the straggler.
                    failures.append(f"{name}: shot load failed: {exc}")
                    log(f"load FAILED: {name} ({str(exc)[:120]})")
                    break
    finally:
        conn.close()

    # D. The corpus gap, once for everyone. The game list comes from a
    # connection that is CLOSED before the (potentially hour-long) pull.
    with rs.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT DISTINCT game_id FROM game"
            " WHERE season = %s AND season_type = %s",
            (season, SEASON_TYPE),
        )
        all_games = [row[0] for row in cur.fetchall()]
    missing = [g for g in all_games if lgc.latest_pair(RAW, g) is None]
    if missing:
        log(f"corpus gap: {len(missing)} game pair(s) to pull")
        result = subprocess.run(
            [sys.executable, "ingestion/pull_play_by_play.py",
             "--game-ids", *missing],
            cwd=REPO, text=True, timeout=4 * 3600,
        )
        if result.returncode != 0:
            sys.exit("pull_play_by_play failed — rerun to resume")
    else:
        log("corpus complete on disk")

    # E. Per-player: corpus load (trips + context rebuilt, oracles live) and
    # the game-log export — the committed file is the resume marker. A lost
    # connection reconnects and retries the player once (see phase C).
    conn = rs.connect(dsn)
    try:
        for i, (pid, name, fga) in enumerate(pending, 1):
            out = GAMES_ROOT / url_slug_of(name) / f"{season}.json"
            if out.exists():
                continue
            for attempt in (1, 2):
                try:
                    lgc.load_game_corpus(conn, name, season,
                                         totals_path=totals_path)
                    payload = egl.export_payload(conn, name, season)
                    out.parent.mkdir(parents=True, exist_ok=True)
                    out.write_text(egl.payload_text(payload), encoding="utf-8",
                                   newline="\n")
                    log(f"[{i}/{len(pending)}] {name}: "
                        f"{payload['_meta']['totalGames']} games, {fga} FGA -> card")
                    break
                except CONNECTION_ERRORS as exc:
                    if attempt == 1:
                        log(f"connection lost at {name} — reconnecting")
                        try:
                            conn.close()
                        except Exception:  # noqa: BLE001
                            pass
                        conn = rs.connect(dsn)
                        continue
                    failures.append(f"{name}: corpus/export failed: {exc}")
                    log(f"[{i}/{len(pending)}] {name}: FAILED ({str(exc)[:120]})")
                except (SystemExit, Exception) as exc:  # noqa: BLE001 — see phase C
                    failures.append(f"{name}: corpus/export failed: {exc}")
                    log(f"[{i}/{len(pending)}] {name}: FAILED ({str(exc)[:120]})")
                    break
    finally:
        conn.close()

    egl.rebuild_index(GAMES_ROOT)
    if failures:
        log(f"\n{len(failures)} FAILURE(S) — rerun retries exactly these:")
        for f in failures:
            log(f"  - {f}")
        sys.exit(1)
    log("\nimport clean — every pending roster player has a games file")


if __name__ == "__main__":
    main()
