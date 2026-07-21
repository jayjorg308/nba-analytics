import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { freethrowPayloadSchema, parseFreethrowPayload } from './freethrowPayload'

const goldenUrl = new URL('../../tests/fixtures/freethrow.golden.json', import.meta.url)
const golden = JSON.parse(readFileSync(goldenUrl, 'utf-8')) as unknown

const clone = () =>
  structuredClone(golden) as Record<string, unknown> & {
    _meta: Record<string, unknown>
    trips: Array<Record<string, unknown>>
    leagueBaseline: Record<string, number>
  }

describe('parseFreethrowPayload', () => {
  it('strict-parses the committed golden', () => {
    const payload = parseFreethrowPayload(golden)
    expect(payload._meta.player).toBe('Cody Williams')
    expect(payload.trips).toHaveLength(3)
    expect(payload._meta.tripClassCounts.andOne).toBe(1)
    expect(payload._meta.technicalFta).toBe(1)
    expect(payload.leagueBaseline).toEqual({ ftm: 14, fta: 18, fga: 45, points: 61 })
  })

  it('rejects an unknown root key', () => {
    const payload = clone()
    payload.surprise = true
    expect(freethrowPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects a shotId on any trip that is not an and-one', () => {
    const payload = clone()
    const shootingFoul = payload.trips.find((trip) => trip.tripClass === 'shootingFoul2')!
    shootingFoul.shotId = 233
    expect(freethrowPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects an and-one without its shot identity', () => {
    const payload = clone()
    const andOne = payload.trips.find((trip) => trip.tripClass === 'andOne')!
    andOne.shotId = null
    expect(freethrowPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects a class-impossible free-throw count', () => {
    const payload = clone()
    const andOne = payload.trips.find((trip) => trip.tripClass === 'andOne')!
    andOne.fta = 2
    andOne.ftm = 2
    expect(freethrowPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects trip class counts that disagree with rows', () => {
    const payload = clone()
    ;(payload._meta.tripClassCounts as Record<string, number>).bonus = 2
    expect(freethrowPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects season lines that stop summing from trips plus technicals', () => {
    const payload = clone()
    payload._meta.seasonFta = 7
    expect(freethrowPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects duplicate trip identities', () => {
    const payload = clone()
    // Same (game, period, clock) as trips[0] while classes, counts, and the
    // season sums all stay valid — identity uniqueness is the only breach.
    payload.trips[1]!.period = payload.trips[0]!.period
    payload.trips[1]!.clock = payload.trips[0]!.clock
    expect(freethrowPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects a trip whose game is missing from source provenance', () => {
    const payload = clone()
    const sourceGames = payload._meta.sourceGames as Array<Record<string, unknown>>
    sourceGames[0]!.gameId = '0022500099'
    expect(freethrowPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects a technical line exceeding its attempts', () => {
    const payload = clone()
    payload._meta.technicalFtm = 2
    expect(freethrowPayloadSchema.safeParse(payload).success).toBe(false)
  })
})
