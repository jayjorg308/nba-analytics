// The game card's numbers (ADR-0086), computed from a game-log payload —
// the aggregation-function pattern (ADR-0009): pure, tested, presentation
// formats and never computes (ADR-0011). Pricing follows the house rules:
// league PPS per zone from summed pairs, never averaged rates (ADR-0004);
// only evaluation-consistent shots price (the ADR-0019 boundary at game
// grain); conversion is what happened, never an ability estimate.

import type { CardGame, GameLogPayload } from './gameLogPayload'
import { shotPrices } from './gameLogPayload'
import { ZONE_POINT_VALUE } from './constants'
import type { EvalZone } from './constants'

export interface GameCardNumbers {
  /** Priced attempts (evaluation-consistent shots). */
  pricedAttempts: number
  /** Attempts outside pricing (heaves, zone-point conflicts). */
  unpricedAttempts: number
  /** Σ league PPS over his priced attempts: what the night's choices were
   * worth at league rates. */
  expectedPts: number
  /** Points actually scored on the priced attempts. */
  scoredPts: number
  /** Points from unpriced attempts (a made heave is real points — the
   * receipt carries them; the poster's pricing never does). */
  unpricedPts: number
  /** The same attempts priced at the league's own diet: the selection
   * reference the poster shows as its quiet fourth number. */
  leagueExpectedPts: number
  /** League PPS per evaluation zone, from the embedded pairs. */
  leaguePps: Record<EvalZone, number>
  /** Free-throw points from trips (technicals excluded — they are counted
   * on the receipt's own line). */
  tripPts: number
  tripCount: number
  /** What the night's trips price at league conversion (Points per trip's
   * '(lg)': free throws awarded × league FT%, ADR-0055 endpoint parity). */
  tripExpectedPts: number
  /** League free-throw conversion, for per-trip pricing on the receipt. */
  leagueFtPct: number
  assisted: number
  unassisted: number
  unknownMakes: number
}

export function computeGameCard(
  game: CardGame,
  { leagueBaseline, leagueFreeThrows }: Pick<
    GameLogPayload,
    'leagueBaseline' | 'leagueFreeThrows'
  >,
): GameCardNumbers {
  const leaguePps = {} as Record<EvalZone, number>
  let leagueMakesValue = 0
  let leagueFga = 0
  for (const pair of leagueBaseline) {
    leaguePps[pair.zone] = (ZONE_POINT_VALUE[pair.zone] * pair.fgm) / pair.fga
    leagueMakesValue += ZONE_POINT_VALUE[pair.zone] * pair.fgm
    leagueFga += pair.fga
  }
  const leagueDietPps = leagueMakesValue / leagueFga

  let pricedAttempts = 0
  let unpricedAttempts = 0
  let expectedPts = 0
  let scoredPts = 0
  let unpricedPts = 0
  let assisted = 0
  let unassisted = 0
  let unknownMakes = 0
  for (const shot of game.shots) {
    if (shotPrices(shot)) {
      pricedAttempts += 1
      expectedPts += leaguePps[shot.zone as EvalZone]
      if (shot.made) scoredPts += shot.value
    } else {
      unpricedAttempts += 1
      if (shot.made) unpricedPts += shot.value
    }
    if (shot.assist === 'assisted') assisted += 1
    if (shot.assist === 'unassisted') unassisted += 1
    if (shot.assist === 'unknown') unknownMakes += 1
  }

  return {
    pricedAttempts,
    unpricedAttempts,
    expectedPts,
    scoredPts,
    unpricedPts,
    leagueExpectedPts: pricedAttempts * leagueDietPps,
    leaguePps,
    tripPts: game.trips.reduce((s, t) => s + t.ftm, 0),
    tripCount: game.trips.length,
    tripExpectedPts:
      game.trips.reduce((s, t) => s + t.fta, 0) *
      (leagueFreeThrows.ftm / leagueFreeThrows.fta),
    leagueFtPct: leagueFreeThrows.ftm / leagueFreeThrows.fta,
    assisted,
    unassisted,
    unknownMakes,
  }
}
