// Creation load-boundary tests: the committed golden must strict-parse, and
// contract violations must be rejected (see tests/fixtures/README.md and
// ADR-0030).

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CREATION_SCHEMA_VERSION,
  creationPayloadSchema,
  parseCreationPayload,
} from './creationPayload'

const goldenUrl = new URL('../../tests/fixtures/creation.golden.json', import.meta.url)
const golden = JSON.parse(readFileSync(goldenUrl, 'utf-8')) as unknown

type Json = Record<string, unknown>
interface MutableEntry extends Json {
  context: string
  fga: number
  fgm: number
  fg2a: number
  fg3a: number
}
interface MutablePayload extends Json {
  _meta: Json
  general: { player: MutableEntry[]; league: MutableEntry[] }
  shotClock: { player: MutableEntry[]; league: MutableEntry[] }
}
const clone = (): MutablePayload => structuredClone(golden) as MutablePayload

function expectRejected(payload: unknown) {
  expect(creationPayloadSchema.safeParse(payload).success).toBe(false)
}

describe('parseCreationPayload', () => {
  it('strict-parses the committed golden', () => {
    const payload = parseCreationPayload(golden)
    expect(payload._meta.player).toBe('Cody Williams')
    expect(payload._meta.seasonFga).toBe(15)
    expect(payload.general.player).toHaveLength(4)
    expect(payload.shotClock.player).toHaveLength(6)
    // The sparse-row zero-fill (spike trap #1) survives the round trip.
    expect(payload.general.player.find((e) => e.context === 'Other')).toEqual({
      context: 'Other',
      fga: 0,
      fgm: 0,
      fg2a: 0,
      fg2m: 0,
      fg3a: 0,
      fg3m: 0,
    })
  })

  it('rejects an unknown key at the root', () => {
    const p = clone()
    p.surprise = true
    expectRejected(p)
  })

  it('rejects an unknown key on an entry', () => {
    const p = clone()
    p.general.player[0]!.efgPct = 0.75 // eFG% stays out — PPS is the unit (ADR-0001)
    expectRejected(p)
  })

  it('rejects an unknown context literal', () => {
    const p = clone()
    p.general.player[0]!.context = 'Step Backs'
    expectRejected(p)
  })

  it('rejects a clock band in the General family', () => {
    const p = clone()
    p.general.player[0]!.context = '24-22'
    expectRejected(p)
  })

  it('rejects a missing context (the partition must be whole)', () => {
    const p = clone()
    p.general.player = p.general.player.filter((e) => e.context !== 'Other')
    // keep the FGA identity intact so ONLY the exactly-once rule fires
    expectRejected(p)
  })

  it('rejects a duplicated context', () => {
    const p = clone()
    const other = p.general.player.find((e) => e.context === 'Other')!
    p.general.player.push(structuredClone(other)) // all-zero: sums unchanged
    expectRejected(p)
  })

  it('rejects fga != fg2a + fg3a', () => {
    const p = clone()
    p.general.player[0]!.fg2a += 1
    expectRejected(p)
  })

  it('rejects fgm > fga', () => {
    const p = clone()
    p.shotClock.league[0]!.fgm = p.shotClock.league[0]!.fga + 1
    expectRejected(p)
  })

  it('rejects a General sum that misses seasonFga (the ADR-0030 identity)', () => {
    const p = clone()
    p._meta.seasonFga = 16
    expectRejected(p)
  })

  it('rejects a shot-clock sum inconsistent with the unattributed count', () => {
    const p = clone()
    p._meta.shotClockUnattributed = 0 // bands sum to 14, seasonFga is 15
    expectRejected(p)
  })

  it('rejects league sums inconsistent with leagueFga', () => {
    const p = clone()
    p._meta.leagueFga = 251
    expectRejected(p)
  })

  it('rejects a schemaVersion mismatch', () => {
    const p = clone()
    // derived from the constant so this test can't rot across bumps
    p._meta.schemaVersion = CREATION_SCHEMA_VERSION + 1
    expectRejected(p)
  })
})
