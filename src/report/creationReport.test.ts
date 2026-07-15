// Smoke test for the creation report against the committed creation golden.
// The math is covered by aggregateCreation.test.ts; what this pins is the
// WIRING — the section renders from the same parse + aggregate path, at
// verdict-authoring precision, with the honesty furniture present.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { aggregateCreationMetrics } from '../domain/aggregateCreation'
import { GENERAL_CONTEXTS, parseCreationPayload } from '../domain/creationPayload'
import { renderCreationReport } from './creationReport'

const goldenUrl = new URL('../../tests/fixtures/creation.golden.json', import.meta.url)
const payload = parseCreationPayload(JSON.parse(readFileSync(goldenUrl, 'utf-8')))
const metrics = aggregateCreationMetrics(payload)
const report = renderCreationReport(payload)

describe('renderCreationReport', () => {
  it('states the comparison class and the season denominator', () => {
    expect(report).toContain('vs league average')
    expect(report).toContain(`(${metrics.seasonFga} attempts)`)
  })

  it('prints a row for every General context and every product clock band', () => {
    for (const context of GENERAL_CONTEXTS) expect(report).toContain(context)
    expect(report).toContain('Early (24-15s)')
    expect(report).toContain('Average (15-7s)')
    expect(report).toContain('Late (7-0s)')
  })

  it('prints PPS from the aggregation at 3 decimals', () => {
    const cs = metrics.general[0]!
    expect(report).toContain(cs.pps!.toFixed(3)) // 1.500
    expect(report).toContain(cs.leaguePps!.toFixed(3)) // 1.188
  })

  it('carries the honesty furniture: † flags and the unattributed counters', () => {
    expect(report).toContain('†') // every golden context is sub-50
    expect(report).toContain(
      `unattributed shot-clock attempts: ${metrics.shotClockUnattributed} (player) · ` +
        `${metrics.leagueShotClockUnattributed} (league)`,
    )
  })
})
