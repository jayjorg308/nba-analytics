// A team player's running season (docs/plans/jazz-home-transition.md,
// decisions 10, 13, and 18; ADR-0095): the pure module behind the player
// season page, /jazz/<player-slug> and /jazz/<season>/<player-slug>. Every
// number is aggregateShotMetrics over his rows (ADR-0009): the season over
// all of them against the season's frontier ruler, the way the team page
// prices the season; each game over that game's rows against that game's
// own pre-game ruler from the season index (ADR-0089), the way his line on
// the report card is priced, so a game's numbers here equal the card's.
// React formats; it never slices, tallies, or subtracts (ADR-0011).
//
// Who has a page: every player with a shot for the team in the season
// (decision 10), rostered or departed. A player's slug is his name, folded
// (playerSlug); two shooters sharing a slug in one season is a contract
// failure, never a silent overwrite.

import { aggregateShotMetrics } from './aggregate'
import type { ShotMetrics } from './aggregate'
import type { GameDot } from './reportCard'
import type { IndexPlayer, TeamSeasonIndex } from './teamSeasonIndex'
import type { TeamShot, TeamShotPayload } from './teamShotPayload'

/** A player's URL segment: his name lowercased with diacritics folded and
 * punctuation dropped, words joined by hyphens. "Moussa Cissé" ->
 * moussa-cisse; "Terrence Shannon Jr." -> terrence-shannon-jr, so the feed's
 * 2026-10-27 rename to "Jr" keeps the URL. Hero slugs follow the same rule,
 * so a hero's headshot and his tool page share one name. */
export function playerSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
}

export interface PlayerOnFile {
  playerId: number
  name: string
  slug: string
  /** Shots for the team this season (post-drop rows). */
  shots: number
}

/** Every player with a shot for the team in the season, most shots first
 * (then name). Throws when two share a slug. */
export function seasonShooters(payload: TeamShotPayload): PlayerOnFile[] {
  const byId = new Map<number, PlayerOnFile>()
  for (const s of payload.shots) {
    const p = byId.get(s.playerId)
    if (p === undefined) byId.set(s.playerId, { playerId: s.playerId, name: s.playerName, slug: playerSlug(s.playerName), shots: 1 })
    else p.shots += 1
  }
  const players = [...byId.values()].sort((a, b) => b.shots - a.shots || a.name.localeCompare(b.name))
  const seen = new Map<string, string>()
  for (const p of players) {
    const other = seen.get(p.slug)
    if (other !== undefined) throw new Error(`${p.name} and ${other} share the slug ${p.slug}`)
    seen.set(p.slug, p.name)
  }
  return players
}

/** One game he appeared in: the game's identity, his box line, and his
 * priced numbers under that game's ruler (null without a priced attempt). */
export interface PlayerGameRow {
  gameId: string
  slug: string
  gameDate: string
  opponent: string
  home: boolean
  won: boolean
  teamScore: number
  opponentScore: number
  line: IndexPlayer
  /** His slice of the game under its own ruler; null with no shot. */
  metrics: ShotMetrics | null
  /** Field-goal points his priced attempts were worth at the ruler's
   * league rates, and the points he scored on them (reportCard.ts's
   * PlayerNight, the same arithmetic); null with no priced attempt. */
  expected: number | null
  scored: number | null
}

export interface PlayerSeason {
  player: PlayerOnFile
  season: string
  dataThrough: string
  /** His jersey number on the season's roster snapshot; null when he has
   * left the roster or the source leaves it blank. */
  number: string | null
  onRoster: boolean
  /** His season against the frontier ruler (the team payload's). */
  metrics: ShotMetrics
  /** Zone-point conflicts dropped from his attempts (ADR-0019): his box
   * FGA over the games less his shot rows. */
  zoneConflicts: number
  /** Every game he appeared in, chronological. */
  games: PlayerGameRow[]
  /** The quadrant: the games with a priced attempt, each at its own ruler. */
  dots: GameDot[]
  /** His prior season's dots, when that season is published and he shot
   * for the team in it. */
  priorDots: GameDot[]
  priorSeason: string | null
}

function gameDots(rows: PlayerGameRow[], season: string): GameDot[] {
  return rows
    .filter((r) => r.metrics !== null && r.metrics.evalAttempts > 0)
    .map((r) => ({
      gameId: r.gameId,
      slug: r.slug,
      gameDate: r.gameDate,
      season,
      opponent: r.opponent,
      home: r.home,
      won: r.won,
      teamScore: r.teamScore,
      opponentScore: r.opponentScore,
      metrics: r.metrics!,
    }))
}

function gameRows(playerId: number, payload: TeamShotPayload, index: TeamSeasonIndex): PlayerGameRow[] {
  const im = index._meta
  const pm = payload._meta
  if (im.teamId !== pm.teamId || im.season !== pm.season || im.seasonType !== pm.seasonType) {
    throw new Error(`season index (${im.team} ${im.season}) and team payload (${pm.team} ${pm.season}) disagree`)
  }
  const mine = new Map<string, TeamShot[]>()
  for (const s of payload.shots) {
    if (s.playerId !== playerId) continue
    const slice = mine.get(s.gameId)
    if (slice === undefined) mine.set(s.gameId, [s])
    else slice.push(s)
  }
  const rows: PlayerGameRow[] = []
  for (const g of index.games) {
    const line = g.players.find((p) => p.playerId === playerId)
    const shots = mine.get(g.gameId) ?? []
    if (line === undefined) {
      if (shots.length > 0) throw new Error(`player ${playerId} has shots in ${g.gameId} but no box line`)
      continue
    }
    const metrics = shots.length > 0 ? aggregateShotMetrics(shots, g.ruler.zoneBaseline) : null
    const priced = metrics !== null && metrics.evalAttempts > 0
    rows.push({
      gameId: g.gameId,
      slug: g.slug,
      gameDate: g.gameDate,
      opponent: g.opponent,
      home: g.home,
      won: g.teamScore > g.opponentScore,
      teamScore: g.teamScore,
      opponentScore: g.opponentScore,
      line,
      metrics,
      expected: priced ? metrics.selection.playerDietExpectedPps! * metrics.evalAttempts : null,
      scored: priced ? metrics.making.actualPps! * metrics.evalAttempts : null,
    })
  }
  for (const gameId of mine.keys()) {
    if (!index.games.some((g) => g.gameId === gameId)) {
      throw new Error(`player ${playerId} has shots in ${gameId}, which the season index does not list`)
    }
  }
  return rows
}

export function buildPlayerSeason(
  slug: string,
  payload: TeamShotPayload,
  index: TeamSeasonIndex,
  prior?: { index: TeamSeasonIndex; payload: TeamShotPayload },
): PlayerSeason | null {
  const player = seasonShooters(payload).find((p) => p.slug === slug)
  if (player === undefined) return null
  const games = gameRows(player.playerId, payload, index)
  const shots = payload.shots.filter((s) => s.playerId === player.playerId)
  const boxFga = games.reduce((n, g) => n + g.line.fga, 0)
  const rostered = payload.roster.find((r) => r.playerId === player.playerId)
  const priorPlayer = prior ? seasonShooters(prior.payload).find((p) => p.playerId === player.playerId) : undefined
  return {
    player,
    season: payload._meta.season,
    dataThrough: payload._meta.dataThrough,
    number: rostered && rostered.number !== '' ? rostered.number : null,
    onRoster: rostered !== undefined,
    metrics: aggregateShotMetrics(shots, payload.zoneBaseline),
    zoneConflicts: boxFga - shots.length,
    games,
    dots: gameDots(games, payload._meta.season),
    priorDots:
      prior && priorPlayer
        ? gameDots(gameRows(priorPlayer.playerId, prior.payload, prior.index), prior.payload._meta.season)
        : [],
    priorSeason: prior && priorPlayer ? prior.payload._meta.season : null,
  }
}
