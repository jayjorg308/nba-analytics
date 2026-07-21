// The pure free-throw aggregation (ADR-0055): the season line on
// endpoint-parity semantics, the trip taxonomy at its two tiers, and points
// per trip — over a free-throw payload ALONE. The and-one/shot join is
// validated in Python at derive (ADR-0053) and never re-performed here.
//
// A SIBLING of the other aggregations (ADR-0009/0011 extended a fourth
// time): one production call site (HeroPage adds it with THE LINE act),
// tooling reuses this function, and the output is never persisted.

import { SMALL_SAMPLE_MAKING_ATTEMPTS, ZONE_INCLUSION_MIN_ATTEMPTS } from './constants'
import { ATTEMPT_EQUIVALENT_CLASSES, TRIP_CLASSES } from './freethrowPayload'
import type { FreethrowPayload, TripClass } from './freethrowPayload'

export type TripTier = 'attemptEquivalent' | 'addOn'

/** Free throws per trip for every fixed-size class; flagrant varies (1–3 by
 * where and how the foul occurred), so it prices no league trip. */
const FIXED_TRIP_SIZE: Record<TripClass, number | null> = {
  shootingFoul2: 2,
  shootingFoul3: 3,
  bonus: 2,
  andOne: 1,
  flagrant: null,
  awayFromPlay: 1,
  transitionTake: 1,
  clearPath: 2,
}

/** A league-baselined season metric with its without-technicals cut: an
 * authored claim must hold on BOTH hero cuts against the league value
 * (ADR-0055's both-cuts discipline — the league side cannot exclude
 * technicals, so parity puts them in the headline value and the clean cut
 * rides alongside for the guard). Null only on a zero denominator. */
export interface BothCutsMetric {
  value: number | null
  withoutTechnicals: number | null
  league: number
}

export interface FreethrowSeasonLine {
  ftm: number
  fta: number
  technicalFtm: number
  technicalFta: number
  /** Pre-drop season FGA — the FTA-rate denominator (ADR-0055). */
  seasonFga: number
  seasonPoints: number
  /** FT% — free-throw conversion, the making analog at the line. */
  conversion: BothCutsMetric
  /** Same constant, same meaning as every other † on the page (ADR-0031). */
  smallSampleConversion: boolean
  /** FTA per pre-drop FGA — the foul-generation headline. */
  ftaRate: BothCutsMetric
  /** FT points over all points scored; the without-technicals cut removes
   * technical makes from the numerator (his point total is what it is). */
  ftPointsShare: BothCutsMetric
}

export interface TripClassRow {
  tripClass: TripClass
  tier: TripTier
  trips: number
  ftm: number
  fta: number
  /** FT% within the class; null on zero attempts — no data is not a claim
   * (ADR-0013's rule). */
  conversion: number | null
  smallSampleConversion: boolean
  /** Actual points per trip (ftm / trips); null on zero trips. */
  pointsPerTrip: number | null
  /** A league-average shooter's expected points on this class's trip
   * (fixed size × league FT%) — the line-vs-floor chart's league dot.
   * Null for flagrant (no fixed size). */
  leagueExpectedPointsPerTrip: number | null
  /** The shared dot floor (ADR-0031 amendment, ADR-0056): the chart draws
   * the player dot only at ≥15 free-throw attempts. */
  chartIncluded: boolean
}

/** A tier's summed line (counts summed, never rates averaged — ADR-0004). */
export interface TierRollup {
  trips: number
  ftm: number
  fta: number
  conversion: number | null
  smallSampleConversion: boolean
}

export interface FreethrowMetrics {
  /** ADR-0002: the comparison class travels with the numbers. */
  comparisonClass: 'league-average'
  seasonLine: FreethrowSeasonLine
  /** Every trip class, TRIP_CLASSES order — the taxonomy is a partition of
   * trips and renders whole (ADR-0031's discipline); zero rows stay. */
  tripClasses: TripClassRow[]
  attemptEquivalent: TierRollup
  addOn: TierRollup
  /** League FT% — the conversion baseline, technicals included by source. */
  leagueFreeThrowPct: number
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null
}

export function aggregateFreethrowMetrics(payload: FreethrowPayload): FreethrowMetrics {
  const meta = payload._meta
  const league = payload.leagueBaseline
  if (league.fta <= 0 || league.fga <= 0 || league.points <= 0) {
    // A zero-count league baseline can price nothing — the contract is
    // broken (the Gate-1 ethos: an unpopulated baseline fails, it doesn't limp).
    throw new Error('free-throw baseline unusable: league FTA/FGA/points must be positive')
  }
  const leagueFreeThrowPct = league.ftm / league.fta

  const seasonLine: FreethrowSeasonLine = {
    ftm: meta.seasonFtm,
    fta: meta.seasonFta,
    technicalFtm: meta.technicalFtm,
    technicalFta: meta.technicalFta,
    seasonFga: meta.seasonFga,
    seasonPoints: meta.seasonPoints,
    conversion: {
      value: ratio(meta.seasonFtm, meta.seasonFta),
      withoutTechnicals: ratio(
        meta.seasonFtm - meta.technicalFtm,
        meta.seasonFta - meta.technicalFta,
      ),
      league: leagueFreeThrowPct,
    },
    smallSampleConversion: meta.seasonFta < SMALL_SAMPLE_MAKING_ATTEMPTS,
    ftaRate: {
      value: ratio(meta.seasonFta, meta.seasonFga),
      withoutTechnicals: ratio(meta.seasonFta - meta.technicalFta, meta.seasonFga),
      league: league.fta / league.fga,
    },
    ftPointsShare: {
      value: ratio(meta.seasonFtm, meta.seasonPoints),
      withoutTechnicals: ratio(meta.seasonFtm - meta.technicalFtm, meta.seasonPoints),
      league: league.ftm / league.points,
    },
  }

  const tripClasses: TripClassRow[] = TRIP_CLASSES.map((tripClass) => {
    const rows = payload.trips.filter((trip) => trip.tripClass === tripClass)
    const trips = rows.length
    const ftm = rows.reduce((sum, trip) => sum + trip.ftm, 0)
    const fta = rows.reduce((sum, trip) => sum + trip.fta, 0)
    const size = FIXED_TRIP_SIZE[tripClass]
    return {
      tripClass,
      tier: (ATTEMPT_EQUIVALENT_CLASSES as readonly TripClass[]).includes(tripClass)
        ? 'attemptEquivalent'
        : 'addOn',
      trips,
      ftm,
      fta,
      conversion: ratio(ftm, fta),
      smallSampleConversion: fta < SMALL_SAMPLE_MAKING_ATTEMPTS,
      pointsPerTrip: ratio(ftm, trips),
      leagueExpectedPointsPerTrip: size === null ? null : size * leagueFreeThrowPct,
      chartIncluded: fta >= ZONE_INCLUSION_MIN_ATTEMPTS,
    }
  })

  const tierRollup = (tier: TripTier): TierRollup => {
    const rows = tripClasses.filter((row) => row.tier === tier)
    const trips = rows.reduce((sum, row) => sum + row.trips, 0)
    const ftm = rows.reduce((sum, row) => sum + row.ftm, 0)
    const fta = rows.reduce((sum, row) => sum + row.fta, 0)
    return {
      trips,
      ftm,
      fta,
      conversion: ratio(ftm, fta),
      smallSampleConversion: fta < SMALL_SAMPLE_MAKING_ATTEMPTS,
    }
  }

  return {
    comparisonClass: 'league-average',
    seasonLine,
    tripClasses,
    attemptEquivalent: tierRollup('attemptEquivalent'),
    addOn: tierRollup('addOn'),
    leagueFreeThrowPct,
  }
}
