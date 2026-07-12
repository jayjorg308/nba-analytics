// Smoke test for the hero report against the committed golden fixture. The
// math is already covered by the aggregate tests; what this pins is the
// WIRING — the report renders from the same parse + aggregate path the app
// uses, and its headline numbers are the aggregation's, not a re-derivation.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { aggregateShotMetrics } from '../domain/aggregate'
import { EVAL_ZONES } from '../domain/constants'
import { parseDerivedPayload } from '../domain/payload'
import { renderHeroReport } from './heroReport'

const goldenUrl = new URL('../../tests/fixtures/derived.golden.json', import.meta.url)
const payload = parseDerivedPayload(JSON.parse(readFileSync(goldenUrl, 'utf-8')))
const metrics = aggregateShotMetrics(payload.shots, payload.zoneBaseline)
const report = renderHeroReport(payload)

const MINUS = '−'
const signed3 = (x: number) => `${x < 0 ? MINUS : '+'}${Math.abs(x).toFixed(3)}`

describe('renderHeroReport', () => {
  it('names the hero, season, and provenance', () => {
    expect(report).toContain(payload._meta.player)
    expect(report).toContain(payload._meta.season)
    expect(report).toContain(payload._meta.pullDate)
  })

  it('prints a row for every evaluation zone plus the combined-threes rollup', () => {
    for (const zone of EVAL_ZONES) expect(report).toContain(zone)
    expect(report).toContain('3 Pointers (combined)')
  })

  it('prints the decomposition from the aggregation, at 3 decimals', () => {
    expect(report).toContain(metrics.selection.leagueDietExpectedPps.toFixed(3))
    expect(report).toContain(signed3(metrics.selection.selectionDelta!))
    expect(report).toContain(metrics.selection.playerDietExpectedPps!.toFixed(3))
    expect(report).toContain(signed3(metrics.making.makingPpsDelta!))
    expect(report).toContain(metrics.making.actualPps!.toFixed(3))
  })

  it('reports the gate results', () => {
    const included = metrics.zones.filter((z) => z.included).length
    expect(report).toContain('Gate 1 · league baseline populated: PASS')
    expect(report).toContain(`${included}/${metrics.zones.length} zones clear the bar`)
  })

  it('carries the honesty flags: †, mix-view exclusion, conflict count', () => {
    // 15 golden shots: every zone is sub-50 (†) and at most one zone could
    // reach the 15-FGA inclusion bar, so the * marker must appear.
    expect(report).toContain('†')
    expect(report).toContain(' *')
    const conflicts = payload._meta.zoneConflictsDropped
    expect(report).toContain(
      `${conflicts} zone-point conflict${conflicts === 1 ? '' : 's'} dropped`,
    )
  })
})
