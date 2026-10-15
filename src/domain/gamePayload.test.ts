// Load-boundary tests for the game payload (ADR-0088): the committed golden
// (the record-store export over the two-team fixture game) must
// strict-parse, and every identity the export enforces must reject a
// doctored file here too (see tests/fixtures/README.md).

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { aggregateShotMetrics } from './aggregate'
import { dayBefore, GAME_SCHEMA_VERSION, gamePayloadSchema, parseGamePayload } from './gamePayload'

const goldenUrl = new URL('../../tests/fixtures/game.golden.json', import.meta.url)
const golden = JSON.parse(readFileSync(goldenUrl, 'utf-8')) as unknown

type Json = Record<string, unknown>
interface MutableSide extends Json {
  box: Json
  players: Json[]
  shots: Json[]
  zoneConflicts: Json[]
  trips: Json[]
}
interface MutableGame extends Json {
  _meta: Json & { ruler: Json }
  sides: [MutableSide, MutableSide]
  zoneBaseline: Json[]
}
const clone = (): MutableGame => structuredClone(golden) as MutableGame

function expectRejected(payload: unknown, message?: RegExp) {
  const result = gamePayloadSchema.safeParse(payload)
  expect(result.success).toBe(false)
  if (message && !result.success) expect(result.error.message).toMatch(message)
}

describe('parseGamePayload', () => {
  it('strict-parses the committed golden', () => {
    const game = parseGamePayload(golden)
    expect(game._meta.schemaVersion).toBe(GAME_SCHEMA_VERSION)
    expect(game._meta.gameId).toBe('0022500492')
    expect(game.sides.map((s) => s.tricode)).toEqual(['UTA', 'GSW'])
    expect(game._meta.ruler).toMatchObject({ kind: 'pre-game', through: '2026-01-02', games: 2 })
    expect(game.sides[0].zoneConflicts).toHaveLength(1)
    expect(game.sides[1].players.find((p) => p.name === 'Stephen Curry')?.technicalFta).toBe(1)
    expect(game.sides.flatMap((s) => s.trips).filter((t) => t.tripClass === 'andOne')).toHaveLength(2)
  })

  it('feeds the unchanged aggregation for both sides under its own ruler', () => {
    const game = parseGamePayload(golden)
    for (const side of game.sides) {
      const m = aggregateShotMetrics(side.shots, game.zoneBaseline)
      expect(m.totalAttempts).toBe(side.shots.length)
      expect(m.selection.selectionDelta).not.toBeNull()
    }
  })

  it('rejects an unknown key', () => {
    const g = clone()
    g.sides[0].shots[0]!.playerName = 'Keyonte George'
    expectRejected(g)
  })

  it('rejects a shooter whose rows disagree with his box FGA', () => {
    const g = clone()
    g.sides[1].shots.pop()
    expectRejected(g, /rows != box FGA/)
  })

  it('rejects a broken receipt', () => {
    const g = clone()
    const p = g.sides[0].players.find((x) => x.name === 'Kyle Filipowski')!
    p.points = (p.points as number) + 2
    g.sides[0].box.points = (g.sides[0].box.points as number) + 2
    expectRejected(g, /receipt identity/)
  })

  it('rejects a free-throw line that does not reconcile', () => {
    const g = clone()
    g.sides[1].trips.pop()
    expectRejected(g, /free-throw line/)
  })

  it('rejects assist statuses that cannot reach the box assists', () => {
    const g = clone()
    g.sides[1].box.ast = (g.sides[1].box.ast as number) + 1
    expectRejected(g, /assist statuses/)
  })

  it('rejects a conflict row filed among priced shots', () => {
    const g = clone()
    const c = g.sides[0].zoneConflicts.pop()!
    expectRejected(g, /rows != box FGA/)
    const shot = { ...g.sides[0].shots[0]!, gameEventId: c.gameEventId, zoneBasic: c.zoneBasic, pointValue: c.pointValue }
    g.sides[0].shots.push(shot)
    expectRejected(g, /pointValue inconsistent/)
  })

  it('rejects a pre-game ruler that is not the day before the game', () => {
    const g = clone()
    g._meta.ruler.through = '2026-01-03'
    expectRejected(g, /day before/)
  })

  it('rejects sides out of order', () => {
    const g = clone()
    g.sides.reverse()
    expectRejected(g, /subject team/)
  })
})

describe('dayBefore', () => {
  it('crosses month and year boundaries', () => {
    expect(dayBefore('2026-01-01')).toBe('2025-12-31')
    expect(dayBefore('2026-03-01')).toBe('2026-02-28')
  })
})
