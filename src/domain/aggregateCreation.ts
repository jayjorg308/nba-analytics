// The pure creation aggregation (ADR-0030): computes v2.0's creation metrics
// — context diet shares, creation PPS, small-sample flags, and the shot-clock
// product-grain rollup — over a creation payload.
//
// A SIBLING of aggregateShotMetrics, deliberately not a widening of it: the
// inputs are disjoint payloads on independent contracts, and coupling them
// would churn both test/golden paths on either side's schema bump. Same
// rules apply: one production call site (HeroPage's HeroReady adds it with
// the creation panel), tooling consumers reuse this function (never a second
// implementation — ADR-0009), and the output is never persisted (the payload
// stays metric-free).

import { SMALL_SAMPLE_MAKING_ATTEMPTS } from './constants'
import type { CreationPayload, GeneralContext } from './creationPayload'

/** Structural entry shape shared by both families (their `context` unions
 * differ, so the schema-inferred types don't unify). */
interface ContextEntry {
  context: string
  fga: number
  fgm: number
  fg2a: number
  fg2m: number
  fg3a: number
  fg3m: number
}

/**
 * The shot-clock PRODUCT grain (ADR-0030, closed from the spike): the NBA's
 * six bands roll up to three by SUMMING makes and attempts on both the player
 * and league sides (the ADR-0016 combined-threes pattern — fine grain
 * persisted, verdict grain computed). Chosen so every product band clears the
 * small-sample bar for both current heroes; the payload keeps the six-band
 * grain, so retuning this rollup is an aggregation change, not a schema bump.
 */
export const CLOCK_BAND_ROLLUP = [
  { band: 'Early', seconds: '24-15', contexts: ['24-22', '22-18 Very Early', '18-15 Early'] },
  { band: 'Average', seconds: '15-7', contexts: ['15-7 Average'] },
  { band: 'Late', seconds: '7-0', contexts: ['7-4 Late', '4-0 Very Late'] },
] as const
export type ClockBand = (typeof CLOCK_BAND_ROLLUP)[number]['band']

/** The rim/short bucket — the one General context with no creation signal. */
export const INSIDE_CONTEXT = 'Less than 10 ft' satisfies GeneralContext
/** The 10-ft-and-out contexts whose sum is the jumper parent, in display order. */
export const JUMPER_CONTEXTS = ['Catch and Shoot', 'Pull Ups', 'Other'] as const

/**
 * The Closest Defender PRODUCT grain (ROADMAP v2.1): the NBA's four
 * distances roll up to three, same rules as the clock — 'Very Tight' alone
 * sits just under the small-sample bar for both current heroes (44/48
 * attempts), so it sums into Tight; 'Wide Open' stays its own band because
 * it is the payoff row (open shots, measured).
 */
export const DEFENDER_BAND_ROLLUP = [
  { band: 'Tight', feet: '0-4', contexts: ['0-2 Feet - Very Tight', '2-4 Feet - Tight'] },
  { band: 'Open', feet: '4-6', contexts: ['4-6 Feet - Open'] },
  { band: 'Wide open', feet: '6+', contexts: ['6+ Feet - Wide Open'] },
] as const
export type DefenderBand = (typeof DEFENDER_BAND_ROLLUP)[number]['band']

interface CreationCells {
  attempts: number
  makes: number
  /** Share of the player's season attempts (the pre-drop seasonFga — one
   * denominator per family side, so a partition's shares sum). Null only
   * when the player has no season attempts. */
  attemptShare: number | null
  /** League share of league season attempts (leagueFga). */
  leagueAttemptShare: number
  /** Creation PPS (ADR-0001: PPS, never eFG%): (2·fg2m + 3·fg3m) / fga.
   * Null on zero attempts — no data is not a value claim (ADR-0013). */
  pps: number | null
  leaguePps: number | null
  /** Small-sample uncertainty flag on the conversion claim — the SAME
   * constant as the zone table's †, so the mark means one thing everywhere
   * (ADR-0031). Flags, never suppresses. */
  smallSamplePps: boolean
}

export interface GeneralContextRow extends CreationCells {
  context: GeneralContext
}

/** A summed rollup line with no single source context (the jumper parent). */
export type CreationRollupRow = CreationCells

export interface ClockBandRow extends CreationCells {
  band: ClockBand
  /** The band's seconds range ("24-15") — display material for labels. */
  seconds: string
}

export interface DefenderBandRow extends CreationCells {
  band: DefenderBand
  /** The band's feet range ("0-4") — display material for labels. */
  feet: string
}

/**
 * The General family re-presented at its TRUE two-tier shape: the NBA's
 * classifier only classifies jump shots outside 10 feet, so 'Less than
 * 10 ft' is a location bucket (creation unclassified at the rim) while
 * catch-and-shoot / pull-ups / the tiny 'Other' residual split the jumpers.
 * A flat four-row list reads as three creation categories plus an intruder;
 * the tier makes the taxonomy honest — and the jumper parent (summed
 * makes/attempts, the ADR-0016 combined-threes pattern) states the value of
 * his jump shooting as one line.
 */
/** One jumper kind's slice of the threes: its 3PA over all 3PA. Shares are
 * null when the respective side attempted no threes. */
export interface ThreeArrival {
  attempts: number
  totalThrees: number
  share: number | null
  leagueShare: number | null
}

export interface GeneralFamilyMetrics {
  /** 'Less than 10 ft' — rim & short; tracking classifies no creation here. */
  inside: GeneralContextRow
  /** 10 ft and out, all of it: Catch and Shoot + Pull Ups + Other, summed. */
  jumpers: CreationRollupRow
  /** The jumper children, in JUMPER_CONTEXTS order. */
  jumperContexts: GeneralContextRow[]
  /** How the THREES arrive — the bridge between the creation story and the
   * zone table's three-point verdict ("cold from three" means missing which
   * KIND of three?). Both real jumper kinds carry their slice so the split
   * is verifiable, not one-sided; the tiny Other residual's threes stay in
   * totalThrees without a line of their own. */
  catchAndShootThrees: ThreeArrival
  pullUpThrees: ThreeArrival
}

export interface CreationMetrics {
  /** ADR-0002: the comparison class travels with the numbers. */
  comparisonClass: 'league-average'
  /** The pre-drop season FGA every share is stated over. */
  seasonFga: number
  /** Attempts the Shot Clock family does not cover — reported whenever
   * nonzero, never guessed into a band (ADR-0019 pattern). */
  shotClockUnattributed: number
  /** Same coverage counter for the Closest Defender family (v2.1). */
  defenderUnattributed: number
  leagueFga: number
  leagueShotClockUnattributed: number
  leagueDefenderUnattributed: number
  /** The General family at its two-tier product grain. */
  general: GeneralFamilyMetrics
  /** The Shot Clock family at PRODUCT grain, in CLOCK_BAND_ROLLUP order. */
  shotClock: ClockBandRow[]
  /** The Closest Defender family at PRODUCT grain, in DEFENDER_BAND_ROLLUP order. */
  closestDefender: DefenderBandRow[]
}

function pps(fga: number, fg2m: number, fg3m: number): number | null {
  return fga > 0 ? (2 * fg2m + 3 * fg3m) / fga : null
}

function entryByContext(entries: ContextEntry[], context: string, side: string): ContextEntry {
  const entry = entries.find((e) => e.context === context)
  if (!entry) {
    // parseCreationPayload guarantees presence; a miss means the payload
    // bypassed the load boundary — fail loudly, never zero-fill here.
    throw new Error(`creation payload unusable: ${side} missing context '${context}'`)
  }
  return entry
}

function cells(
  player: Pick<ContextEntry, 'fga' | 'fgm' | 'fg2m' | 'fg3m'>,
  league: Pick<ContextEntry, 'fga' | 'fg2m' | 'fg3m'>,
  seasonFga: number,
  leagueFga: number,
): CreationCells {
  return {
    attempts: player.fga,
    makes: player.fgm,
    attemptShare: seasonFga > 0 ? player.fga / seasonFga : null,
    leagueAttemptShare: league.fga / leagueFga,
    pps: pps(player.fga, player.fg2m, player.fg3m),
    leaguePps: pps(league.fga, league.fg2m, league.fg3m),
    smallSamplePps: player.fga < SMALL_SAMPLE_MAKING_ATTEMPTS,
  }
}

/** Sum a band's constituent contexts — counts, never rates (ADR-0004). */
function sumContexts(entries: ContextEntry[], contexts: readonly string[], side: string) {
  let fga = 0
  let fgm = 0
  let fg2m = 0
  let fg3m = 0
  for (const context of contexts) {
    const e = entryByContext(entries, context, side)
    fga += e.fga
    fgm += e.fgm
    fg2m += e.fg2m
    fg3m += e.fg3m
  }
  return { fga, fgm, fg2m, fg3m }
}

export function aggregateCreationMetrics(payload: CreationPayload): CreationMetrics {
  const { seasonFga, shotClockUnattributed, leagueFga, leagueShotClockUnattributed } =
    payload._meta
  if (leagueFga === 0) {
    // A zero-attempt league baseline can price nothing — the contract is
    // broken (the Gate-1 ethos: an unpopulated baseline fails, it doesn't limp).
    throw new Error('creation baseline unusable: league FGA is 0')
  }

  const generalRow = (context: GeneralContext): GeneralContextRow => ({
    context,
    ...cells(
      entryByContext(payload.general.player, context, 'general.player'),
      entryByContext(payload.general.league, context, 'general.league'),
      seasonFga,
      leagueFga,
    ),
  })

  // The three-arrival bridge: counts of 3PA, summed within each side of the
  // family (self-consistent by construction — no cross-payload join).
  const totalThrees = payload.general.player.reduce((t, e) => t + e.fg3a, 0)
  const leagueTotalThrees = payload.general.league.reduce((t, e) => t + e.fg3a, 0)
  const threeArrival = (context: 'Catch and Shoot' | 'Pull Ups'): ThreeArrival => {
    const attempts = entryByContext(payload.general.player, context, 'general.player').fg3a
    const leagueAttempts = entryByContext(payload.general.league, context, 'general.league').fg3a
    return {
      attempts,
      totalThrees,
      share: totalThrees > 0 ? attempts / totalThrees : null,
      leagueShare: leagueTotalThrees > 0 ? leagueAttempts / leagueTotalThrees : null,
    }
  }

  const general: GeneralFamilyMetrics = {
    inside: generalRow(INSIDE_CONTEXT),
    // The jumper parent: summed counts on both sides (ADR-0004/0016 —
    // never averaged rates), so "his jump shooting vs the league's" is
    // stated at a grain with one number.
    jumpers: cells(
      sumContexts(payload.general.player, JUMPER_CONTEXTS, 'general.player'),
      sumContexts(payload.general.league, JUMPER_CONTEXTS, 'general.league'),
      seasonFga,
      leagueFga,
    ),
    jumperContexts: JUMPER_CONTEXTS.map(generalRow),
    catchAndShootThrees: threeArrival('Catch and Shoot'),
    pullUpThrees: threeArrival('Pull Ups'),
  }

  const shotClock: ClockBandRow[] = CLOCK_BAND_ROLLUP.map(({ band, seconds, contexts }) => ({
    band,
    seconds,
    ...cells(
      sumContexts(payload.shotClock.player, contexts, 'shotClock.player'),
      sumContexts(payload.shotClock.league, contexts, 'shotClock.league'),
      seasonFga,
      leagueFga,
    ),
  }))

  const closestDefender: DefenderBandRow[] = DEFENDER_BAND_ROLLUP.map(
    ({ band, feet, contexts }) => ({
      band,
      feet,
      ...cells(
        sumContexts(payload.closestDefender.player, contexts, 'closestDefender.player'),
        sumContexts(payload.closestDefender.league, contexts, 'closestDefender.league'),
        seasonFga,
        leagueFga,
      ),
    }),
  )

  return {
    comparisonClass: 'league-average',
    seasonFga,
    shotClockUnattributed,
    defenderUnattributed: payload._meta.defenderUnattributed,
    leagueFga,
    leagueShotClockUnattributed,
    leagueDefenderUnattributed: payload._meta.leagueDefenderUnattributed,
    general,
    shotClock,
    closestDefender,
  }
}
