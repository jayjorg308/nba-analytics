// Load-boundary tests: the committed golden must strict-parse, and contract
// violations must be rejected (see tests/fixtures/README.md).

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { derivedPayloadSchema, parseDerivedPayload, SCHEMA_VERSION } from './payload'

const goldenUrl = new URL('../../tests/fixtures/derived.golden.json', import.meta.url)
const golden = JSON.parse(readFileSync(goldenUrl, 'utf-8')) as unknown

type Json = Record<string, unknown>
interface MutablePayload extends Json {
  _meta: Json
  shots: Json[]
  zoneBaseline: Json[]
}
const clone = (): MutablePayload => structuredClone(golden) as MutablePayload

function expectRejected(payload: unknown) {
  expect(derivedPayloadSchema.safeParse(payload).success).toBe(false)
}

describe('parseDerivedPayload', () => {
  it('strict-parses the committed golden', () => {
    const payload = parseDerivedPayload(golden)
    expect(payload.shots).toHaveLength(15)
    expect(payload.zoneBaseline).toHaveLength(9)
    expect(payload._meta.player).toBe('Cody Williams')
  })

  it('rejects an unknown key at the root', () => {
    const p = clone()
    p.surprise = true
    expectRejected(p)
  })

  it('rejects an unknown key on a shot', () => {
    const p = clone()
    p.shots[0]!.actionType = 'Pull-Up Jump shot' // the ADR-0005 door stays shut
    expectRejected(p)
  })

  it('rejects an unnormalized range literal (trailing period)', () => {
    const p = clone()
    p.shots[0]!.zoneRange = '16-24 ft.'
    expectRejected(p)
  })

  it('rejects an unknown zone', () => {
    const p = clone()
    p.shots[0]!.zoneBasic = 'Deep Two'
    expectRejected(p)
  })

  it('rejects a malformed opponent (full name where the abbreviation belongs)', () => {
    const p = clone()
    p.shots[0]!.opponent = 'Phoenix Suns'
    expectRejected(p)
  })

  it('rejects pointValue outside 2|3', () => {
    const p = clone()
    p.shots[0]!.pointValue = 1
    expectRejected(p)
  })

  it('rejects pointValue inconsistent with zone', () => {
    const p = clone()
    // shots[0] in the golden is a Mid-Range two
    expect(p.shots[0]!.zoneBasic).toBe('Mid-Range')
    p.shots[0]!.pointValue = 3
    expectRejected(p)
  })

  it('rejects fgm > fga in the baseline', () => {
    const p = clone()
    p.zoneBaseline[0]!.fgm = (p.zoneBaseline[0]!.fga as number) + 1
    expectRejected(p)
  })

  it('rejects a schemaVersion mismatch', () => {
    const p = clone()
    // derived from the constant so this test can't rot across bumps
    p._meta.schemaVersion = SCHEMA_VERSION + 1
    expectRejected(p)
  })

  it('rejects totalShots inconsistent with shots.length', () => {
    const p = clone()
    p._meta.totalShots = 14
    expectRejected(p)
  })

  it('rejects a baseline missing an evaluation zone', () => {
    const p = clone()
    p.zoneBaseline = p.zoneBaseline.filter((e) => e.zone !== 'Mid-Range')
    expectRejected(p)
  })
})
