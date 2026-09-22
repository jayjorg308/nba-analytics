"""Derive the game ledger facts from raw box scores (ADR-0084): the golden
path and the season loop's `--engine files` fallback.

Reads a team shot payload (the ledger's game set and matchups) and every
game's latest box score from the shared corpus, and hands them to
ledger_facts.build_ledger — the grammar the record-store export shares.

USAGE:
  python ingestion/derive_ledger_facts.py --team-payload-file data/derived/_teams/uta/2026-27/<pull>.json
  # golden regeneration (from the repo root):
  python ingestion/derive_ledger_facts.py --team-payload-file tests/fixtures/team-shot.golden.json --box-files tests/fixtures/team-boxscore.truncated.json --out-file tests/fixtures/team-ledger.golden.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import derive_payload as dp
import derive_team_payload as dtp
import ledger_facts as lf


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def derive(team_payload_path: Path, *, raw_root: Path, box_files: list[Path] | None) -> dict:
    payload = read_json(team_payload_path)
    team_id = int(payload["_meta"]["teamId"])
    boxes: dict[str, dict] = {}
    if box_files is not None:
        for path in box_files:
            box_game = read_json(path).get("response", {}).get("boxScoreTraditional")
            if not isinstance(box_game, dict):
                lf.fail(f"{path} has no boxScoreTraditional")
            game_id = str(box_game.get("gameId", ""))
            boxes[game_id] = lf.game_box_from_box_game(box_game, team_id, game_id)
    else:
        for game_id in sorted({s["gameId"] for s in payload["shots"]}):
            path = dtp.latest_box_path(raw_root, game_id)
            if path is None:
                continue  # the builder names the missing game
            box_game = read_json(path).get("response", {}).get("boxScoreTraditional")
            if not isinstance(box_game, dict):
                lf.fail(f"{path} has no boxScoreTraditional")
            boxes[game_id] = lf.game_box_from_box_game(box_game, team_id, game_id)
    return lf.build_ledger(team_payload=payload, boxes=boxes,
                           source_team_payload=dp.repo_relative(team_payload_path))


def main() -> None:
    ap = argparse.ArgumentParser(description="Derive the game ledger facts (ADR-0084).")
    ap.add_argument("--team-payload-file", required=True)
    ap.add_argument("--raw-root", default="data/raw")
    ap.add_argument("--box-files", nargs="*",
                    help="explicit box-score snapshot paths (fixtures); default reads "
                         "each game's latest box from <raw-root>/box-score/")
    ap.add_argument("--out-file", help="output path (default: beside the team payload, "
                                       "under a ledger/ sibling directory)")
    args = ap.parse_args()

    team_payload_path = Path(args.team_payload_file)
    box_files = [Path(p) for p in args.box_files] if args.box_files is not None else None
    ledger = derive(team_payload_path, raw_root=Path(args.raw_root), box_files=box_files)
    out = (Path(args.out_file) if args.out_file
           else team_payload_path.parent / "ledger" / team_payload_path.name)
    lf.write_payload(out, ledger)
    meta = ledger["_meta"]
    print(f"ledger {meta['team']} {meta['season']}: {meta['gamesIncluded']} games through "
          f"{meta['dataThrough']} -> {out}")


if __name__ == "__main__":
    main()
