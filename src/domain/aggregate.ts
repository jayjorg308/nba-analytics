// The single pure aggregation function (ADR-0007): computes v1's player-side
// metrics — diet-weighted expected PPS, the headline making rollup, per-zone
// making deltas, suppression / small-sample flags — over an array of
// enriched shots.
//
// v1 calls it once with all shots; that call is the all-pass case of the
// filtered subsets v2 will pass (which is why it takes the shots array, not
// the payload). Keep it a single call site per ADR-0007: do not scatter
// aggregation across the app. The output is never persisted — the payload
// stays metric-free.

import {
  EVAL_ZONES,
  LONG_TWO_BAND,
  MID_RANGE_BANDS,
  SMALL_SAMPLE_MAKING_ATTEMPTS,
  ZONE_INCLUSION_MIN_ATTEMPTS,
  ZONE_POINT_VALUE,
} from './constants'
import type { EvalZone, MidRangeBand } from './constants'
import type { EnrichedShot, ZoneBaselineEntry } from './payload'

export interface ZoneMetricsRow {
  zone: EvalZone
  attempts: number
  makes: number
  /** Share of the player's evaluation attempts; null when he has none. */
  attemptShare: number | null
  /** League share of evaluation attempts, renormalized over the 6 eval zones. */
  leagueAttemptShare: number
  fgPct: number | null
  leagueFgPct: number
  pps: number | null
  leaguePps: number
  /** Shot making (ADR-0001): player FG% minus league FG%, same zone. */
  makingDelta: number | null
  /** Mix-view inclusion at >= 15 attempts (ADR-0008). Display-scoped:
   * excluded zones still count toward the diet weighting. */
  included: boolean
  /** Small-sample uncertainty flag on the making delta — flags, never
   * suppresses (ADR-0008: no second hard cutoff on the making axis). */
  smallSampleMaking: boolean
}

export interface BandMetricsRow {
  band: MidRangeBand
  attempts: number
  makes: number
  /** Share of the player's evaluation attempts — the SAME denominator as
   * every other Share in the table (one denominator rule: parent/child rows
   * sum, and "his 16-24ft share vs the league's" compares like with like). */
  attemptShare: number | null
  leagueAttemptShare: number
  fgPct: number | null
  leagueFgPct: number
  pps: number | null
  leaguePps: number
  makingDelta: number | null
  smallSampleMaking: boolean
}

/** The three 3-point evaluation zones rolled up into one line: player makes
 * and attempts summed, league FGM/FGA summed then re-divided (the ADR-0004
 * rule — never averaged rates). Exists so the making verdict can be stated at
 * a grain the sample supports: for the launch hero every 3PT zone is
 * individually sub-50 (flagged) while the combined attempts clear the bar. */
export interface ThreesMetrics {
  attempts: number
  makes: number
  /** Share of the player's evaluation attempts taken from three. */
  attemptShare: number | null
  leagueAttemptShare: number
  fgPct: number | null
  leagueFgPct: number
  pps: number | null
  leaguePps: number
  /** Same semantics as ZoneMetricsRow.makingDelta: FG% minus league FG%. */
  makingDelta: number | null
  smallSampleMaking: boolean
}

export interface ShotMetrics {
  /** ADR-0002: the comparison class travels with the numbers and must be
   * stated plainly in the UI — "vs league average", never peer-adjusted. */
  comparisonClass: 'league-average'
  totalAttempts: number
  /** Attempts in the 6 evaluation zones (Backcourt excluded). */
  evalAttempts: number
  /** Backcourt heaves: excluded from evaluation, reported, never hidden. */
  backcourt: { attempts: number; makes: number }
  selection: {
    /** The headline selection number: the player's zone attempt shares
     * weighted by each zone's LEAGUE PPS — his making held at league level,
     * isolating selection (ADR-0001). */
    playerDietExpectedPps: number | null
    /** The same weighting applied to the league's own shares — the benchmark
     * is the league's own diet, never an arbitrary bar (ADR-0002). */
    leagueDietExpectedPps: number
    selectionDelta: number | null
  }
  making: {
    /** Actual conversion over evaluation attempts: points scored / FGA. */
    actualPps: number | null
    /** The headline making number (ADR-0016): actual PPS minus the
     * diet-weighted expected PPS — what his conversion adds or subtracts
     * with his shot diet held fixed. Denominated in PPS (the whole-diet
     * value consequence), unlike the per-zone makingDelta (FG% pp, one
     * zone's conversion). Identity: leagueDietExpectedPps + selectionDelta
     * + makingPpsDelta = actualPps. */
    makingPpsDelta: number | null
  }
  /** Exactly the 6 evaluation zones, in EVAL_ZONES order. */
  zones: ZoneMetricsRow[]
  /** The combined-threes rollup — the verdict-grain 3PT line (ADR-0016). */
  threes: ThreesMetrics
  /** ADR-0008 launch-hero refinements, computed unconditionally with
   * data-driven visibility — no hero-conditional code paths, so a different
   * hero re-runs the gate for free. */
  midRangeSplit: { visible: boolean; bands: BandMetricsRow[] }
  cornerSplit: { visible: boolean; left: ZoneMetricsRow; right: ZoneMetricsRow }
}

interface Tally {
  attempts: number
  makes: number
}

function tallyShots<K extends string>(shots: EnrichedShot[], key: (s: EnrichedShot) => K): Map<K, Tally> {
  const tallies = new Map<K, Tally>()
  for (const shot of shots) {
    const k = key(shot)
    const t = tallies.get(k) ?? { attempts: 0, makes: 0 }
    t.attempts += 1
    if (shot.made) t.makes += 1
    tallies.set(k, t)
  }
  return tallies
}

export function aggregateShotMetrics(
  shots: EnrichedShot[],
  baseline: ZoneBaselineEntry[],
): ShotMetrics {
  const basicBaseline = new Map(
    baseline.filter((e) => e.grain === 'basic').map((e) => [e.zone, e]),
  )
  const bandBaseline = new Map(
    baseline.filter((e) => e.grain === 'midRangeBand').map((e) => [e.band, e]),
  )
  for (const zone of EVAL_ZONES) {
    const entry = basicBaseline.get(zone)
    if (!entry || entry.fga === 0) {
      // parseDerivedPayload guarantees presence; fga=0 would make the league
      // FG% undefined. Either way the contract is broken — fail loudly.
      throw new Error(`baseline unusable for evaluation zone '${zone}'`)
    }
  }

  const zoneTallies = tallyShots(shots, (s) => s.zoneBasic)
  const backcourtTally = zoneTallies.get('Backcourt') ?? { attempts: 0, makes: 0 }
  const totalAttempts = shots.length
  const evalAttempts = totalAttempts - backcourtTally.attempts

  const leagueEvalFga = EVAL_ZONES.reduce((sum, z) => sum + basicBaseline.get(z)!.fga, 0)

  const zones: ZoneMetricsRow[] = EVAL_ZONES.map((zone) => {
    const league = basicBaseline.get(zone)!
    const { attempts, makes } = zoneTallies.get(zone) ?? { attempts: 0, makes: 0 }
    const pointValue = ZONE_POINT_VALUE[zone]
    const fgPct = attempts > 0 ? makes / attempts : null
    const leagueFgPct = league.fgm / league.fga
    return {
      zone,
      attempts,
      makes,
      attemptShare: evalAttempts > 0 ? attempts / evalAttempts : null,
      leagueAttemptShare: league.fga / leagueEvalFga,
      fgPct,
      leagueFgPct,
      pps: fgPct === null ? null : fgPct * pointValue,
      leaguePps: leagueFgPct * pointValue,
      makingDelta: fgPct === null ? null : fgPct - leagueFgPct,
      included: attempts >= ZONE_INCLUSION_MIN_ATTEMPTS,
      smallSampleMaking: attempts < SMALL_SAMPLE_MAKING_ATTEMPTS,
    }
  })

  // Diet weighting uses all six evaluation zones regardless of `included`:
  // inclusion is a display concern, and dropping a sub-15 zone's attempts
  // would misstate the diet itself.
  const playerDietExpectedPps =
    evalAttempts > 0
      ? zones.reduce((sum, r) => sum + (r.attemptShare ?? 0) * r.leaguePps, 0)
      : null
  const leagueDietExpectedPps = zones.reduce(
    (sum, r) => sum + r.leagueAttemptShare * r.leaguePps,
    0,
  )

  // The making rollup (ADR-0016): actual conversion vs the diet-held
  // expectation. Points come off the zone rows — every shot in a zone
  // carries that zone's point value (schema-enforced).
  const evalPoints = zones.reduce((sum, r) => sum + r.makes * ZONE_POINT_VALUE[r.zone], 0)
  const actualPps = evalAttempts > 0 ? evalPoints / evalAttempts : null

  // Combined threes: player and league both rolled up by SUMMING makes and
  // attempts (ADR-0004) — averaging the three zones' rates would silently
  // overweight the low-volume corners.
  const threeZones = zones.filter((r) => ZONE_POINT_VALUE[r.zone] === 3)
  const threesAttempts = threeZones.reduce((sum, r) => sum + r.attempts, 0)
  const threesMakes = threeZones.reduce((sum, r) => sum + r.makes, 0)
  const threesLeagueFga = threeZones.reduce((sum, r) => sum + basicBaseline.get(r.zone)!.fga, 0)
  const threesLeagueFgm = threeZones.reduce((sum, r) => sum + basicBaseline.get(r.zone)!.fgm, 0)
  const threesFgPct = threesAttempts > 0 ? threesMakes / threesAttempts : null
  const threesLeagueFgPct = threesLeagueFgm / threesLeagueFga

  const midShots = shots.filter((s) => s.zoneBasic === 'Mid-Range')
  const bandTallies = tallyShots(midShots, (s) => s.zoneRange)
  for (const band of bandTallies.keys()) {
    if (!bandBaseline.has(band as MidRangeBand)) {
      throw new Error(`player mid-range band '${band}' has no baseline entry`)
    }
  }
  const bands: BandMetricsRow[] = MID_RANGE_BANDS.filter((b) => bandBaseline.has(b)).map(
    (band) => {
      const league = bandBaseline.get(band)!
      const { attempts, makes } = bandTallies.get(band) ?? { attempts: 0, makes: 0 }
      const fgPct = attempts > 0 ? makes / attempts : null
      const leagueFgPct = league.fgm / league.fga
      return {
        band,
        attempts,
        makes,
        // One denominator rule: band shares are of ALL evaluation attempts
        // (like every zone row), so the bands sum to their Mid-Range parent
        // and league comparisons stay like-for-like.
        attemptShare: evalAttempts > 0 ? attempts / evalAttempts : null,
        leagueAttemptShare: league.fga / leagueEvalFga,
        fgPct,
        leagueFgPct,
        pps: fgPct === null ? null : fgPct * 2,
        leaguePps: leagueFgPct * 2,
        makingDelta: fgPct === null ? null : fgPct - leagueFgPct,
        smallSampleMaking: attempts < SMALL_SAMPLE_MAKING_ATTEMPTS,
      }
    },
  )
  // The split ships when the long-two band is material (>= the inclusion
  // bar) — the ADR-0008 promotion rule. Selection transparency, not a making
  // indictment.
  const longTwoAttempts = bandTallies.get(LONG_TWO_BAND)?.attempts ?? 0

  const leftCorner = zones.find((r) => r.zone === 'Left Corner 3')!
  const rightCorner = zones.find((r) => r.zone === 'Right Corner 3')!

  return {
    comparisonClass: 'league-average',
    totalAttempts,
    evalAttempts,
    backcourt: { attempts: backcourtTally.attempts, makes: backcourtTally.makes },
    selection: {
      playerDietExpectedPps,
      leagueDietExpectedPps,
      selectionDelta:
        playerDietExpectedPps === null ? null : playerDietExpectedPps - leagueDietExpectedPps,
    },
    making: {
      actualPps,
      makingPpsDelta:
        actualPps === null || playerDietExpectedPps === null
          ? null
          : actualPps - playerDietExpectedPps,
    },
    zones,
    threes: {
      attempts: threesAttempts,
      makes: threesMakes,
      attemptShare: evalAttempts > 0 ? threesAttempts / evalAttempts : null,
      leagueAttemptShare: threesLeagueFga / leagueEvalFga,
      fgPct: threesFgPct,
      leagueFgPct: threesLeagueFgPct,
      pps: threesFgPct === null ? null : threesFgPct * 3,
      leaguePps: threesLeagueFgPct * 3,
      makingDelta: threesFgPct === null ? null : threesFgPct - threesLeagueFgPct,
      smallSampleMaking: threesAttempts < SMALL_SAMPLE_MAKING_ATTEMPTS,
    },
    midRangeSplit: {
      visible: longTwoAttempts >= ZONE_INCLUSION_MIN_ATTEMPTS,
      bands,
    },
    cornerSplit: {
      // Secondary corner view: shown only when BOTH corners individually
      // clear the volume bar (CONTEXT.md); silent otherwise.
      visible:
        leftCorner.attempts >= ZONE_INCLUSION_MIN_ATTEMPTS &&
        rightCorner.attempts >= ZONE_INCLUSION_MIN_ATTEMPTS,
      left: leftCorner,
      right: rightCorner,
    },
  }
}
