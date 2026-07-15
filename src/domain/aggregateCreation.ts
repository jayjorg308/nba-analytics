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
import { GENERAL_CONTEXTS } from './creationPayload'

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

export interface ClockBandRow extends CreationCells {
  band: ClockBand
  /** The band's seconds range ("24-15") — display material for labels. */
  seconds: string
}

export interface CreationMetrics {
  /** ADR-0002: the comparison class travels with the numbers. */
  comparisonClass: 'league-average'
  /** The pre-drop season FGA every share is stated over. */
  seasonFga: number
  /** Attempts the Shot Clock family does not cover — reported whenever
   * nonzero, never guessed into a band (ADR-0019 pattern). */
  shotClockUnattributed: number
  leagueFga: number
  leagueShotClockUnattributed: number
  /** The General family at NBA grain, in GENERAL_CONTEXTS order. */
  general: GeneralContextRow[]
  /** The Shot Clock family at PRODUCT grain, in CLOCK_BAND_ROLLUP order. */
  shotClock: ClockBandRow[]
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

  const general: GeneralContextRow[] = GENERAL_CONTEXTS.map((context) => ({
    context,
    ...cells(
      entryByContext(payload.general.player, context, 'general.player'),
      entryByContext(payload.general.league, context, 'general.league'),
      seasonFga,
      leagueFga,
    ),
  }))

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

  return {
    comparisonClass: 'league-average',
    seasonFga,
    shotClockUnattributed,
    leagueFga,
    leagueShotClockUnattributed,
    general,
    shotClock,
  }
}
