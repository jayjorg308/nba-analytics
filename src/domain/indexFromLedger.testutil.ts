// Test support only: a season index for the team goldens (game 0022500025,
// whose game payload is not a fixture). Each row's ruler is the payload's
// own frontier baseline, so a test over the team goldens computes the same
// numbers it did before the season page read per-game rulers.

import { dayBefore } from './gamePayload'
import type { LedgerFacts } from './ledgerFacts'
import type { TeamSeasonIndex } from './teamSeasonIndex'
import type { TeamShotPayload } from './teamShotPayload'

export function indexFromLedger(payload: TeamShotPayload, ledger: LedgerFacts): TeamSeasonIndex {
  const pm = payload._meta
  const nameOf = new Map(payload.shots.map((s) => [s.playerId, s.playerName]))
  return {
    _meta: {
      schemaVersion: 2,
      team: pm.team,
      teamId: pm.teamId,
      tricode: pm.tricode,
      season: pm.season,
      seasonType: pm.seasonType,
      dataThrough: pm.dataThrough,
      gamesIncluded: ledger.games.length,
    },
    games: ledger.games.map((g) => ({
      gameId: g.gameId,
      slug: `${g.gameDate}-${g.opponent.toLowerCase()}`,
      gameDate: g.gameDate,
      opponent: g.opponent,
      home: g.home,
      teamScore: g.teamScore,
      opponentScore: g.opponentScore,
      box: { points: g.teamScore, fgm: g.fgm, fga: g.fga, tpm: 0, tpa: 0, ftm: g.ftm, fta: g.fta, ast: 0 },
      // The ledger's shooters only (its lines carry no threes, minutes,
      // rebounds, or assists): enough for tests that never parse the index.
      players: g.players.map((p) => ({
        playerId: p.playerId,
        name: nameOf.get(p.playerId) ?? String(p.playerId),
        minutes: '',
        points: p.points,
        fgm: p.fgm,
        fga: p.fga,
        tpm: 0,
        tpa: 0,
        ftm: p.ftm,
        fta: p.fta,
        reb: 0,
        ast: 0,
      })),
      ruler: {
        kind: 'pre-game',
        season: pm.season,
        through: dayBefore(g.gameDate),
        games: 1,
        zoneBaseline: payload.zoneBaseline,
      },
    })),
  }
}
