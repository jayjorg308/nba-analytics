// Smoke test for the creation report against the committed creation golden.
// The math is covered by aggregateCreation.test.ts; what this pins is the
// WIRING — the section renders from the same parse + aggregate path, at
// verdict-authoring precision, with the honesty furniture present.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { aggregateCreationMetrics } from '../domain/aggregateCreation'
import { parseCreationPayload } from '../domain/creationPayload'
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

  it('prints the two-tier General rows and every product band', () => {
    expect(report).toContain('Inside 10 ft')
    expect(report).toContain('Jumpers (10 ft and out)')
    expect(report).toContain('Catch and shoot')
    expect(report).toContain('Pull-ups')
    expect(report).toContain('Other')
    expect(report).toContain('Early (24-15s)')
    expect(report).toContain('Average (15-7s)')
    expect(report).toContain('Late (7-0s)')
    expect(report).toContain('Tight (0-4 ft)')
    expect(report).toContain('Open (4-6 ft)')
    expect(report).toContain('Wide open (6+ ft)')
  })

  it('prints PPS from the aggregation at 3 decimals', () => {
    const cs = metrics.general.jumperContexts[0]!
    expect(report).toContain(cs.pps!.toFixed(3)) // 1.500
    expect(report).toContain(cs.leaguePps!.toFixed(3)) // 1.188
    const jumpers = metrics.general.jumpers
    expect(report).toContain(jumpers.pps!.toFixed(3)) // 1.143 — the parent rollup
  })

  it('prints the three-arrival bridge with the league comparison, both jumper kinds', () => {
    expect(report).toContain('catch-and-shoot carries 3 of his 4 threes (75.0%; lg 66.7%)')
    expect(report).toContain('pull-ups carry 1 of his 4 threes (25.0%; lg 33.3%)')
  })

  it('carries the honesty furniture: † flags and the unattributed counters', () => {
    expect(report).toContain('†') // every golden context is sub-50
    expect(report).toContain(
      `unattributed shot-clock attempts: ${metrics.shotClockUnattributed} (player) · ` +
        `${metrics.leagueShotClockUnattributed} (league)`,
    )
    expect(report).toContain(
      `unattributed defender attempts: ${metrics.defenderUnattributed} (player) · ` +
        `${metrics.leagueDefenderUnattributed} (league)`,
    )
  })
})
