// The team aggregation's contract (ADR-0081/0084, the ledger's rows read
// from the season index since ADR-0087) over the game and index goldens
// (the fixture game 0022500492): identities between the payload and the
// index, no double counting across slices, and the box oracle re-run at the
// load boundary.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { aggregateShotMetrics } from './aggregate'
import { aggregateTeam, seasonOfGameId } from './aggregateTeam'
import { parseGamePayload } from './gamePayload'
import { teamPayloadFromGame } from './teamPayloadFromGame.testutil'
import { parseTeamSeasonIndex } from './teamSeasonIndex'
import type { TeamSeasonIndex } from './teamSeasonIndex'

const read = (rel: string) =>
  JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf-8')) as unknown
const payload = teamPayloadFromGame(parseGamePayload(read('../../tests/fixtures/game.golden.json')))
const index = parseTeamSeasonIndex(read('../../tests/fixtures/team-index.golden.json'))
const preDrop = payload._meta.totalShots + payload._meta.zoneConflictsDropped

function withBoxFga(base: TeamSeasonIndex, fga: number): TeamSeasonIndex {
  return { ...base, games: [{ ...base.games[0]!, box: { ...base.games[0]!.box, fga } }] }
}

describe('aggregateTeam', () => {
  it('computes the profile and one row per index game over the same rows', () => {
    const team = aggregateTeam(payload, index)
    expect(team.games).toBe(1)
    expect(team.shots).toBe(payload.shots.length)
    expect(team.ledger).toHaveLength(1)
    const row = team.ledger[0]!
    expect(row.gameId).toBe('0022500492')
    expect(row.slug).toBe('2026-01-03-gsw')
    expect(row.won).toBe(false)
    expect(row.shots).toBe(payload.shots.length)
    // The box facts are the index row's box team line.
    expect([row.fgm, row.fga, row.ftm, row.fta]).toEqual([
      index.games[0]!.box.fgm,
      index.games[0]!.box.fga,
      index.games[0]!.box.ftm,
      index.games[0]!.box.fta,
    ])
    // One game season under its own ruler: the game's metrics ARE the profile.
    expect(row.metrics).toEqual(team.profile)
    expect(team.gameById.get('0022500492')).toBe(row)
  })

  it('season totals equal the sum of game slices (no double counting)', () => {
    const team = aggregateTeam(payload, index)
    const summed = team.ledger.reduce((n, r) => n + r.metrics.totalAttempts, 0)
    expect(summed).toBe(team.profile.totalAttempts)
    expect(aggregateShotMetrics(payload.shots, payload.zoneBaseline).totalAttempts).toBe(summed)
  })

  it('flags a game under the making bar as thin, never hides it', () => {
    const team = aggregateTeam(payload, index)
    expect(team.ledger[0]!.thinSample).toBe(team.ledger[0]!.metrics.evalAttempts < 50)
    const thinPayload = {
      ...payload,
      shots: payload.shots.slice(0, 20),
      _meta: { ...payload._meta, totalShots: 20 },
    }
    const thin = aggregateTeam(thinPayload, withBoxFga(index, 20 + payload._meta.zoneConflictsDropped))
    expect(thin.ledger[0]!.thinSample).toBe(true)
    expect(thin.ledger[0]!.metrics.totalAttempts).toBe(20)
  })

  it('rejects an index that disagrees with the payload on identity or game count', () => {
    expect(() => aggregateTeam(payload, { ...index, _meta: { ...index._meta, season: '2024-25' } })).toThrow(
      /disagree/,
    )
    expect(() => aggregateTeam(payload, { ...index, _meta: { ...index._meta, gamesIncluded: 2 } })).toThrow(
      /counts 1 games/,
    )
  })

  it('rejects a box FGA below the payload rows and a season total that disagrees', () => {
    expect(() => aggregateTeam(payload, withBoxFga(index, 10))).toThrow(/box FGA 10 </)
    expect(() => aggregateTeam(payload, withBoxFga(index, preDrop + 1))).toThrow(/pre-drop total/)
  })

  it('prices each game row against its own ruler from the index, the profile against the season', () => {
    const shifted = structuredClone(index)
    for (const e of shifted.games[0]!.ruler.zoneBaseline) e.fgm = Math.max(0, e.fgm - 1)
    const team = aggregateTeam(payload, shifted)
    expect(team.ledger[0]!.metrics.selection.leagueDietExpectedPps).not.toBe(
      team.profile.selection.leagueDietExpectedPps,
    )
    expect(team.profile).toEqual(aggregateShotMetrics(payload.shots, payload.zoneBaseline))
  })

  it('rejects a season index whose games differ from the payload’s', () => {
    expect(() =>
      aggregateTeam(payload, { ...index, games: [{ ...index.games[0]!, gameId: '0022500493' }] }),
    ).toThrow(/missing from the season index/)
  })

  it('reads the season off a game id', () => {
    expect(seasonOfGameId('0022500025')).toBe('2025-26')
    expect(seasonOfGameId('0022600001')).toBe('2026-27')
  })
})
