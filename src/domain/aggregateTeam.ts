// The team-level pure module (ADR-0081/0084, the Jazz surface plan): accepts
// the parsed team shot payload and its ledger facts, enforces their
// identities, and computes every number the team surface renders by calling
// aggregateShotMetrics over slices of the SAME rows — the whole season for
// the profile, one game's rows for each game row. React never slices, never
// tallies, never subtracts (ADR-0011); selection and making math stays
// aggregateShotMetrics's alone (ADR-0009).

import { aggregateShotMetrics } from './aggregate'
import type { ShotMetrics } from './aggregate'
import { SMALL_SAMPLE_MAKING_ATTEMPTS } from './constants'
import type { LedgerFacts } from './ledgerFacts'
import type { TeamShotPayload } from './teamShotPayload'

export interface TeamPlayerLine {
  playerId: number
  playerName: string
  fgm: number
  fga: number
  ftm: number
  fta: number
  points: number
}

/** One game row (ADR-0084): the box facts joined to the decomposition over
 * that game's slice of the team payload. */
export interface TeamGameRow {
  gameId: string
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
  metrics: ShotMetrics
  /** The game's evaluation attempts fall under the making bar: the headline
   * pair renders with its count and a plain note (ADR-0081/0084). */
  thinSample: boolean
  /** Everyone who attempted a field goal, highest scorers first. */
  players: TeamPlayerLine[]
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

/** A player's display name from the payload: the roster's spelling first,
 * then the shot rows'. Every ledger player attempted a field goal, so the
 * box oracle guarantees rows and therefore a name (ADR-0084). */
function nameIndex(payload: TeamShotPayload): Map<number, string> {
  const names = new Map<number, string>()
  for (const s of payload.shots) names.set(s.playerId, s.playerName)
  for (const e of payload.roster) names.set(e.playerId, e.playerName)
  return names
}

export function aggregateTeam(payload: TeamShotPayload, ledger: LedgerFacts): TeamMetrics {
  const pm = payload._meta
  const lm = ledger._meta
  if (pm.teamId !== lm.teamId || pm.season !== lm.season || pm.seasonType !== lm.seasonType) {
    throw new Error(
      `team payload (${pm.team} ${pm.season}) and ledger (${lm.team} ${lm.season}) disagree on identity`,
    )
  }
  if (pm.dataThrough !== lm.dataThrough || pm.gamesIncluded !== lm.gamesIncluded) {
    throw new Error(
      `team payload frontier ${pm.dataThrough}/${pm.gamesIncluded} != ledger ${lm.dataThrough}/${lm.gamesIncluded}`,
    )
  }

  const byGame = new Map<string, TeamShotPayload['shots']>()
  for (const s of payload.shots) {
    const slice = byGame.get(s.gameId)
    if (slice === undefined) byGame.set(s.gameId, [s])
    else slice.push(s)
  }
  const ledgerIds = new Set(ledger.games.map((g) => g.gameId))
  for (const gameId of byGame.keys()) {
    if (!ledgerIds.has(gameId)) throw new Error(`payload game ${gameId} missing from the ledger`)
  }
  if (ledgerIds.size !== byGame.size) {
    throw new Error(`ledger lists ${ledgerIds.size} games, payload has ${byGame.size}`)
  }

  const names = nameIndex(payload)
  let boxFga = 0
  const rows: TeamGameRow[] = ledger.games.map((g) => {
    const slice = byGame.get(g.gameId)!
    if (g.fga < slice.length) {
      throw new Error(`game ${g.gameId}: box FGA ${g.fga} < ${slice.length} payload rows`)
    }
    boxFga += g.fga
    const metrics = aggregateShotMetrics(slice, payload.zoneBaseline)
    return {
      gameId: g.gameId,
      gameDate: g.gameDate,
      opponent: g.opponent,
      home: g.home,
      teamScore: g.teamScore,
      opponentScore: g.opponentScore,
      won: g.teamScore > g.opponentScore,
      fgm: g.fgm,
      fga: g.fga,
      ftm: g.ftm,
      fta: g.fta,
      shots: slice.length,
      metrics,
      thinSample: metrics.evalAttempts < SMALL_SAMPLE_MAKING_ATTEMPTS,
      players: g.players.map((p) => {
        const playerName = names.get(p.playerId)
        if (playerName === undefined) {
          throw new Error(`ledger player ${p.playerId} in game ${g.gameId} has no name in the team payload`)
        }
        return { ...p, playerName }
      }),
    }
  })
  // The box oracle at season grain (ADR-0084), re-run at the load boundary.
  if (boxFga !== pm.totalShots + pm.zoneConflictsDropped) {
    throw new Error(
      `ledger box FGA (${boxFga}) != payload pre-drop total (${pm.totalShots + pm.zoneConflictsDropped})`,
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
