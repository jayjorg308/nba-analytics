// Hand-checked coverage for the growth aggregation (ADR-0061): the zone
// pairing, the diet-gap arithmetic, the spine copy, null propagation, and
// the identity gates. Runs over the golden fixture — pairing a season's
// metrics with itself gives known-zero movement and exact residual copies.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { aggregateShotMetrics } from './aggregate'
import { aggregateGrowthMetrics } from './aggregateGrowth'
import { EVAL_ZONES } from './constants'
import { parseDerivedPayload } from './payload'

const golden = parseDerivedPayload(
  JSON.parse(
    readFileSync(path.resolve(process.cwd(), 'tests/fixtures/derived.golden.json'), 'utf-8'),
  ),
)
const metrics = aggregateShotMetrics(golden.shots, golden.zoneBaseline)
const player = golden._meta.player

const prior = { season: '2024-25', player, metrics }
const current = { season: '2025-26', player, metrics }

describe('aggregateGrowthMetrics (ADR-0061)', () => {
  it('pairs the six evaluation zones in EVAL_ZONES order and copies identity', () => {
    const g = aggregateGrowthMetrics(prior, current)
    expect(g.comparisonClass).toBe('league-average')
    expect(g.player).toBe(player)
    expect(g.priorSeason).toBe('2024-25')
    expect(g.currentSeason).toBe('2025-26')
    expect(g.zones.map((z) => z.zone)).toEqual([...EVAL_ZONES])
  })

  it('dietGap is the share-point residual: his share minus the league share', () => {
    const g = aggregateGrowthMetrics(prior, current)
    for (const row of g.zones) {
      const source = metrics.zones.find((z) => z.zone === row.zone)!
      for (const side of [row.prior, row.current]) {
        expect(side.attempts).toBe(source.attempts)
        expect(side.attemptShare).toBe(source.attemptShare)
        expect(side.leagueAttemptShare).toBe(source.leagueAttemptShare)
        expect(side.dietGap).toBeCloseTo(source.attemptShare! - source.leagueAttemptShare, 12)
        expect(side.makingDelta).toBe(source.makingDelta)
        expect(side.smallSampleMaking).toBe(source.smallSampleMaking)
      }
    }
  })

  it('the spine copies each season headline residual untouched', () => {
    const g = aggregateGrowthMetrics(prior, current)
    for (const side of [g.spine.prior, g.spine.current]) {
      expect(side.selectionDelta).toBe(metrics.selection.selectionDelta)
      expect(side.makingPpsDelta).toBe(metrics.making.makingPpsDelta)
    }
  })

  it('a zone with no attempt share propagates null into dietGap, never zero', () => {
    // No data is not "at league share" — the ADR-0013 stance, on this axis.
    const nulled = structuredClone(metrics)
    nulled.zones[0]!.attemptShare = null
    const g = aggregateGrowthMetrics({ ...prior, metrics: nulled }, current)
    expect(g.zones[0]!.prior.dietGap).toBeNull()
    expect(g.zones[0]!.current.dietGap).not.toBeNull()
  })

  it('rejects two seasons of different players', () => {
    expect(() =>
      aggregateGrowthMetrics({ ...prior, player: 'Someone Else' }, current),
    ).toThrow(/different players/)
  })

  it('rejects out-of-order and identical seasons', () => {
    expect(() => aggregateGrowthMetrics({ ...prior, season: '2025-26' }, current)).toThrow(
      /out of order/,
    )
    expect(() =>
      aggregateGrowthMetrics({ ...prior, season: '2026-27' }, current),
    ).toThrow(/out of order/)
  })
})
