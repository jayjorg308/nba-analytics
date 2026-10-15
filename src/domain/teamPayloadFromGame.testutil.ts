// Test support only: a team shot payload holding exactly one game payload's
// subject shots, so the game golden and the index golden (both the fixture
// game 0022500492) can drive the report card end to end. Relabeling the
// season makes the same rows stand in for a prior season's.

import type { GamePayload } from './gamePayload'
import type { TeamSeasonIndex } from './teamSeasonIndex'
import type { TeamShotPayload } from './teamShotPayload'

export function teamPayloadFromGame(game: GamePayload, season = game._meta.season): TeamShotPayload {
  const side = game.sides[0]
  const names = new Map(side.players.map((p) => [p.playerId, p.name]))
  const shots = side.shots.map((s) => {
    const { assistStatus, ...shot } = s
    void assistStatus
    return { ...shot, playerName: names.get(s.playerId)! }
  })
  return {
    _meta: {
      schemaVersion: 1,
      team: side.team,
      teamId: side.teamId,
      tricode: side.tricode,
      season,
      seasonType: game._meta.seasonType,
      pullDate: game._meta.gameDate,
      dataThrough: game._meta.gameDate,
      gamesIncluded: 1,
      sourceSnapshot: side.sourceShotSnapshot,
      rosterSnapshot: side.sourceShotSnapshot,
      totalShots: shots.length,
      zoneConflictsDropped: side.zoneConflicts.length,
    },
    roster: side.players.map((p) => ({ playerId: p.playerId, playerName: p.name, number: '', position: '', experience: '' })),
    shots,
    zoneBaseline: game.zoneBaseline,
  }
}

export function relabelIndex(index: TeamSeasonIndex, season: string): TeamSeasonIndex {
  return { ...index, _meta: { ...index._meta, season } }
}
