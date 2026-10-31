// A player's night (docs/plans/jazz-home-transition.md, Stage 4; ADR-0096):
// the pure module behind /jazz/<game-slug>/<player-slug>. One of the team's
// players in one game as priced facts, read from the game file the report
// card reads (ADR-0088) and priced against that game's own pre-game ruler
// (ADR-0089): his two answers, his receipt down to the box total, his line
// and his credit unpriced, and his season's quadrant through this game.
// React formats; it never slices, tallies, or subtracts (ADR-0011).
//
// A night, his dot, and his game-log row are the same function over the same
// rows and the same pairs, and buildPlayersNight proves it before returning:
// a night whose numbers disagree with his season page is a contract failure,
// never a page.
//
// Who has a night: every player with a box line on the subject side, his
// appearances without an attempt included (decision 1). An opponent's night
// is not a page.

import { aggregateShotMetrics } from './aggregate'
import type { ShotMetrics } from './aggregate'
import { EVAL_ZONES } from './constants'
import type { BasicZone } from './constants'
import { TRIP_CLASSES } from './freethrowPayload'
import type { TripClass } from './freethrowPayload'
import type { GamePayload, GamePlayer, GameRuler, GameShot, GameTrip } from './gamePayload'
import { buildPlayerSeason, playerSlug, seasonShooters } from './playerSeason'
import { gameSlug } from './reportCard'
import type { GameDot } from './reportCard'
import type { TeamSeasonIndex } from './teamSeasonIndex'
import type { TeamShotPayload } from './teamShotPayload'

/** One line of the receipt. `clock` is the seconds left in the period. A
 * shot's price is its zone's league points per shot under the game's ruler
 * (null for a heave, which leaves the evaluation); a zone-point conflict is
 * dropped from shots[] at export (ADR-0019) and never priced; a trip carries
 * no price, since the ruler holds field-goal rates only (decision 3). */
export type ReceiptLine =
  | { kind: 'shot'; period: number; clock: number; shot: GameShot; price: number | null }
  | { kind: 'conflict'; period: number; clock: number; made: boolean; pointValue: 2 | 3; zone: BasicZone }
  | { kind: 'trip'; period: number; clock: number; trip: GameTrip }

export interface PlayersNight {
  gameId: string
  slug: string
  gameDate: string
  season: string
  opponent: string
  home: boolean
  won: boolean
  teamScore: number
  opponentScore: number
  ruler: GameRuler
  player: { playerId: number; name: string; slug: string }
  /** His box line, with the technical and split free throws the trip
   * grammar counted for him (never trips, ADR-0053/0055). */
  line: GamePlayer
  /** His shot rows, the court's: heaves included, conflicts dropped. */
  shots: GameShot[]
  /** His shots under the game's ruler; null with no shot. */
  metrics: ShotMetrics | null
  /** Evaluation-zone attempts: heaves and conflicts are outside both answers. */
  evalAttempts: number
  heaves: number
  zoneConflicts: number
  /** Field-goal points his priced attempts were worth at the ruler's league
   * rates, and the points he scored on them; null with no priced attempt.
   * His game-log row's numbers and his line on the report card. */
  expected: number | null
  scored: number | null
  /** Every attempt and trip in game order (period, then the clock running
   * down; a shot before the trip it drew). Technical and split free throws
   * belong to no trip and close the receipt on their own lines. */
  receipt: ReceiptLine[]
  /** THE LINE: his trips, their free-throw points, and their classes in
   * TRIP_CLASSES order. The free-throw line itself is his box line's. */
  trips: { count: number; points: number; byClass: { tripClass: TripClass; count: number }[] }
  /** THE CREDIT: his makes by assist status (ADR-0032), conflicts aside. */
  credit: { makes: number; assisted: number; unassisted: number; unknown: number }
  /** Whether he has a season page: a shot for the team this season
   * (ADR-0095). A player with free throws only has nights but no season. */
  hasSeasonPage: boolean
  /** His quadrant as it stood after this game, so a shared night never
   * moves: his games with a priced shot through this one, this one's dot
   * (null without a priced shot), and his prior season's games behind. */
  dots: GameDot[]
  tonight: GameDot | null
  priorDots: GameDot[]
  priorSeason: string | null
}

function tripClock(clock: string): number {
  const m = /^PT(\d{2})M(\d{2}(?:\.\d{1,2})?)S$/.exec(clock)
  if (m === null) throw new Error(`unreadable trip clock ${clock}`)
  return Number(m[1]) * 60 + Number(m[2])
}

const isEval = (zone: string) => (EVAL_ZONES as readonly string[]).includes(zone)

/** Game order: period, then the clock running down; at one instant a field
 * goal before the free throws it drew. */
function byGameOrder(a: ReceiptLine, b: ReceiptLine): number {
  return a.period - b.period || b.clock - a.clock || Number(a.kind === 'trip') - Number(b.kind === 'trip')
}

export function buildPlayersNight(
  slug: string,
  game: GamePayload,
  index: TeamSeasonIndex,
  payload: TeamShotPayload,
  prior?: { index: TeamSeasonIndex; payload: TeamShotPayload },
): PlayersNight | null {
  const m = game._meta
  if (m.teamId !== index._meta.teamId || m.season !== index._meta.season) {
    throw new Error(`game ${m.gameId} is not a ${index._meta.team} ${index._meta.season} game`)
  }
  const row = index.games.find((g) => g.gameId === m.gameId)
  if (row === undefined) throw new Error(`game ${m.gameId} is not in the season index`)
  const side = game.sides[0]
  const named = side.players.filter((p) => playerSlug(p.name) === slug)
  if (named.length > 1) throw new Error(`${named.map((p) => p.name).join(' and ')} share the slug ${slug} in ${m.gameId}`)
  const line = named[0]
  if (line === undefined) return null

  const id = line.playerId
  const shots = side.shots.filter((s) => s.playerId === id)
  const conflicts = side.zoneConflicts.filter((c) => c.playerId === id)
  const trips = side.trips.filter((t) => t.playerId === id)
  const metrics = shots.length > 0 ? aggregateShotMetrics(shots, game.zoneBaseline) : null
  const evalAttempts = metrics?.evalAttempts ?? 0
  const priced = metrics !== null && evalAttempts > 0
  const leaguePps = new Map<string, number>(metrics?.zones.map((z) => [z.zone, z.leaguePps]) ?? [])

  const receipt: ReceiptLine[] = [
    ...shots.map((shot) => ({
      kind: 'shot' as const,
      period: shot.period,
      clock: shot.minutesRemaining * 60 + shot.secondsRemaining,
      shot,
      price: isEval(shot.zoneBasic) ? leaguePps.get(shot.zoneBasic)! : null,
    })),
    ...conflicts.map((c) => ({
      kind: 'conflict' as const,
      period: c.period,
      clock: c.minutesRemaining * 60 + c.secondsRemaining,
      made: c.made,
      pointValue: c.pointValue,
      zone: c.zoneBasic,
    })),
    ...trips.map((trip) => ({ kind: 'trip' as const, period: trip.period, clock: tripClock(trip.clock), trip })),
  ].sort(byGameOrder)

  const makes = shots.filter((s) => s.made)
  const expected = priced ? metrics.selection.playerDietExpectedPps! * evalAttempts : null
  const scored = priced ? metrics.making.actualPps! * evalAttempts : null

  // His season, found by id: the night's slug is the game file's name for
  // him, his season page's the team payload's, and both fold the same way.
  const shooter = seasonShooters(payload).find((p) => p.playerId === id)
  const ps = shooter === undefined ? null : buildPlayerSeason(shooter.slug, payload, index, prior)
  const tonight = ps?.dots.find((d) => d.gameId === m.gameId) ?? null
  const logRow = ps?.games.find((g) => g.gameId === m.gameId)
  if (ps !== null && logRow === undefined) throw new Error(`${line.name}: ${m.gameId} is missing from his game log`)
  if (priced !== (tonight !== null)) throw new Error(`${line.name} in ${m.gameId}: the night and his quadrant disagree on a dot`)
  if (
    tonight !== null &&
    (metrics!.selection.selectionDelta !== tonight.metrics.selection.selectionDelta ||
      metrics!.making.makingPpsDelta !== tonight.metrics.making.makingPpsDelta)
  ) {
    throw new Error(`${line.name} in ${m.gameId}: the night's numbers disagree with his dot`)
  }
  if (logRow !== undefined && (logRow.expected !== expected || logRow.scored !== scored)) {
    throw new Error(`${line.name} in ${m.gameId}: the night's numbers disagree with his game-log row`)
  }

  return {
    gameId: m.gameId,
    slug: gameSlug(m.gameDate, m.opponentTricode),
    gameDate: m.gameDate,
    season: m.season,
    opponent: m.opponentTricode,
    home: m.home,
    won: row.teamScore > row.opponentScore,
    teamScore: row.teamScore,
    opponentScore: row.opponentScore,
    ruler: m.ruler,
    player: { playerId: id, name: line.name, slug },
    line,
    shots,
    metrics,
    evalAttempts,
    heaves: metrics?.backcourt.attempts ?? 0,
    zoneConflicts: conflicts.length,
    expected,
    scored,
    receipt,
    trips: {
      count: trips.length,
      points: trips.reduce((n, t) => n + t.ftm, 0),
      byClass: TRIP_CLASSES.map((tripClass) => ({
        tripClass,
        count: trips.filter((t) => t.tripClass === tripClass).length,
      })).filter((c) => c.count > 0),
    },
    credit: {
      makes: makes.length,
      assisted: makes.filter((s) => s.assistStatus === 'assisted').length,
      unassisted: makes.filter((s) => s.assistStatus === 'unassisted').length,
      unknown: makes.filter((s) => s.assistStatus === 'unknown').length,
    },
    hasSeasonPage: ps !== null,
    // The season as it stood after this game, the report card's rule.
    dots: ps?.dots.filter((d) => d.gameDate <= m.gameDate) ?? [],
    tonight,
    priorDots: ps?.priorDots ?? [],
    priorSeason: ps?.priorSeason ?? null,
  }
}
