import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseShotContextPayload, shotContextPayloadSchema } from './shotContextPayload'

const goldenUrl = new URL('../../tests/fixtures/shot-context.golden.json', import.meta.url)
const golden = JSON.parse(readFileSync(goldenUrl, 'utf-8')) as unknown

const clone = () => structuredClone(golden) as Record<string, unknown> & {
  _meta: Record<string, unknown>
  shots: Array<Record<string, unknown>>
}

describe('parseShotContextPayload', () => {
  it('strict-parses the committed golden', () => {
    const payload = parseShotContextPayload(golden)
    expect(payload._meta.player).toBe('Cody Williams')
    expect(payload.shots).toHaveLength(15)
    expect(payload._meta.assistStatusCounts).toEqual({
      assisted: 1,
      unassisted: 0,
      notApplicable: 8,
      unknown: 6,
    })
  })

  it('rejects an unknown root key', () => {
    const payload = clone()
    payload.surprise = true
    expect(shotContextPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects duplicate shot identities', () => {
    const payload = clone()
    payload.shots[1] = structuredClone(payload.shots[0]!)
    expect(shotContextPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects summary counts that disagree with rows', () => {
    const payload = clone()
    ;(payload._meta.assistStatusCounts as Record<string, number>).assisted = 2
    expect(shotContextPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects same-count source provenance for an unrelated game', () => {
    const payload = clone()
    const sourceGames = payload._meta.sourceGames as Array<Record<string, unknown>>
    sourceGames[0]!.gameId = '0022500099'
    expect(shotContextPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('rejects an impossible status/evidence pair', () => {
    const payload = clone()
    const miss = payload.shots.find((shot) => shot.assistStatus === 'notApplicable')!
    miss.assistStatus = 'assisted'
    miss.assistEvidence = 'notApplicable'
    expect(shotContextPayloadSchema.safeParse(payload).success).toBe(false)
  })

  it('keeps exact event linkage independent from ambiguous assist evidence', () => {
    const payload = clone()
    const ambiguous = payload.shots.find((shot) => shot.eventMatch === 'missingEvent')!
    ambiguous.eventMatch = 'matched'
    ambiguous.failureReason = null
    const eventCounts = payload._meta.eventMatchCounts as Record<string, number>
    eventCounts.missingEvent -= 1
    eventCounts.matched += 1

    expect(shotContextPayloadSchema.safeParse(payload).success).toBe(true)
  })
})
