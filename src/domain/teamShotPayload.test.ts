// Load-boundary tests for the team shot payload (ADR-0082): the committed
// golden must strict-parse, and contract violations must be rejected (see
// tests/fixtures/README.md).

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { aggregateShotMetrics } from './aggregate'
import { parseTeamShotPayload, TEAM_SCHEMA_VERSION, teamShotPayloadSchema } from './teamShotPayload'

const goldenUrl = new URL('../../tests/fixtures/team-shot.golden.json', import.meta.url)
const golden = JSON.parse(readFileSync(goldenUrl, 'utf-8')) as unknown

type Json = Record<string, unknown>
interface MutablePayload extends Json {
  _meta: Json
  roster: Json[]
  shots: Json[]
  zoneBaseline: Json[]
}
const clone = (): MutablePayload => structuredClone(golden) as MutablePayload

function expectRejected(payload: unknown) {
  expect(teamShotPayloadSchema.safeParse(payload).success).toBe(false)
}

describe('parseTeamShotPayload', () => {
  it('strict-parses the committed golden', () => {
    const payload = parseTeamShotPayload(golden)
    expect(payload._meta.schemaVersion).toBe(TEAM_SCHEMA_VERSION)
    expect(payload._meta.team).toBe('Utah Jazz')
    expect(payload._meta.tricode).toBe('UTA')
    expect(payload.shots).toHaveLength(81)
    expect(payload.roster).toHaveLength(5)
    expect(payload._meta.zoneConflictsDropped).toBe(1)
    expect(payload._meta.gamesIncluded).toBe(1)
  })

  it('feeds the unchanged aggregation as a team, as a player slice, and as a game slice', () => {
    const payload = parseTeamShotPayload(golden)
    const team = aggregateShotMetrics(payload.shots, payload.zoneBaseline)
    const markkanen = aggregateShotMetrics(
      payload.shots.filter((s) => s.playerName === 'Lauri Markkanen'),
      payload.zoneBaseline,
    )
    const game = aggregateShotMetrics(
      payload.shots.filter((s) => s.gameId === '0022500025'),
      payload.zoneBaseline,
    )
    expect(team.totalAttempts).toBe(81)
    expect(game.totalAttempts).toBe(team.totalAttempts)
    expect(markkanen.totalAttempts).toBeGreaterThan(0)
    expect(markkanen.totalAttempts).toBeLessThan(team.totalAttempts)
  })

  it('rejects an unknown key at the root', () => {
    const p = clone()
    p.usagePct = 0.2 // usage is a player fact (ADR-0069); the team contract has none
    expectRejected(p)
  })

  it('rejects an unknown key on a shot', () => {
    const p = clone()
    p.shots[0]!.actionType = 'Pull-Up Jump shot' // the ADR-0005 door stays shut
    expectRejected(p)
  })

  it('rejects a shot without player identity', () => {
    const p = clone()
    delete p.shots[0]!.playerId
    expectRejected(p)
  })

  it('rejects a zone-point conflict (dropped and counted, never shipped)', () => {
    const p = clone()
    p.shots[0]!.zoneBasic = 'Mid-Range'
    p.shots[0]!.pointValue = 3
    expectRejected(p)
  })

  it('rejects a frontier that overstates the rows', () => {
    const p = clone()
    p._meta.dataThrough = '2026-04-12'
    expectRejected(p)
  })

  it('rejects a gamesIncluded that disagrees with the rows', () => {
    const p = clone()
    p._meta.gamesIncluded = 2
    expectRejected(p)
  })

  it('rejects a totalShots that disagrees with the rows', () => {
    const p = clone()
    p._meta.totalShots = 79
    expectRejected(p)
  })

  it('rejects rows out of chronological order', () => {
    const p = clone()
    const [first, second] = [p.shots[0]!, p.shots[1]!]
    p.shots[0] = second
    p.shots[1] = first
    expectRejected(p)
  })

  it('rejects an empty roster and a duplicated roster player', () => {
    const empty = clone()
    empty.roster = []
    expectRejected(empty)
    const dup = clone()
    dup.roster.push({ ...dup.roster[0]! })
    expectRejected(dup)
  })

  it('rejects a lower-case or full-name tricode', () => {
    const p = clone()
    p._meta.tricode = 'Utah Jazz'
    expectRejected(p)
  })

  it('rejects the wrong schema version', () => {
    const p = clone()
    p._meta.schemaVersion = TEAM_SCHEMA_VERSION + 1
    expectRejected(p)
  })
})
