// Hand-computed expectations over the committed free-throw golden, plus the
// aggregation's edge behavior (null claims, tier sums, the shared bars).

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { aggregateFreethrowMetrics } from './aggregateFreethrow'
import { parseFreethrowPayload, TRIP_CLASSES } from './freethrowPayload'
import type { FreethrowPayload } from './freethrowPayload'

const goldenUrl = new URL('../../tests/fixtures/freethrow.golden.json', import.meta.url)
const golden = parseFreethrowPayload(JSON.parse(readFileSync(goldenUrl, 'utf-8')))
const metrics = aggregateFreethrowMetrics(golden)

describe('aggregateFreethrowMetrics', () => {
  it('states its comparison class', () => {
    expect(metrics.comparisonClass).toBe('league-average')
  })

  it('computes the season line on endpoint-parity semantics with both cuts', () => {
    const s = metrics.seasonLine
    // Hand-computed from the golden: 4/6 FT with a 0/1 technical, 15 pre-drop
    // FGA, 21 points; league 14/18 FT over 45 FGA and 61 points.
    expect(s.conversion.value).toBeCloseTo(4 / 6, 10)
    expect(s.conversion.withoutTechnicals).toBeCloseTo(4 / 5, 10)
    expect(s.conversion.league).toBeCloseTo(14 / 18, 10)
    expect(s.smallSampleConversion).toBe(true)
    expect(s.ftaRate.value).toBeCloseTo(6 / 15, 10)
    expect(s.ftaRate.withoutTechnicals).toBeCloseTo(5 / 15, 10)
    expect(s.ftaRate.league).toBeCloseTo(18 / 45, 10)
    expect(s.ftPointsShare.value).toBeCloseTo(4 / 21, 10)
    expect(s.ftPointsShare.withoutTechnicals).toBeCloseTo(4 / 21, 10)
    expect(s.ftPointsShare.league).toBeCloseTo(14 / 61, 10)
  })

  it('renders the taxonomy whole, in TRIP_CLASSES order, zero rows included', () => {
    expect(metrics.tripClasses.map((row) => row.tripClass)).toEqual([...TRIP_CLASSES])
  })

  it('computes per-class conversion, points per trip, and the league trip price', () => {
    const byClass = Object.fromEntries(metrics.tripClasses.map((row) => [row.tripClass, row]))
    const leaguePct = 14 / 18

    expect(byClass.shootingFoul2).toMatchObject({ trips: 1, ftm: 1, fta: 2, tier: 'attemptEquivalent' })
    expect(byClass.shootingFoul2!.conversion).toBeCloseTo(0.5, 10)
    expect(byClass.shootingFoul2!.pointsPerTrip).toBeCloseTo(1, 10)
    expect(byClass.shootingFoul2!.leagueExpectedPointsPerTrip).toBeCloseTo(2 * leaguePct, 10)
    expect(byClass.shootingFoul2!.smallSampleConversion).toBe(true)

    expect(byClass.andOne).toMatchObject({ trips: 1, ftm: 1, fta: 1, tier: 'addOn' })
    expect(byClass.andOne!.leagueExpectedPointsPerTrip).toBeCloseTo(1 * leaguePct, 10)

    expect(byClass.bonus!.pointsPerTrip).toBeCloseTo(2, 10)
  })

  it('makes no claim for an empty class: null conversion, null points per trip', () => {
    const byClass = Object.fromEntries(metrics.tripClasses.map((row) => [row.tripClass, row]))
    expect(byClass.shootingFoul3).toMatchObject({
      trips: 0,
      conversion: null,
      pointsPerTrip: null,
    })
    // The league can still price the trip the hero never took...
    expect(byClass.shootingFoul3!.leagueExpectedPointsPerTrip).toBeCloseTo(3 * (14 / 18), 10)
    // ...except flagrant, whose size varies — no fixed price exists.
    expect(byClass.flagrant!.leagueExpectedPointsPerTrip).toBeNull()
  })

  it('applies the shared dot floor in free-throw attempts', () => {
    // Every golden class sits under 15 FTA — league dots only, exactly like a
    // thin zone (ADR-0031/0056).
    expect(metrics.tripClasses.every((row) => !row.chartIncluded)).toBe(true)
  })

  it('sums the tiers by counts, never rates (ADR-0004)', () => {
    expect(metrics.attemptEquivalent).toMatchObject({ trips: 2, ftm: 3, fta: 4 })
    expect(metrics.attemptEquivalent.conversion).toBeCloseTo(3 / 4, 10)
    expect(metrics.addOn).toMatchObject({ trips: 1, ftm: 1, fta: 1 })
    expect(metrics.addOn.conversion).toBeCloseTo(1, 10)
  })

  it('refuses a baseline that can price nothing', () => {
    const broken = structuredClone(golden) as FreethrowPayload
    ;(broken.leagueBaseline as { fta: number }).fta = 0
    expect(() => aggregateFreethrowMetrics(broken)).toThrow(/baseline unusable/)
  })
})
