"""Derive the team shot payload from raw files (ADR-0082): the golden path
and the season loop's `--engine files` fallback.

WHAT THIS DOES:
  For a (team, season), read the LATEST raw team-wide shotchartdetail
  snapshot (data/raw/_teams/<tricode>/<season>/<pull>.json) and the LATEST
  roster snapshot beside it (.../roster/<pull>.json), read every game's
  latest box score from the shared corpus (data/raw/box-score/<game>/), and
  hand the observations to team_payload.build_team_payload — the one
  grammar the record-store export also uses. Every fence is live: the
  per-player per-game box oracle, zone-point conflicts dropped and counted,
  the baseline rollup.

DETERMINISM: same inputs in -> byte-identical payload out.

USAGE:
  python ingestion/derive_team_payload.py --team "Utah Jazz" --season 2026-27
  # golden regeneration (from the repo root):
  python ingestion/derive_team_payload.py --snapshot-file tests/fixtures/team-snapshot.truncated.json --roster-file tests/fixtures/team-roster.truncated.json --box-files tests/fixtures/team-boxscore.truncated.json --out-file tests/fixtures/team-shot.golden.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import derive_payload as dp
import team_payload as tp


def team_dir(raw_root: Path, team: str, season: str) -> Path:
    return raw_root / "_teams" / tp.tricode_of(team).lower() / season


def latest_team_snapshot(raw_root: Path, team: str, season: str) -> Path:
    d = team_dir(raw_root, team, season)
    candidates = sorted(p for p in d.glob("*.json") if p.is_file())
    if not candidates:
        tp.fail(f"no team snapshot under {d} — run the season loop's team session "
                f"(or live_pulls.pull_team_shot_snapshot) first")
    return candidates[-1]


def latest_roster_snapshot(raw_root: Path, team: str, season: str) -> Path:
    d = team_dir(raw_root, team, season) / "roster"
    candidates = sorted(p for p in d.glob("*.json") if p.is_file())
    if not candidates:
        tp.fail(f"no roster snapshot under {d}")
    return candidates[-1]


def latest_box_path(raw_root: Path, game_id: str) -> Path | None:
    d = raw_root / "box-score" / game_id
    candidates = sorted(d.glob("*.json")) if d.exists() else []
    return candidates[-1] if candidates else None


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def box_fga_for(rows: list[dict], team_id: int, *, raw_root: Path,
                box_files: list[Path] | None) -> dict[str, dict[int, int]]:
    """{game_id: {player_id: FGA}} for the team's side of every game in rows.
    Explicit --box-files (fixtures) or the corpus's latest box per game; a
    missing box is the builder's failure to report, so it is left absent."""
    games = sorted({r["game_id"] for r in rows})
    box_fga: dict[str, dict[int, int]] = {}
    if box_files is not None:
        for path in box_files:
            snapshot = read_json(path)
            box_game = snapshot.get("response", {}).get("boxScoreTraditional")
            if not isinstance(box_game, dict):
                tp.fail(f"{path} has no boxScoreTraditional")
            game_id = str(box_game.get("gameId", ""))
            box_fga[game_id] = tp.box_fga_from_box_game(box_game, team_id, game_id)
        return box_fga
    for game_id in games:
        path = latest_box_path(raw_root, game_id)
        if path is None:
            continue
        box_game = read_json(path).get("response", {}).get("boxScoreTraditional")
        if not isinstance(box_game, dict):
            tp.fail(f"{path} has no boxScoreTraditional")
        box_fga[game_id] = tp.box_fga_from_box_game(box_game, team_id, game_id)
    return box_fga


def derive(snapshot_path: Path, roster_path: Path, *, raw_root: Path,
           box_files: list[Path] | None = None) -> dict:
    snapshot = read_json(snapshot_path)
    meta, shots, league = tp.validate_team_snapshot(snapshot)
    roster_meta, roster = tp.validate_roster_snapshot(read_json(roster_path))
    if (int(roster_meta["team_id"]), str(roster_meta["season"])) != (
            int(meta["team_id"]), str(meta["season"])):
        tp.fail(f"roster snapshot is team {roster_meta['team_id']} {roster_meta['season']}, "
                f"shots are team {meta['team_id']} {meta['season']}")
    rows = tp.rows_from_snapshot(shots)
    box_fga = box_fga_for(rows, int(meta["team_id"]), raw_root=raw_root, box_files=box_files)
    return tp.build_team_payload(
        meta=meta,
        source=dp.repo_relative(snapshot_path),
        roster_source=dp.repo_relative(roster_path),
        rows=rows,
        baseline_rows=tp.baseline_rows_from_frame(league),
        roster=roster,
        box_fga=box_fga,
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="Derive the team shot payload (ADR-0082).")
    ap.add_argument("--team", default="Utah Jazz")
    ap.add_argument("--season", default="2026-27")
    ap.add_argument("--raw-root", default="data/raw")
    ap.add_argument("--out-root", default="data/derived")
    ap.add_argument("--snapshot-file", help="explicit team snapshot path (bypasses raw-root)")
    ap.add_argument("--roster-file", help="explicit roster snapshot path")
    ap.add_argument("--box-files", nargs="*",
                    help="explicit box-score snapshot paths (fixtures); default reads "
                         "each game's latest box from <raw-root>/box-score/")
    ap.add_argument("--out-file", help="explicit output path (default: "
                                       "<out-root>/_teams/<tricode>/<season>/<pull-date>.json)")
    args = ap.parse_args()

    raw_root = Path(args.raw_root)
    snapshot_path = (Path(args.snapshot_file) if args.snapshot_file
                     else latest_team_snapshot(raw_root, args.team, args.season))
    roster_path = (Path(args.roster_file) if args.roster_file
                   else latest_roster_snapshot(raw_root, args.team, args.season))
    box_files = [Path(p) for p in args.box_files] if args.box_files is not None else None
    payload = derive(snapshot_path, roster_path, raw_root=raw_root, box_files=box_files)

    meta = payload["_meta"]
    out = (Path(args.out_file) if args.out_file
           else Path(args.out_root) / "_teams" / meta["tricode"].lower() / meta["season"]
           / f"{snapshot_path.stem}.json")
    tp.write_payload(out, payload)
    print(f"derived {meta['team']} {meta['season']}: {meta['totalShots']} shots, "
          f"{meta['gamesIncluded']} games through {meta['dataThrough']}, "
          f"{meta['zoneConflictsDropped']} conflict(s) dropped, "
          f"{len(payload['roster'])} on the roster -> {out}")


if __name__ == "__main__":
    main()
