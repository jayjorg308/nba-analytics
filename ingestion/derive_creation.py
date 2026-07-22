"""Derive the creation payload from the latest tracking snapshots (ADR-0030).

WHAT THIS DOES:
  For a (player, season), read the LATEST player tracking snapshot
  (data/raw/<slug>/<season>/tracking/<pull-date>.json) and the LATEST league
  tracking snapshot (data/raw/_league/<season>/tracking/<pull-date>.json),
  validate both, and persist the creation payload — the second typed contract,
  parallel to the shot payload and never joined to it:

      { _meta, general: {player, league}, shotClock: {player, league} }

  Metric-free per ADR-0007's rule: creation PPS and diet shares are computed
  by the pure aggregation function, never persisted. Counts only, with the
  2PT/3PT split that makes true creation PPS computable (ADR-0001).

THE RECONCILIATION (ADR-0030 as amended 2026-07-21 — exact-or-reported):
  The General family sums to the TRACKING OVERALL, and the gap between that
  and the official pre-drop season total (shot payload totalShots +
  zoneConflictsDropped) is the TRACKING SHORTFALL:
      Σ context FGA + _meta.trackingShortfall == pre-drop season FGA
  A shortfall is an NBA-side tracking outage — measured, persisted, reported
  in the UI whenever nonzero, never guessed into a context (ADR-0019). A
  NEGATIVE shortfall (tracking exceeding the official record) is
  contradiction, not outage, and fails the derive loudly. Shot Clock and
  Closest Defender are held to COVERAGE within the tracking universe: their
  shortfalls are counted against the tracking Overall (a family disagreeing
  with its own source is corruption, and the negative-gap fail catches it).

SPARSE ROWS (spike trap #1): the dashboards omit zero-attempt contexts
  (Cody Williams 2025-26 has no 'Other' row). The payload always carries
  every context of a shipped family — absent rows are filled with zeros here,
  so a partition is never silently punctured downstream.

LEAGUE 'Other' (spike trap #2): the league dashboard cannot filter to
  'Other'; its totals are the RESIDUAL by count subtraction
  (Overall − Σ resolved contexts) — counts, never rates, so the ADR-0004
  rule is preserved in reverse.

DETERMINISM: same snapshots in -> byte-identical payload out (stable field
  and array order, no derived-at timestamp, LF newlines). The committed
  golden fixture under tests/fixtures/ depends on this.

USAGE:
  python ingestion/derive_creation.py                        # Cody Williams, 2025-26
  python ingestion/derive_creation.py --player "Keyonte George"
  # golden-fixture regeneration (run from the repo root):
  python ingestion/derive_creation.py --snapshot-file tests/fixtures/tracking.truncated.json --league-file tests/fixtures/tracking.league.truncated.json --shot-payload-file tests/fixtures/derived.golden.json --out-file tests/fixtures/creation.golden.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

# Bump on any breaking payload change; pinned as a literal on the TS side
# (src/domain/creationPayload.ts) so a mismatch fails loudly at the load
# boundary. v1: General + Shot Clock families (ADR-0030).
# v2: Closest Defender family (the ADR-0030 fast-follow, ROADMAP v2.1).
# v3: trackingShortfall — the General identity is exact-or-reported
#     (ADR-0030 as amended; Ace Bailey's two outage games, v3 Phase 1).
SCHEMA_VERSION = 3

# --- Context families (see CONTEXT.md and ADR-0030) ----------------------------
# NBA row literals, verbatim, in deterministic payload order.
GENERAL_CONTEXTS = ["Catch and Shoot", "Pull Ups", "Less than 10 ft", "Other"]
SHOT_CLOCK_BANDS = [
    "24-22",
    "22-18 Very Early",
    "18-15 Early",
    "15-7 Average",
    "7-4 Late",
    "4-0 Very Late",
]
DEFENDER_RANGES = [
    "0-2 Feet - Very Tight",
    "2-4 Feet - Tight",
    "4-6 Feet - Open",
    "6+ Feet - Wide Open",
]

FAMILIES = [
    # (payload key, result set, context column, canonical contexts)
    ("general", "GeneralShooting", "SHOT_TYPE", GENERAL_CONTEXTS),
    ("shotClock", "ShotClockShooting", "SHOT_CLOCK_RANGE", SHOT_CLOCK_BANDS),
    ("closestDefender", "ClosestDefenderShooting", "CLOSE_DEF_DIST_RANGE", DEFENDER_RANGES),
]

STAT_COLS = ["FGA", "FGM", "FG2A", "FG2M", "FG3A", "FG3M"]

# Exact expected headers — any drift in the (unofficial) endpoint shape must
# fail loudly here, never flow silently into the payload. The two player
# tables differ only in the context column at position 5.
def player_headers(context_col: str) -> list[str]:
    return [
        "PLAYER_ID", "PLAYER_NAME_LAST_FIRST", "SORT_ORDER", "GP", "G",
        context_col, "FGA_FREQUENCY", "FGM", "FGA", "FG_PCT", "EFG_PCT",
        "FG2A_FREQUENCY", "FG2M", "FG2A", "FG2_PCT",
        "FG3A_FREQUENCY", "FG3M", "FG3A", "FG3_PCT",
    ]


LEAGUE_HEADERS = [
    "TEAM_ID", "TEAM_NAME", "TEAM_ABBREVIATION", "GP", "G",
    "FGA_FREQUENCY", "FGM", "FGA", "FG_PCT", "EFG_PCT",
    "FG2A_FREQUENCY", "FG2M", "FG2A", "FG2_PCT",
    "FG3A_FREQUENCY", "FG3M", "FG3A", "FG3_PCT",
]

PLAYER_META_KEYS = ["player", "player_id", "season", "season_type", "pull_date"]
LEAGUE_META_KEYS = ["season", "season_type", "pull_date", "resolved_filters"]


def fail(msg: str) -> None:
    sys.exit(f"derive_creation: {msg}")


def result_set(response: dict, name: str) -> pd.DataFrame | None:
    """Extract a named result set as a DataFrame; None if the set is absent.

    Duplicated from derive_payload.py deliberately (the working scripts stay
    untouched; extract a shared module when the duplication actually bites).
    """
    for rs in response.get("resultSets", []):
        if rs.get("name") == name:
            return pd.DataFrame(rs["rowSet"], columns=rs["headers"])
    return None


def league_frame(raw: dict) -> pd.DataFrame:
    """The league dash response has one result set; take it by position."""
    sets = raw.get("resultSets", [])
    if not sets:
        fail("league response has no result sets")
    return pd.DataFrame(sets[0]["rowSet"], columns=sets[0]["headers"])


def latest_snapshot(dir_: Path, hint: str) -> Path:
    candidates = sorted(dir_.glob("*.json"))
    if not candidates:
        fail(f"no tracking snapshot under {dir_} — run {hint} first")
    # ISO pull-date filenames sort lexicographically == chronologically.
    return candidates[-1]


def check_stat_sanity(df: pd.DataFrame, frame_name: str) -> None:
    """Counts must be internally coherent; a corrupt frame never flows on."""
    for col in STAT_COLS:
        if not (df[col].astype(int) >= 0).all():
            fail(f"{frame_name}: negative {col}")
    if not (df["FGA"] == df["FG2A"] + df["FG3A"]).all():
        fail(f"{frame_name}: FGA != FG2A + FG3A")
    if not (df["FGM"] == df["FG2M"] + df["FG3M"]).all():
        fail(f"{frame_name}: FGM != FG2M + FG3M")
    if not (df["FGM"] <= df["FGA"]).all():
        fail(f"{frame_name}: FGM exceeds FGA")
    # FG_PCT is used ONLY as this cross-check, then discarded: the payload
    # stores counts, never rates (ADR-0004).
    with_fga = df[df["FGA"] > 0]
    if not with_fga.empty:
        diff = (with_fga["FGM"] / with_fga["FGA"] - with_fga["FG_PCT"]).abs()
        if (diff > 0.001).any():
            fail(f"{frame_name}: FG_PCT does not reconcile with FGM/FGA — frame corrupt")


def entry(context: str, fga: int = 0, fgm: int = 0, fg2a: int = 0, fg2m: int = 0,
          fg3a: int = 0, fg3m: int = 0) -> dict:
    return {"context": context, "fga": fga, "fgm": fgm,
            "fg2a": fg2a, "fg2m": fg2m, "fg3a": fg3a, "fg3m": fg3m}


def row_entry(context: str, row: pd.Series) -> dict:
    return entry(context, int(row["FGA"]), int(row["FGM"]),
                 int(row["FG2A"]), int(row["FG2M"]),
                 int(row["FG3A"]), int(row["FG3M"]))


def player_family(response: dict, rs_name: str, context_col: str,
                  contexts: list[str]) -> list[dict]:
    """One family's player entries: validated, zero-filled, canonical order.

    SPARSE ROWS: a zero-attempt context is an ABSENT row in the dashboard —
    fill it with zeros so the family always carries every context. An
    UNKNOWN literal means the NBA changed the vocabulary: fail loudly,
    never guess (ADR-0028 ethos).
    """
    df = result_set(response, rs_name)
    if df is None:
        fail(f"result set {rs_name} missing from response")
    if list(df.columns) != player_headers(context_col):
        fail(f"{rs_name} headers changed: {list(df.columns)}")
    unknown = set(df[context_col].astype(str)) - set(contexts)
    if unknown:
        fail(f"unknown {context_col} literals in {rs_name}: {sorted(unknown)} "
             f"— the NBA vocabulary changed; update the context lists")
    dupes = df[context_col][df[context_col].duplicated()].tolist()
    if dupes:
        fail(f"{rs_name}: duplicated context rows: {dupes}")
    check_stat_sanity(df, rs_name)
    by_context = {str(r[context_col]): r for _, r in df.iterrows()}
    return [
        row_entry(c, by_context[c]) if c in by_context else entry(c)
        for c in contexts
    ]


def sum_league(raw: dict, frame_name: str) -> dict[str, int]:
    """League totals for one context call: SUM the team rows' counts
    (ADR-0004 — never average rates across teams)."""
    df = league_frame(raw)
    if list(df.columns) != LEAGUE_HEADERS:
        fail(f"{frame_name} headers changed: {list(df.columns)}")
    if df.empty:
        fail(f"{frame_name}: empty league frame")
    check_stat_sanity(df, frame_name)
    return {c: int(df[c].sum()) for c in STAT_COLS}


def totals_entry(context: str, t: dict[str, int]) -> dict:
    return entry(context, t["FGA"], t["FGM"], t["FG2A"], t["FG2M"], t["FG3A"], t["FG3M"])


def league_general(snapshot: dict, overall: dict[str, int]) -> list[dict]:
    """League General entries: resolved contexts from their filtered calls,
    plus AT MOST ONE unresolved context as the residual by count subtraction
    (Overall − Σ resolved). Two unresolved contexts would make the residual
    unsplittable — fail, never apportion."""
    resolved_filters: dict = snapshot["_meta"]["resolved_filters"]
    responses: dict = snapshot.get("general", {})
    totals: dict[str, dict[str, int]] = {}
    unresolved: list[str] = []
    for context in GENERAL_CONTEXTS:
        filter_literal = resolved_filters.get(context)
        if filter_literal is None:
            unresolved.append(context)
            continue
        raw = responses.get(filter_literal)
        if raw is None:
            fail(f"league snapshot has no response for General filter "
                 f"{filter_literal!r} (context {context!r})")
        totals[context] = sum_league(raw, f"league General {context!r}")

    summed = {c: sum(t[c] for t in totals.values()) for c in STAT_COLS}
    if len(unresolved) > 1:
        fail(f"multiple unresolved General contexts {unresolved} — "
             f"the residual cannot be split; fix the league pull")
    if unresolved:
        residual = {c: overall[c] - summed[c] for c in STAT_COLS}
        negative = {c: v for c, v in residual.items() if v < 0}
        if negative:
            fail(f"negative league residual for {unresolved[0]!r}: {negative} — "
                 f"resolved contexts exceed Overall; snapshots inconsistent")
        totals[unresolved[0]] = residual
    elif summed["FGA"] != overall["FGA"]:
        fail(f"league General contexts sum to {summed['FGA']} but Overall is "
             f"{overall['FGA']} with no residual context to absorb the gap")
    return [totals_entry(c, totals[c]) for c in GENERAL_CONTEXTS]


def league_coverage_family(snapshot: dict, section: str, contexts: list[str],
                           family_label: str,
                           overall: dict[str, int]) -> tuple[list[dict], int]:
    """League entries + the league-wide unattributed count, for a COVERAGE
    family (Shot Clock, Closest Defender — every context filtered directly,
    no residual context).

    Every context must be present — an absent one means the league baseline
    is incomplete for the season (the Gate-1 ethos: an unpopulated baseline
    fails, it doesn't limp)."""
    responses: dict = snapshot.get(section, {})
    entries: list[dict] = []
    total_fga = 0
    for context in contexts:
        raw = responses.get(context)
        if raw is None:
            fail(f"league snapshot missing {family_label} context {context!r} — "
                 f"baseline incomplete; re-run the league pull")
        t = sum_league(raw, f"league {family_label} {context!r}")
        total_fga += t["FGA"]
        entries.append(totals_entry(context, t))
    unattributed = overall["FGA"] - total_fga
    if unattributed < 0:
        fail(f"league {family_label} contexts sum to {total_fga}, exceeding "
             f"Overall {overall['FGA']} — snapshots inconsistent")
    return entries, unattributed


def season_fga_target(shot_payload_path: Path, player: str, season: str) -> int:
    """The shot payload's PRE-drop season FGA: totalShots + zoneConflictsDropped.

    Cross-checks player/season so the identity can never be 'confirmed'
    against the wrong sibling."""
    meta = json.loads(shot_payload_path.read_text(encoding="utf-8"))["_meta"]
    if meta["player"] != player or meta["season"] != season:
        fail(f"shot payload {shot_payload_path} is {meta['player']} {meta['season']}, "
             f"not {player} {season} — wrong sibling")
    return int(meta["totalShots"]) + int(meta["zoneConflictsDropped"])


def locate_shot_payload(slug: str, season: str) -> Path:
    """Latest derived shot payload; falls back to the committed deployed copy."""
    derived_dir = Path("data/derived") / slug / season
    candidates = sorted(p for p in derived_dir.glob("*.json") if p.is_file())
    if candidates:
        return candidates[-1]
    deployed = Path("public/data") / slug / f"{season}.json"
    if deployed.exists():
        return deployed
    fail(f"no shot payload for {slug} {season} (looked in {derived_dir} and "
         f"{deployed}) — run ingestion/derive_payload.py first")
    raise AssertionError  # unreachable; fail() exits


def repo_relative(path: Path) -> str:
    """Repo-relative, forward-slash form (deterministic across machines as
    long as the derive runs from the repo root)."""
    try:
        return path.resolve().relative_to(Path.cwd().resolve()).as_posix()
    except ValueError:
        return path.as_posix()


def check_meta(meta: dict, keys: list[str], label: str) -> None:
    if not isinstance(meta, dict):
        fail(f"{label} snapshot missing _meta")
    missing = [k for k in keys if k not in meta]
    if missing:
        fail(f"{label} snapshot _meta missing keys: {missing}")


def derive(player_snapshot: dict, league_snapshot: dict, season_fga: int,
           source: str, league_source: str) -> dict:
    """Pure derive over validated inputs — the unit the golden locks."""
    meta = player_snapshot.get("_meta")
    response = player_snapshot.get("response")
    if not isinstance(meta, dict) or not isinstance(response, dict):
        fail("player snapshot missing _meta/response — not a raw-layer file")
    check_meta(meta, PLAYER_META_KEYS, "player")
    check_meta(league_snapshot.get("_meta"), LEAGUE_META_KEYS, "league")
    if league_snapshot["_meta"]["season"] != meta["season"]:
        fail(f"league snapshot season {league_snapshot['_meta']['season']} != "
             f"player snapshot season {meta['season']}")

    families: dict[str, list[dict]] = {}
    for key, rs_name, context_col, contexts in FAMILIES:
        families[key] = player_family(response, rs_name, context_col, contexts)

    # The ADR-0030 identity, as amended: General sums to the tracking
    # Overall; the gap to the official pre-drop total is the tracking
    # shortfall — measured and persisted, never guessed into a context.
    # Over-attribution (tracking exceeding the official record) is
    # contradiction, not outage, and still fails hard.
    general_fga = sum(e["fga"] for e in families["general"])
    tracking_shortfall = season_fga - general_fga
    if tracking_shortfall < 0:
        fail(f"General family sums to {general_fga} FGA, EXCEEDING the shot "
             f"payload's pre-drop season total {season_fga} — tracking cannot "
             f"outcount the official record; payloads contradict; re-pull "
             f"both sources together, never force one to fit the other")

    # Coverage families (Shot Clock, Closest Defender): count the shortfall
    # against the TRACKING Overall (general_fga) — a family disagreeing with
    # its own source's total is corruption, not coverage.
    def player_unattributed(key: str, label: str) -> int:
        total = sum(e["fga"] for e in families[key])
        gap = general_fga - total
        if gap < 0:
            fail(f"{label} family sums to {total}, exceeding the tracking "
                 f"Overall {general_fga} — snapshots inconsistent")
        return gap

    clock_unattributed = player_unattributed("shotClock", "Shot Clock")
    defender_unattributed = player_unattributed("closestDefender", "Closest Defender")

    overall = sum_league(league_snapshot["overall"], "league Overall")
    lg_general = league_general(league_snapshot, overall)
    lg_clock, lg_clock_unattributed = league_coverage_family(
        league_snapshot, "shot_clock", SHOT_CLOCK_BANDS, "Shot Clock", overall)
    lg_defender, lg_defender_unattributed = league_coverage_family(
        league_snapshot, "closest_defender", DEFENDER_RANGES, "Closest Defender", overall)

    return {
        "_meta": {
            "schemaVersion": SCHEMA_VERSION,
            "player": meta["player"],
            "playerId": int(meta["player_id"]),
            "season": meta["season"],
            "seasonType": meta["season_type"],
            "pullDate": meta["pull_date"],
            "sourceSnapshot": source,
            "leagueSourceSnapshot": league_source,
            "seasonFga": season_fga,
            "trackingShortfall": tracking_shortfall,
            "shotClockUnattributed": clock_unattributed,
            "defenderUnattributed": defender_unattributed,
            "leagueFga": overall["FGA"],
            "leagueShotClockUnattributed": lg_clock_unattributed,
            "leagueDefenderUnattributed": lg_defender_unattributed,
        },
        "general": {"player": families["general"], "league": lg_general},
        "shotClock": {"player": families["shotClock"], "league": lg_clock},
        "closestDefender": {"player": families["closestDefender"], "league": lg_defender},
    }


def write_payload(out_path: Path, payload: dict) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # LF newline keeps output byte-identical across platforms (golden fixture).
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8", newline="\n")


def main() -> None:
    # Windows consoles default to cp1252, which can't print Σ (the summary's
    # working vocabulary). UTF-8 out, unconditionally.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(
        description="Derive the creation payload from the latest tracking snapshots."
    )
    ap.add_argument("--player", default="Cody Williams")
    ap.add_argument("--season", default="2025-26", help="launch season (CONTEXT.md)")
    ap.add_argument("--raw-root", default="data/raw")
    ap.add_argument("--out-root", default="data/derived")
    ap.add_argument("--snapshot-file",
                    help="explicit player tracking snapshot, bypassing the "
                         "raw-root lookup (golden-fixture workflow)")
    ap.add_argument("--league-file",
                    help="explicit league tracking snapshot (golden-fixture workflow)")
    ap.add_argument("--shot-payload-file",
                    help="explicit sibling shot payload for the reconciliation "
                         "target (golden-fixture workflow)")
    ap.add_argument("--out-file", help="explicit output path (golden-fixture workflow)")
    args = ap.parse_args()

    slug = args.player.lower().replace(" ", "-")  # same slug rule as pull scripts

    if args.snapshot_file:
        snapshot_path = Path(args.snapshot_file)
        if not snapshot_path.exists():
            fail(f"snapshot not found: {snapshot_path}")
    else:
        snapshot_path = latest_snapshot(
            Path(args.raw_root) / slug / args.season / "tracking",
            "ingestion/pull_tracking.py",
        )
    if args.league_file:
        league_path = Path(args.league_file)
        if not league_path.exists():
            fail(f"league snapshot not found: {league_path}")
    else:
        league_path = latest_snapshot(
            Path(args.raw_root) / "_league" / args.season / "tracking",
            "ingestion/pull_tracking.py",
        )

    player_snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    league_snapshot = json.loads(league_path.read_text(encoding="utf-8"))

    meta = player_snapshot.get("_meta", {})
    shot_payload_path = (Path(args.shot_payload_file) if args.shot_payload_file
                         else locate_shot_payload(
                             str(meta.get("player", args.player)).lower().replace(" ", "-"),
                             str(meta.get("season", args.season))))
    if not shot_payload_path.exists():
        fail(f"shot payload not found: {shot_payload_path}")
    season_fga = season_fga_target(
        shot_payload_path, str(meta.get("player")), str(meta.get("season")))

    payload = derive(player_snapshot, league_snapshot, season_fga,
                     repo_relative(snapshot_path), repo_relative(league_path))

    if args.out_file:
        out_path = Path(args.out_file)
    else:
        # Key derived output by the snapshot's own identity, not the CLI args.
        # The creation/ subdirectory keeps shot-payload globs (sync, tests)
        # blind to creation files by construction.
        out_slug = str(meta["player"]).lower().replace(" ", "-")
        season_dir = str(meta["season"]).replace("/", "-")
        out_path = (Path(args.out_root) / out_slug / season_dir / "creation"
                    / f"{meta['pull_date']}.json")
    write_payload(out_path, payload)

    m = payload["_meta"]
    print(f"derived creation payload -> {out_path}")
    shortfall = m["trackingShortfall"]
    general_note = ("exact" if shortfall == 0
                    else f"tracking shortfall {shortfall} — documented outage, reported")
    print(f"  {m['player']} {m['season']}  General Σ + {shortfall} == "
          f"{m['seasonFga']} ({general_note})  "
          f"unattributed: clock {m['shotClockUnattributed']} · "
          f"defender {m['defenderUnattributed']}")
    print(f"  league FGA {m['leagueFga']}  league unattributed: clock "
          f"{m['leagueShotClockUnattributed']} · defender {m['leagueDefenderUnattributed']}")


if __name__ == "__main__":
    main()
