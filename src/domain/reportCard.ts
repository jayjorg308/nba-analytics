// The team report card's pure module (docs/plans/jazz-first-site.md, the
// team report card; ADR-0088/0089): every number the card renders, computed
// by aggregateShotMetrics over slices of persisted rows (ADR-0009) — the
// game file's two sides under the game's own ruler, and every season dot as
// that game's slice of the team shot payload under that game's ruler from
// the season index. React formats; it never slices, tallies, or subtracts
// (ADR-0011).
//
// A dot and its card are the same function over the same rows and the same
// pairs, and buildReportCard proves it for tonight before returning: a card
// whose own numbers disagree with its quadrant dot is a contract failure,
// never a page.

import { aggregateShotMetrics } from './aggregate'
import type { ShotMetrics } from './aggregate'
import type { GamePayload, GameRuler, GameSide } from './gamePayload'
import type { IndexGame, TeamSeasonIndex } from './teamSeasonIndex'
import type { TeamShot, TeamShotPayload } from './teamShotPayload'

/** Season ranks join the two answers only from this many games so far: a
 * rank among a handful of games reads as a superlative of nothing (the
 * prototype's game one said "1st-best diet of 1 games so far"). Ten is a
 * tenth of a season and roughly three weeks of games. */
export const SEASON_RANK_MIN_GAMES = 10

/** One game on the quadrant: its card's two numbers, from its own ruler. */
export interface GameDot {
  gameId: string
  slug: string
  gameDate: string
  season: string
  opponent: string
  home: boolean
  won: boolean
  teamScore: number
  opponentScore: number
  metrics: ShotMetrics
}

export interface PlayerNight {
  playerId: number
  name: string
  points: number
  fgm: number
  fga: number
  ftm: number
  fta: number
  trips: number
  /** Priced attempts: evaluation-zone shots (heaves and conflicts excluded). */
  evalAttempts: number
  /** Field-goal points his priced attempts were worth at the ruler's league
   * rates (the diet-weighted expectation times his priced attempts); null
   * with no priced attempt. */
  expected: number | null
  /** Points scored on those same attempts; null with no priced attempt. */
  scored: number | null
}

export interface SideCard {
  teamId: number
  tricode: string
  team: string
  home: boolean
  score: number
  /** The side's shots under the game's ruler — both sides, one ruler. */
  metrics: ShotMetrics
  /** Attempt shares of priced shots (the zone rows' own shares). */
  shares: { rim: number | null; threes: number | null; mid: number | null }
  line: {
    trips: number
    shooting: number
    bonus: number
    andOne: number
    other: number
    ftm: number
    fta: number
    technicalFtm: number
    splitFtm: number
  }
  credit: { makes: number; assisted: number; unknown: number }
  /** Unpriced attempts: dropped zone-point conflicts (heaves are in metrics). */
  zoneConflicts: number
  /** Everyone who attempted a field goal or a free throw, scorers first. */
  players: PlayerNight[]
}

export interface ReportCard {
  gameId: string
  slug: string
  gameDate: string
  season: string
  won: boolean
  subject: SideCard
  opponent: SideCard
  ruler: GameRuler
  /** The current season's games through tonight, chronological. */
  dots: GameDot[]
  tonight: GameDot
  /** The prior season's games, when that season is published. */
  priorDots: GameDot[]
  priorSeason: string | null
  /** Tonight's rank among the season's games so far (1 = highest delta;
   * ties share a rank); null below SEASON_RANK_MIN_GAMES. */
  ranks: { games: number; selection: number; making: number } | null
}

export function gameSlug(gameDate: string, opponent: string): string {
  return `${gameDate}-${opponent.toLowerCase()}`
}

/** Every published game of a season as a dot: its slice of the team shot
 * payload priced against its own ruler from the index. */
export function seasonDots(index: TeamSeasonIndex, payload: TeamShotPayload): GameDot[] {
  const im = index._meta
  const pm = payload._meta
  if (im.teamId !== pm.teamId || im.season !== pm.season || im.seasonType !== pm.seasonType) {
    throw new Error(`season index (${im.team} ${im.season}) and team payload (${pm.team} ${pm.season}) disagree`)
  }
  const byGame = new Map<string, TeamShot[]>()
  for (const s of payload.shots) {
    const slice = byGame.get(s.gameId)
    if (slice === undefined) byGame.set(s.gameId, [s])
    else slice.push(s)
  }
  if (byGame.size !== index.games.length) {
    throw new Error(`team payload has ${byGame.size} games, the index ${index.games.length}`)
  }
  return index.games.map((g: IndexGame) => {
    const slice = byGame.get(g.gameId)
    if (slice === undefined) throw new Error(`index game ${g.gameId} has no rows in the team payload`)
    return {
      gameId: g.gameId,
      slug: g.slug,
      gameDate: g.gameDate,
      season: im.season,
      opponent: g.opponent,
      home: g.home,
      won: g.teamScore > g.opponentScore,
      teamScore: g.teamScore,
      opponentScore: g.opponentScore,
      metrics: aggregateShotMetrics(slice, g.ruler.zoneBaseline),
    }
  })
}

const SHOOTING = new Set(['shootingFoul2', 'shootingFoul3'])

function sideCard(side: GameSide, game: GamePayload): SideCard {
  const metrics = aggregateShotMetrics(side.shots, game.zoneBaseline)
  const zone = (z: string) => metrics.zones.find((r) => r.zone === z)!.attemptShare
  const players: PlayerNight[] = side.players
    .filter((p) => p.fga > 0 || p.fta > 0)
    .map((p) => {
      const own = aggregateShotMetrics(
        side.shots.filter((s) => s.playerId === p.playerId),
        game.zoneBaseline,
      )
      const priced = own.evalAttempts > 0
      return {
        playerId: p.playerId,
        name: p.name,
        points: p.points,
        fgm: p.fgm,
        fga: p.fga,
        ftm: p.ftm,
        fta: p.fta,
        trips: side.trips.filter((t) => t.playerId === p.playerId).length,
        evalAttempts: own.evalAttempts,
        expected: priced ? own.selection.playerDietExpectedPps! * own.evalAttempts : null,
        scored: priced ? own.making.actualPps! * own.evalAttempts : null,
      }
    })
    .sort((a, b) => b.points - a.points || b.fga - a.fga || a.name.localeCompare(b.name))
  const makes = side.shots.filter((s) => s.made)
  return {
    teamId: side.teamId,
    tricode: side.tricode,
    team: side.team,
    home: side.home,
    score: side.box.points,
    metrics,
    shares: { rim: zone('Restricted Area'), threes: metrics.threes.attemptShare, mid: zone('Mid-Range') },
    line: {
      trips: side.trips.length,
      shooting: side.trips.filter((t) => SHOOTING.has(t.tripClass)).length,
      bonus: side.trips.filter((t) => t.tripClass === 'bonus').length,
      andOne: side.trips.filter((t) => t.tripClass === 'andOne').length,
      other: side.trips.filter((t) => !SHOOTING.has(t.tripClass) && t.tripClass !== 'bonus' && t.tripClass !== 'andOne').length,
      ftm: side.box.ftm,
      fta: side.box.fta,
      technicalFtm: side.players.reduce((n, p) => n + p.technicalFtm, 0),
      splitFtm: side.players.reduce((n, p) => n + p.splitFtm, 0),
    },
    credit: {
      makes: makes.length,
      assisted: makes.filter((s) => s.assistStatus === 'assisted').length,
      unknown: makes.filter((s) => s.assistStatus === 'unknown').length,
    },
    zoneConflicts: side.zoneConflicts.length,
    players,
  }
}

/** 1 + the games with a strictly higher value: ties share the better rank. */
function rankOf(dots: GameDot[], tonight: GameDot, value: (m: ShotMetrics) => number | null): number {
  const mine = value(tonight.metrics)!
  return 1 + dots.filter((d) => value(d.metrics)! > mine).length
}

export function buildReportCard(
  game: GamePayload,
  index: TeamSeasonIndex,
  payload: TeamShotPayload,
  prior?: { index: TeamSeasonIndex; payload: TeamShotPayload },
): ReportCard {
  const m = game._meta
  if (m.teamId !== index._meta.teamId || m.season !== index._meta.season) {
    throw new Error(`game ${m.gameId} is not a ${index._meta.team} ${index._meta.season} game`)
  }
  const all = seasonDots(index, payload)
  const tonight = all.find((d) => d.gameId === m.gameId)
  if (tonight === undefined) throw new Error(`game ${m.gameId} is not in the season index`)
  const subject = sideCard(game.sides[0], game)
  const opponent = sideCard(game.sides[1], game)
  const card = subject.metrics
  if (
    card.selection.selectionDelta !== tonight.metrics.selection.selectionDelta ||
    card.making.makingPpsDelta !== tonight.metrics.making.makingPpsDelta
  ) {
    throw new Error(`game ${m.gameId}: the card's numbers disagree with its quadrant dot`)
  }
  // The season as it stood after tonight: a shared card's quadrant and
  // ranks never move once later games are played.
  const dots = all.filter((d) => d.gameDate <= m.gameDate)
  const ranks =
    dots.length >= SEASON_RANK_MIN_GAMES
      ? {
          games: dots.length,
          selection: rankOf(dots, tonight, (x) => x.selection.selectionDelta),
          making: rankOf(dots, tonight, (x) => x.making.makingPpsDelta),
        }
      : null
  return {
    gameId: m.gameId,
    slug: gameSlug(m.gameDate, m.opponentTricode),
    gameDate: m.gameDate,
    season: m.season,
    won: subject.score > opponent.score,
    subject,
    opponent,
    ruler: m.ruler,
    dots,
    tonight,
    priorDots: prior ? seasonDots(prior.index, prior.payload) : [],
    priorSeason: prior ? prior.index._meta.season : null,
    ranks,
  }
}
