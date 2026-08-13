// The comparison-level pure module (comparison plan, increment 1): accepts
// validated comparison inputs plus parsed shot payloads, enforces the
// mode-specific invariants, builds the two EXACT comparison windows
// (ADR-0073/0077), and calls aggregateShotMetrics once per window with one
// shared baseline (ADR-0074). React never filters shots, tallies games,
// pairs zones, or chooses a baseline — that all lives here.
//
// Selection and making math stays aggregateShotMetrics's alone; this module
// only decides which shots each window holds and pairs the outputs.

import { aggregateShotMetrics } from './aggregate'
import type { ShotMetrics, ZoneMetricsRow } from './aggregate'
import { EVAL_ZONES } from './constants'
import type { EvalZone } from './constants'
import type { DerivedPayload, EnrichedShot, ZoneBaselineEntry } from './payload'

export type ComparisonMode = 'players' | 'split'

export interface ComparisonSide {
  id: 'left' | 'right'
  /** How the header names this side: the player's name in a player
   * comparison, Before/Since in a within-season one. */
  label: string
  playerName: string
  playerSlug: string
  season: string
  /** Earliest and latest game dates actually present in the window's shots
   * — the window as observed, so endDate is the payload's reconciled
   * frontier when the window is the unconstrained full season. */
  startDate: string
  endDate: string
  /** Distinct games in the window. */
  games: number
  /** Every shot in the window, backcourt included (the aggregation reports
   * backcourt; it never hides it). */
  shots: number
  metrics: ShotMetrics
}

/** One evaluation zone's two windows, paired by zone identity. Local sample
 * honesty rides the rows themselves (ADR-0075): `included` is the >= 15
 * selection-stability bar, `smallSampleMaking` the < 50 making flag. */
export interface ComparisonZoneRow {
  zone: EvalZone
  left: ZoneMetricsRow
  right: ZoneMetricsRow
}

export interface ComparisonMetrics {
  mode: ComparisonMode
  /** The season whose league baseline BOTH windows are measured against
   * (ADR-0074) — the page labels the ruler with this. */
  baselineSeason: string
  /** Split mode: the first date of the right window (ADR-0077); null in a
   * player comparison. */
  splitDate: string | null
  left: ComparisonSide
  right: ComparisonSide
  /** Exactly the 6 evaluation zones, in EVAL_ZONES order. */
  zones: readonly ComparisonZoneRow[]
}

export interface PlayerComparisonInput {
  /** The requested shared season — asserted against both payloads. */
  season: string
  left: { slug: string; payload: DerivedPayload }
  right: { slug: string; payload: DerivedPayload }
}

export interface SplitComparisonInput {
  slug: string
  /** The requested season — asserted against the payload. */
  season: string
  /** ISO date; the right window starts here, the left ends the day before. */
  splitDate: string
  payload: DerivedPayload
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function baselineKey(e: ZoneBaselineEntry): string {
  return e.grain === 'basic' ? `basic:${e.zone}` : `band:${e.band}`
}

/** Two payloads' league baselines must be IDENTICAL before one is shared —
 * a mismatch is a plain contradiction (two files claiming the same league
 * season disagree), never permission to choose one silently. */
function assertIdenticalBaselines(left: DerivedPayload, right: DerivedPayload): void {
  const rightByKey = new Map(right.zoneBaseline.map((e) => [baselineKey(e), e]))
  if (right.zoneBaseline.length !== left.zoneBaseline.length) {
    throw new Error(
      `league baselines contradict: ${left.zoneBaseline.length} entries vs ${right.zoneBaseline.length}`,
    )
  }
  for (const entry of left.zoneBaseline) {
    const other = rightByKey.get(baselineKey(entry))
    if (other === undefined || other.fga !== entry.fga || other.fgm !== entry.fgm) {
      throw new Error(
        `league baselines contradict at ${baselineKey(entry)}: ` +
          `${entry.fgm}/${entry.fga} vs ${other === undefined ? 'absent' : `${other.fgm}/${other.fga}`}`,
      )
    }
  }
}

function buildSide(
  id: 'left' | 'right',
  label: string,
  playerName: string,
  playerSlug: string,
  season: string,
  shots: EnrichedShot[],
  sharedBaseline: ZoneBaselineEntry[],
): ComparisonSide {
  // A comparison window carries no hero-eligibility bar (ADR-0075), but an
  // EMPTY window has nothing to compare and was rejected before this point.
  let startDate = shots[0]!.gameDate
  let endDate = startDate
  const games = new Set<string>()
  for (const s of shots) {
    if (s.gameDate < startDate) startDate = s.gameDate
    if (s.gameDate > endDate) endDate = s.gameDate
    games.add(s.gameId)
  }
  return {
    id,
    label,
    playerName,
    playerSlug,
    season,
    startDate,
    endDate,
    games: games.size,
    shots: shots.length,
    metrics: aggregateShotMetrics(shots, sharedBaseline),
  }
}

/** Pair the two windows' zone rows by zone identity, never array position. */
function pairZones(left: ShotMetrics, right: ShotMetrics): ComparisonZoneRow[] {
  const leftByZone = new Map(left.zones.map((r) => [r.zone, r]))
  const rightByZone = new Map(right.zones.map((r) => [r.zone, r]))
  return EVAL_ZONES.map((zone) => {
    const l = leftByZone.get(zone)
    const r = rightByZone.get(zone)
    if (l === undefined || r === undefined) {
      throw new Error(`zone '${zone}' missing from a window's aggregation`)
    }
    return { zone, left: l, right: r }
  })
}

/**
 * Player comparison: two distinct registered players' full-season windows
 * in one shared season, over one asserted-identical league baseline.
 */
export function aggregatePlayerComparison(input: PlayerComparisonInput): ComparisonMetrics {
  const { season, left, right } = input
  if (left.slug === right.slug) {
    throw new Error(`a player comparison needs two distinct players, got '${left.slug}' twice`)
  }
  for (const side of [left, right]) {
    if (side.payload._meta.season !== season) {
      throw new Error(
        `payload for '${side.slug}' is ${side.payload._meta.season}, not the requested ${season}`,
      )
    }
    if (side.payload.shots.length === 0) {
      throw new Error(`'${side.slug}' has no shots in ${season}; nothing to compare`)
    }
  }
  assertIdenticalBaselines(left.payload, right.payload)
  // One shared ruler (ADR-0074): both aggregations receive the SAME
  // baseline object, not two copies asserted equal.
  const sharedBaseline = left.payload.zoneBaseline

  const leftSide = buildSide(
    'left',
    left.payload._meta.player,
    left.payload._meta.player,
    left.slug,
    season,
    left.payload.shots,
    sharedBaseline,
  )
  const rightSide = buildSide(
    'right',
    right.payload._meta.player,
    right.payload._meta.player,
    right.slug,
    season,
    right.payload.shots,
    sharedBaseline,
  )
  return {
    mode: 'players',
    baselineSeason: season,
    splitDate: null,
    left: leftSide,
    right: rightSide,
    zones: pairZones(leftSide.metrics, rightSide.metrics),
  }
}

/**
 * Within-season comparison: one player's season partitioned exactly once at
 * the split date — left strictly before, right at-or-after (ADR-0077's
 * complete natural windows; no trimming by games, FGA, or calendar length)
 * — with the payload's own full-season baseline as both windows' ruler
 * (ADR-0074).
 */
export function aggregateSplitComparison(input: SplitComparisonInput): ComparisonMetrics {
  const { slug, season, splitDate, payload } = input
  if (!ISO_DATE.test(splitDate)) {
    throw new Error(`split date '${splitDate}' is not an ISO date`)
  }
  if (payload._meta.season !== season) {
    throw new Error(`payload for '${slug}' is ${payload._meta.season}, not the requested ${season}`)
  }

  const leftShots = payload.shots.filter((s) => s.gameDate < splitDate)
  const rightShots = payload.shots.filter((s) => s.gameDate >= splitDate)
  if (leftShots.length === 0) {
    throw new Error(`no shots before ${splitDate}; the split leaves an empty left window`)
  }
  if (rightShots.length === 0) {
    throw new Error(`no shots on or after ${splitDate}; the split leaves an empty right window`)
  }
  // The two complementary date filters cannot overlap or drop a shot, but
  // the partition identity is a stated invariant — assert it, don't trust it.
  if (leftShots.length + rightShots.length !== payload.shots.length) {
    throw new Error('split windows do not reproduce the complete shot set')
  }

  const sharedBaseline = payload.zoneBaseline
  const player = payload._meta.player
  const leftSide = buildSide('left', 'Before', player, slug, season, leftShots, sharedBaseline)
  const rightSide = buildSide('right', 'Since', player, slug, season, rightShots, sharedBaseline)
  return {
    mode: 'split',
    baselineSeason: season,
    splitDate,
    left: leftSide,
    right: rightSide,
    zones: pairZones(leftSide.metrics, rightSide.metrics),
  }
}
