// The growth aggregation (ADR-0061): season-over-season movement in the
// vs-league residuals, computed as a pure mapping over two seasons'
// aggregateShotMetrics outputs — each season against its own season's league
// baseline, so league drift nets out. The fifth single-call-site aggregation
// (ADR-0009/0011): presentation formats this output and computes nothing;
// displayed movement figures are differences of displayed anchors
// (ADR-0023), never raw deltas re-rounded.
//
// Scope is deliberately the two-axis spine plus the zone grain (ADR-0061):
// the visible scope bounds what a growth-sentence may claim. Creation,
// assist, and line growth are future extensions with their own decisions.

import type { ShotMetrics, ZoneMetricsRow } from './aggregate'
import { EVAL_ZONES } from './constants'
import type { EvalZone } from './constants'

export interface GrowthSeasonInput {
  /** The registry season string ('2025-26'). Prior must sort before current
   * — NBA season strings order lexicographically == chronologically. */
  season: string
  /** The payload's _meta.player — both inputs must name the same player. */
  player: string
  metrics: ShotMetrics
}

/** One season's residuals for one zone. dietGap is the coda chart's axis
 * (ADR-0062): his attempt share minus the league's, in share points. */
export interface GrowthZoneSeason {
  attempts: number
  attemptShare: number | null
  leagueAttemptShare: number
  dietGap: number | null
  /** The per-zone making residual (FG% points vs league), carried for the
   * table twin with its † flag — the chart charts diet, the stable axis. */
  makingDelta: number | null
  smallSampleMaking: boolean
}

export interface GrowthZoneRow {
  zone: EvalZone
  prior: GrowthZoneSeason
  current: GrowthZoneSeason
}

/** One season's two-axis spine: the headline residuals, each vs that
 * season's own league (ADR-0016 semantics, unchanged). */
export interface GrowthSpineSeason {
  selectionDelta: number | null
  makingPpsDelta: number | null
}

export interface GrowthMetrics {
  /** ADR-0002: the comparison class travels with the numbers — each season
   * vs its own season's league average, stated plainly in the UI. */
  comparisonClass: 'league-average'
  player: string
  priorSeason: string
  currentSeason: string
  /** Exactly the 6 evaluation zones, in EVAL_ZONES order. */
  zones: GrowthZoneRow[]
  spine: { prior: GrowthSpineSeason; current: GrowthSpineSeason }
}

function zoneSeason(row: ZoneMetricsRow): GrowthZoneSeason {
  return {
    attempts: row.attempts,
    attemptShare: row.attemptShare,
    leagueAttemptShare: row.leagueAttemptShare,
    dietGap: row.attemptShare === null ? null : row.attemptShare - row.leagueAttemptShare,
    makingDelta: row.makingDelta,
    smallSampleMaking: row.smallSampleMaking,
  }
}

function spineSeason(metrics: ShotMetrics): GrowthSpineSeason {
  return {
    selectionDelta: metrics.selection.selectionDelta,
    makingPpsDelta: metrics.making.makingPpsDelta,
  }
}

export function aggregateGrowthMetrics(
  prior: GrowthSeasonInput,
  current: GrowthSeasonInput,
): GrowthMetrics {
  // Identity gates, loud (the cross-sibling pattern): two seasons of the
  // same player, in chronological order — a violation is corruption, never
  // something to render around.
  if (prior.player !== current.player) {
    throw new Error(
      `growth inputs name different players: '${prior.player}' vs '${current.player}'`,
    )
  }
  if (prior.season >= current.season) {
    throw new Error(
      `growth seasons out of order: '${prior.season}' is not before '${current.season}'`,
    )
  }

  const zones: GrowthZoneRow[] = EVAL_ZONES.map((zone) => {
    const p = prior.metrics.zones.find((r) => r.zone === zone)
    const c = current.metrics.zones.find((r) => r.zone === zone)
    if (!p || !c) {
      throw new Error(`evaluation zone '${zone}' missing from a season's metrics`)
    }
    return { zone, prior: zoneSeason(p), current: zoneSeason(c) }
  })

  return {
    comparisonClass: 'league-average',
    player: current.player,
    priorSeason: prior.season,
    currentSeason: current.season,
    zones,
    spine: { prior: spineSeason(prior.metrics), current: spineSeason(current.metrics) },
  }
}
