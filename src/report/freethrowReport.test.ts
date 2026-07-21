// Smoke test for THE LINE report section against the committed free-throw
// golden. The math is covered by aggregateFreethrow.test.ts; what this pins
// is the WIRING — same parse + aggregate path, authoring precision, both-cuts
// columns, and the honesty furniture.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { aggregateFreethrowMetrics } from '../domain/aggregateFreethrow'
import { parseFreethrowPayload } from '../domain/freethrowPayload'
import { renderFreethrowReport } from './freethrowReport'

const goldenUrl = new URL('../../tests/fixtures/freethrow.golden.json', import.meta.url)
const payload = parseFreethrowPayload(JSON.parse(readFileSync(goldenUrl, 'utf-8')))
const metrics = aggregateFreethrowMetrics(payload)
const report = renderFreethrowReport(payload)

describe('renderFreethrowReport', () => {
  it('states the comparison class and the parity semantics', () => {
    expect(report).toContain('vs league average')
    expect(report).toContain('technicals included both sides')
  })

  it('prints the season line with both cuts at authoring precision', () => {
    const s = metrics.seasonLine
    expect(report).toContain('season line: 4/6 FT · 0/1 technical · 15 FGA (pre-drop) · 21 PTS')
    expect(report).toContain(s.conversion.value!.toFixed(3)) // 0.667
    expect(report).toContain(s.conversion.withoutTechnicals!.toFixed(3)) // 0.800
    expect(report).toContain(s.ftPointsShare.league.toFixed(3)) // 0.230
  })

  it('prints both tiers over every class, zero rows included', () => {
    expect(report).toContain('Attempt-equivalent')
    expect(report).toContain('Add-on')
    expect(report).toContain('Shooting foul (2 FT)')
    expect(report).toContain('Shooting foul (3 FT)')
    expect(report).toContain('Bonus')
    expect(report).toContain('And-1')
    expect(report).toContain('Flagrant')
    expect(report).toContain('Clear path')
  })

  it('flags small-sample conversions but never a null claim', () => {
    expect(report).toContain('†')
    // A zero-attempt class makes no claim, so its dash carries no flag.
    expect(report).not.toContain('—†')
  })

  it('carries the technical and league-trip furniture', () => {
    expect(report).toContain('technical free throws: 0/1 — never trips, never evaluation')
    expect(report).toContain("a league shooter's 2-shot trip expects 1.556 points")
  })
})
