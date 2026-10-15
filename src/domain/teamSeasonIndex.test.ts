// Load-boundary tests for the team season index (ADR-0088): the committed
// golden (the record-store season export over the fixture game) must
// strict-parse, and its row rules must reject a doctored index.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { INDEX_SCHEMA_VERSION, parseTeamSeasonIndex, teamSeasonIndexSchema } from './teamSeasonIndex'

const goldenUrl = new URL('../../tests/fixtures/team-index.golden.json', import.meta.url)
const golden = JSON.parse(readFileSync(goldenUrl, 'utf-8')) as unknown

type Json = Record<string, unknown>
const clone = () => structuredClone(golden) as { _meta: Json; games: (Json & { ruler: Json })[] }
const rejects = (index: unknown) => expect(teamSeasonIndexSchema.safeParse(index).success).toBe(false)

describe('parseTeamSeasonIndex', () => {
  it('strict-parses the committed golden', () => {
    const index = parseTeamSeasonIndex(golden)
    expect(index._meta.schemaVersion).toBe(INDEX_SCHEMA_VERSION)
    expect(index.games.map((g) => g.slug)).toEqual(['2026-01-03-gsw'])
    expect(index.games[0]!.ruler).toMatchObject({ kind: 'pre-game', through: '2026-01-02', games: 2 })
  })

  it('rejects a slug that is not the date plus the opponent', () => {
    const index = clone()
    index.games[0]!.slug = '2026-01-03-gs'
    rejects(index)
  })

  it('rejects an unknown key and a ruler missing its zones', () => {
    const extra = clone()
    extra.games[0]!.selectionDelta = 0.01 // metrics are computed, never persisted
    rejects(extra)
    const bare = clone()
    delete bare.games[0]!.ruler.zoneBaseline
    rejects(bare)
  })

  it('rejects a frontier that is not the last game', () => {
    const index = clone()
    index._meta.dataThrough = '2026-01-04'
    rejects(index)
  })
})
