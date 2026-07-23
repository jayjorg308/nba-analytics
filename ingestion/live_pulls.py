"""Frontier-anchored pull functions for the season loop (ADR-0058).

WHAT THIS IS: the lean, importable pull layer `season_update.py` drives — one
function per cumulative source (shots, player tracking, league tracking,
league totals), each accepting a `date_to` ceiling so the stored artifact
matches the publish unit exactly. The cumulative endpoints have no per-game
grain, so the frontier is enforced HERE, at pull time — never by slicing a
response after the fact (ADR-0058). Play-by-play/box pairs are per-game and
stay with ingestion/pull_play_by_play.py (--game-ids).

The interactive CLI pull scripts (pull_shots.py, pull_tracking.py,
pull_league_totals.py) stay untouched — they serve the completed-season
workflows and their gate reports. This module reuses their conventions:
verbatim responses under `response`/named sections, self-describing `_meta`
(pull date, date range, date_to when anchored — the raw-artifact rule), and
append-only writes.

SNAPSHOT NAMING: a live season pulls daily and may retry within a day, so
anchored snapshots are stamped `<pull-date>T<HHMMSS>.json`. 'T' sorts after
'.' lexicographically, so a stamped snapshot always sorts AFTER the same
day's plain `<pull-date>.json` — "latest snapshot" globbing stays correct
with zero changes to the derives. Append-only holds: a retry writes a new
stamp, never overwrites.

LOCAL-ONLY: stats.nba.com blocks cloud IPs. Never run from CI or the app.
"""

from __future__ import annotations

import json
import time
from datetime import datetime
from pathlib import Path

from nba_api.stats.endpoints import (
    leaguedashplayerstats,
    leaguedashteamptshot,
    playerdashptshots,
    shotchartdetail,
)

SEASON_TYPE = "Regular Season"

# League tracking context filters, resolved literals as recorded per raw
# snapshot _meta.resolved_filters since v2.0/v2.1 (ADR-0030 closures: league
# filter literals can differ in case from player-row literals).
LEAGUE_GENERAL_FILTERS = {
    "Catch and Shoot": "Catch and Shoot",
    "Pull Ups": "Pullups",
    "Less than 10 ft": "Less Than 10 ft",
    # 'Other' is not filterable — the residual by count subtraction at derive.
}
LEAGUE_CLOCK_FILTERS = [
    "24-22", "22-18 Very Early", "18-15 Early", "15-7 Average",
    "7-4 Late", "4-0 Very Late",
]
LEAGUE_DEFENDER_FILTERS = [
    "0-2 Feet - Very Tight", "2-4 Feet - Tight",
    "4-6 Feet - Open", "6+ Feet - Wide Open",
]


def nba_date(iso: str) -> str:
    """'2026-01-15' -> the endpoints' MM/DD/YYYY form."""
    y, m, d = iso.split("-")
    return f"{m}/{d}/{y}"


def stamp_now() -> str:
    """The snapshot stamp for this pull session: THHMMSS."""
    return datetime.now().strftime("T%H%M%S")


def write_snapshot(path: Path, snapshot: dict) -> Path:
    """Append-only write (ADR-0006): an existing path is never overwritten —
    the caller stamps retries into new names."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        raise FileExistsError(f"snapshot already exists (append-only): {path}")
    path.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
    return path


def result_rows(raw: dict, name: str) -> tuple[list[str], list[list]]:
    for rs in raw.get("resultSets", []):
        if rs.get("name") == name:
            return rs["headers"], rs["rowSet"]
    return [], []


def pull_shot_snapshot(
    player: str,
    player_id: int,
    season: str,
    out_dir: Path,
    *,
    date_to: str | None = None,
    stamp: str = "",
    pull_date: str,
    timeout: int = 60,
) -> Path:
    """One shotchartdetail pull — unfiltered (discovery) or frontier-anchored
    (date_to set). Both result sets kept verbatim (the LeagueAverages frame
    respects DateTo — the ADR-0058 spike closure — so an anchored pull
    carries the true as-of baseline)."""
    raw = shotchartdetail.ShotChartDetail(
        team_id=0,
        player_id=player_id,
        season_nullable=season,
        season_type_all_star=SEASON_TYPE,
        context_measure_simple="FGA",  # ALL attempts — never the PTS default
        date_to_nullable=nba_date(date_to) if date_to else "",
        timeout=timeout,
    ).get_dict()
    headers, rows = result_rows(raw, "Shot_Chart_Detail")
    dates = sorted(str(r[headers.index("GAME_DATE")]) for r in rows) if rows else []
    games = {str(r[headers.index("GAME_ID")]) for r in rows} if rows else set()
    snapshot = {
        "_meta": {
            "player": player,
            "player_id": player_id,
            "season": season,
            "season_type": SEASON_TYPE,
            "pull_date": pull_date,
            "pull_unit": "season",
            "date_to": date_to,  # None = unfiltered discovery pull
            "games_included": len(games),
            "date_range": [dates[0], dates[-1]] if dates else [None, None],
            "shot_rows": len(rows),
            "context_measure": "FGA",
            "source": "stats.nba.com shotchartdetail (unofficial)",
        },
        "response": raw,
    }
    return write_snapshot(out_dir / f"{pull_date}{stamp}.json", snapshot)


def pull_tracking_snapshot(
    player: str,
    player_id: int,
    season: str,
    out_dir: Path,
    *,
    date_to: str | None = None,
    stamp: str = "",
    pull_date: str,
    timeout: int = 60,
) -> Path:
    """One playerdashptshots pull (all families), optionally anchored."""
    raw = playerdashptshots.PlayerDashPtShots(
        team_id=0,
        player_id=player_id,
        season=season,
        season_type_all_star=SEASON_TYPE,
        per_mode_simple="Totals",  # raw counts — the endpoint defaults per-game
        date_to_nullable=nba_date(date_to) if date_to else "",
        timeout=timeout,
    ).get_dict()
    snapshot = {
        "_meta": {
            "player": player,
            "player_id": player_id,
            "season": season,
            "season_type": SEASON_TYPE,
            "pull_date": pull_date,
            "date_to": date_to,
            "per_mode": "Totals",
            "source": "stats.nba.com playerdashptshots (unofficial)",
        },
        "response": raw,
    }
    return write_snapshot(out_dir / f"{pull_date}{stamp}.json", snapshot)


def pull_league_totals_snapshot(
    season: str,
    out_dir: Path,
    *,
    date_to: str | None = None,
    stamp: str = "",
    pull_date: str,
    timeout: int = 60,
) -> Path:
    """One LeagueDashPlayerStats Totals pull, optionally anchored — the Gate 5
    oracle and league free-throw baseline source (ADR-0054), in the artifact
    shape derive_freethrow expects."""
    raw = leaguedashplayerstats.LeagueDashPlayerStats(
        season=season,
        season_type_all_star=SEASON_TYPE,
        per_mode_detailed="Totals",
        date_to_nullable=nba_date(date_to) if date_to else "",
        timeout=timeout,
    ).get_dict()
    snapshot = {
        "_meta": {
            "season": season,
            "season_type": SEASON_TYPE,
            "per_mode": "Totals",
            "pull_date": pull_date,
            "date_to": date_to,
            "source": "stats.nba.com leaguedashplayerstats (unofficial)",
        },
        "response": raw,
    }
    return write_snapshot(out_dir / f"{pull_date}{stamp}.json", snapshot)


def pull_league_tracking_snapshot(
    season: str,
    out_dir: Path,
    *,
    date_to: str | None = None,
    stamp: str = "",
    pull_date: str,
    sleep: float = 1.0,
    timeout: int = 60,
) -> Path:
    """The league creation baseline's filtered-call battery (ADR-0030),
    optionally anchored: Overall + every resolved General/clock/defender
    context, in the artifact shape derive_creation expects (overall/general/
    shot_clock/closest_defender sections + resolved_filters)."""

    def call(**filters: str) -> dict:
        time.sleep(sleep)
        return leaguedashteamptshot.LeagueDashTeamPtShot(
            season=season,
            season_type_all_star=SEASON_TYPE,
            per_mode_simple="Totals",
            date_to_nullable=nba_date(date_to) if date_to else "",
            timeout=timeout,
            **filters,
        ).get_dict()

    overall = call()
    general = {
        filter_literal: call(general_range_nullable=filter_literal)
        for filter_literal in LEAGUE_GENERAL_FILTERS.values()
    }
    shot_clock = {
        band: call(shot_clock_range_nullable=band) for band in LEAGUE_CLOCK_FILTERS
    }
    closest_defender = {
        rng: call(close_def_dist_range_nullable=rng) for rng in LEAGUE_DEFENDER_FILTERS
    }
    snapshot = {
        "_meta": {
            "season": season,
            "season_type": SEASON_TYPE,
            "pull_date": pull_date,
            "date_to": date_to,
            "per_mode": "Totals",
            "grain": "team (30 rows per context; summed at derive per ADR-0004)",
            "source": "stats.nba.com leaguedashteamptshot (unofficial)",
            "resolved_filters": {
                **LEAGUE_GENERAL_FILTERS,
                **{band: band for band in LEAGUE_CLOCK_FILTERS},
                **{rng: rng for rng in LEAGUE_DEFENDER_FILTERS},
            },
        },
        "overall": overall,
        "general": general,
        "shot_clock": shot_clock,
        "closest_defender": closest_defender,
    }
    return write_snapshot(out_dir / f"{pull_date}{stamp}.json", snapshot)
