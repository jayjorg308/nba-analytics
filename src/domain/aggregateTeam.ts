// The team-level pure module (ADR-0081/0084, the Jazz surface plan): accepts
// the parsed team shot payload and its season index (the game ledger's rows
// come from the index since ADR-0087 retired the ledger file), enforces
// their identities, and computes every number the team surface
// renders by calling aggregateShotMetrics over slices of the SAME rows — the
// whole season for the profile (the frontier ruler, the season's league),
// one game's rows for each game row under THAT game's pre-game ruler from
// the index (ADR-0089), so a ledger row always shows its card's numbers.
// React never slices, never tallies, never subtracts (ADR-0011); selection
// and making math stays aggregateShotMetrics's alone (ADR-0009).

import { aggregateShotMetrics } from './aggregate'
import type { ShotMetrics } from './aggregate'
import { SMALL_SAMPLE_MAKING_ATTEMPTS } from './constants'
import type { TeamSeasonIndex } from './teamSeasonIndex'
import type { TeamShotPayload } from './teamShotPayload'

/** One game row (ADR-0084, read from the season index since ADR-0087):
 * the box facts joined to the decomposition over that game's slice of the
 * team payload. */
export interface TeamGameRow {
  gameId: string
  /** The report card's URL segment, from the season index. */
  slug: string
  gameDate: string
  opponent: string
  home: boolean
  teamScore: number
  opponentScore: number
  won: boolean
  fgm: number
  fga: number
  ftm: number
  fta: number
  /** Post-drop rows in the team payload for this game (the attempts the
   * decomposition sees). */
  shots: number
  /** The game's slice under its own pre-game ruler: its card's numbers. */
  metrics: ShotMetrics
  /** The game's evaluation attempts fall under the making bar: the headline
   * pair renders with its count and a plain note (ADR-0081/0084). */
  thinSample: boolean
}

export interface TeamMetrics {
  team: string
  tricode: string
  season: string
  dataThrough: string
  games: number
  shots: number
  zoneConflictsDropped: number
  /** The season-to-date profile: one aggregation over every row. */
  profile: ShotMetrics
  /** Newest game first. */
  ledger: readonly TeamGameRow[]
  gameById: ReadonlyMap<string, TeamGameRow>
}

export function aggregateTeam(payload: TeamShotPayload, index: TeamSeasonIndex): TeamMetrics {
  const pm = payload._meta
  const im = index._meta
  if (pm.teamId !== im.teamId || pm.season !== im.season || pm.seasonType !== im.seasonType) {
    throw new Error(`team payload (${pm.team} ${pm.season}) and season index (${im.team} ${im.season}) disagree`)
  }
  if (pm.gamesIncluded !== im.gamesIncluded) {
    throw new Error(`team payload counts ${pm.gamesIncluded} games, the season index ${im.gamesIncluded}`)
  }

  const byGame = new Map<string, TeamShotPayload['shots']>()
  for (const s of payload.shots) {
    const slice = byGame.get(s.gameId)
    if (slice === undefined) byGame.set(s.gameId, [s])
    else slice.push(s)
  }
  const indexIds = new Set(index.games.map((g) => g.gameId))
  for (const gameId of byGame.keys()) {
    if (!indexIds.has(gameId)) throw new Error(`payload game ${gameId} missing from the season index`)
  }
  if (indexIds.size !== byGame.size) {
    throw new Error(`season index lists ${indexIds.size} games, payload has ${byGame.size}`)
  }

  let boxFga = 0
  const rows: TeamGameRow[] = index.games.map((g) => {
    const slice = byGame.get(g.gameId)!
    if (g.box.fga < slice.length) {
      throw new Error(`game ${g.gameId}: box FGA ${g.box.fga} < ${slice.length} payload rows`)
    }
    boxFga += g.box.fga
    const metrics = aggregateShotMetrics(slice, g.ruler.zoneBaseline)
    return {
      gameId: g.gameId,
      slug: g.slug,
      gameDate: g.gameDate,
      opponent: g.opponent,
      home: g.home,
      teamScore: g.teamScore,
      opponentScore: g.opponentScore,
      won: g.teamScore > g.opponentScore,
      fgm: g.box.fgm,
      fga: g.box.fga,
      ftm: g.box.ftm,
      fta: g.box.fta,
      shots: slice.length,
      metrics,
      thinSample: metrics.evalAttempts < SMALL_SAMPLE_MAKING_ATTEMPTS,
    }
  })
  // The box oracle at season grain (ADR-0084), re-run at the load boundary.
  if (boxFga !== pm.totalShots + pm.zoneConflictsDropped) {
    throw new Error(
      `season index box FGA (${boxFga}) != payload pre-drop total (${pm.totalShots + pm.zoneConflictsDropped})`,
    )
  }

  const newestFirst = [...rows].reverse()
  return {
    team: pm.team,
    tricode: pm.tricode,
    season: pm.season,
    dataThrough: pm.dataThrough,
    games: pm.gamesIncluded,
    shots: pm.totalShots,
    zoneConflictsDropped: pm.zoneConflictsDropped,
    profile: aggregateShotMetrics(payload.shots, payload.zoneBaseline),
    ledger: newestFirst,
    gameById: new Map(newestFirst.map((r) => [r.gameId, r])),
  }
}

/** The season a game id encodes (digits 4-5 are the season's start year):
 * the game page resolves its season from the id alone. */
export function seasonOfGameId(gameId: string): string {
  const start = 2000 + Number(gameId.slice(3, 5))
  return `${start}-${String(start + 1).slice(-2)}`
}
