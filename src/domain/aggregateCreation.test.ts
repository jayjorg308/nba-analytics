// Tests for the creation aggregation — hand-computed values over the
// committed creation golden, plus the invariants: the clock rollup SUMS
// counts (never averages rates — ADR-0004), zero attempts make no PPS claim
// (ADR-0013's no-data distinction), and the † flag shares the zone table's
// constant (ADR-0031).

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  aggregateCreationMetrics,
  CLOCK_BAND_ROLLUP,
  DEFENDER_BAND_ROLLUP,
  JUMPER_CONTEXTS,
} from './aggregateCreation'
import { SMALL_SAMPLE_MAKING_ATTEMPTS } from './constants'
import type { CreationPayload } from './creationPayload'
import { parseCreationPayload } from './creationPayload'

const goldenUrl = new URL('../../tests/fixtures/creation.golden.json', import.meta.url)
const golden = parseCreationPayload(JSON.parse(readFileSync(goldenUrl, 'utf-8')))

const clone = (): CreationPayload => structuredClone(golden)

describe('aggregateCreationMetrics over the creation golden', () => {
  const m = aggregateCreationMetrics(golden)

  it('echoes the denominators and unattributed counts', () => {
    expect(m.comparisonClass).toBe('league-average')
    expect(m.seasonFga).toBe(15)
    expect(m.shotClockUnattributed).toBe(1)
    expect(m.defenderUnattributed).toBe(2)
    expect(m.leagueFga).toBe(250)
    expect(m.leagueShotClockUnattributed).toBe(2)
    expect(m.leagueDefenderUnattributed).toBe(5)
  })

  it('presents the General family two-tier: rim, jumper parent, jumper children', () => {
    expect(m.general.inside.context).toBe('Less than 10 ft')
    expect(m.general.jumperContexts.map((r) => r.context)).toEqual([...JUMPER_CONTEXTS])
  })

  it('computes shares on the season/league denominators and PPS from raw makes', () => {
    const cs = m.general.jumperContexts[0]! // Catch and Shoot: 2/4, 2s 0/1, 3s 2/3
    expect(cs.attempts).toBe(4)
    expect(cs.makes).toBe(2)
    expect(cs.attemptShare).toBeCloseTo(4 / 15, 10)
    expect(cs.leagueAttemptShare).toBeCloseTo(80 / 250, 10)
    expect(cs.pps).toBeCloseTo(1.5, 10) // (2·0 + 3·2) / 4
    expect(cs.leaguePps).toBeCloseTo(95 / 80, 10) // (2·10 + 3·25) / 80

    const pu = m.general.jumperContexts[1]! // Pull Ups: 1/3, 2s 1/2, 3s 0/1
    expect(pu.pps).toBeCloseTo(2 / 3, 10)
    expect(pu.leaguePps).toBeCloseTo(1.0, 10)
  })

  it('rolls the jumper parent up by summing counts on both sides', () => {
    const j = m.general.jumpers // C&S 4 + Pull Ups 3 + Other 0
    expect(j.attempts).toBe(7)
    expect(j.makes).toBe(3)
    expect(j.attemptShare).toBeCloseTo(7 / 15, 10)
    expect(j.pps).toBeCloseTo(8 / 7, 10) // (2·1 + 3·2) / 7
    // league: 80 + 70 + 10 = 160 FGA; (2·35 + 3·35) / 160
    expect(j.leagueAttemptShare).toBeCloseTo(160 / 250, 10)
    expect(j.leaguePps).toBeCloseTo(175 / 160, 10)
    // the family still partitions: inside + jumpers = every season attempt
    expect(m.general.inside.attempts + j.attempts).toBe(m.seasonFga)
  })

  it('bridges the three-point story: each jumper kind\'s 3PA over all 3PA, both sides', () => {
    const cs3 = m.general.catchAndShootThrees
    // golden 3PA by context: C&S 3, Pull Ups 1, inside 0, Other 0
    expect(cs3.attempts).toBe(3)
    expect(cs3.totalThrees).toBe(4)
    expect(cs3.share).toBeCloseTo(3 / 4, 10)
    // league: C&S 60, Pull Ups 30 → 60 of 90
    expect(cs3.leagueShare).toBeCloseTo(60 / 90, 10)
    // the pull-up slice, so the arrival split is verifiable from both ends
    const pu3 = m.general.pullUpThrees
    expect(pu3.attempts).toBe(1)
    expect(pu3.totalThrees).toBe(4)
    expect(pu3.share).toBeCloseTo(1 / 4, 10)
    expect(pu3.leagueShare).toBeCloseTo(30 / 90, 10)
  })

  it('a zero-attempt context keeps its share and makes no PPS claim', () => {
    const other = m.general.jumperContexts[2]!
    expect(other.context).toBe('Other')
    expect(other.attempts).toBe(0)
    expect(other.attemptShare).toBe(0) // 0 of 15 — a real share, not missing data
    expect(other.pps).toBeNull() // no data ≠ a value claim (ADR-0013 ported)
    expect(other.leagueAttemptShare).toBeCloseTo(10 / 250, 10)
    expect(other.leaguePps).toBeCloseTo(1.0, 10) // the residual still prices
  })

  it('rolls the clock to product grain by summing counts on both sides', () => {
    expect(m.shotClock.map((r) => r.band)).toEqual(['Early', 'Average', 'Late'])

    const early = m.shotClock[0]! // 0 + 3 + 3 attempts; league 8 + 40 + 50
    expect(early.attempts).toBe(6)
    expect(early.makes).toBe(3)
    expect(early.attemptShare).toBeCloseTo(6 / 15, 10)
    expect(early.pps).toBeCloseTo(1.0, 10) // (2·3 + 3·0) / 6
    expect(early.leagueAttemptShare).toBeCloseTo(98 / 250, 10)
    expect(early.leaguePps).toBeCloseTo(116 / 98, 10) // (2·31 + 3·18) / 98

    const late = m.shotClock[2]! // 2 + 1 attempts; league 30 + 20
    expect(late.attempts).toBe(3)
    expect(late.pps).toBeCloseTo(2 / 3, 10)
    expect(late.leaguePps).toBeCloseTo(0.84, 10) // (2·15 + 3·4) / 50
  })

  it('rolls the defender distances to product grain by summing counts on both sides', () => {
    expect(m.closestDefender.map((r) => r.band)).toEqual(['Tight', 'Open', 'Wide open'])

    const tight = m.closestDefender[0]! // Very Tight (zero-filled) + Tight
    expect(tight.attempts).toBe(5)
    expect(tight.makes).toBe(3)
    expect(tight.attemptShare).toBeCloseTo(5 / 15, 10)
    expect(tight.pps).toBeCloseTo(1.2, 10) // (2·3 + 3·0) / 5
    expect(tight.leagueAttemptShare).toBeCloseTo(100 / 250, 10) // 20 + 80
    expect(tight.leaguePps).toBeCloseTo(105 / 100, 10) // (2·45 + 3·5) / 100

    const wideOpen = m.closestDefender[2]!
    expect(wideOpen.attempts).toBe(4)
    expect(wideOpen.pps).toBeCloseTo(3 / 4, 10) // (2·0 + 3·1) / 4
    expect(wideOpen.leaguePps).toBeCloseTo(70 / 55, 10) // (2·5 + 3·20) / 55
  })

  it('the rollup differs from averaging the band rates — summation is load-bearing', () => {
    // League Late: per-band PPS are 26/30 and 16/20; their unweighted mean
    // (≈0.8333) is the forbidden computation. The rolled value is 0.84.
    const perBandMean = (26 / 30 + 16 / 20) / 2
    const late = m.shotClock[2]!
    expect(Math.abs(late.leaguePps! - perBandMean)).toBeGreaterThan(0.005)
  })

  it('flags every sub-50 conversion claim with the shared constant', () => {
    // Every golden context is tiny — all flagged, one meaning of †.
    const rows = [
      m.general.inside,
      m.general.jumpers,
      ...m.general.jumperContexts,
      ...m.shotClock,
      ...m.closestDefender,
    ]
    for (const row of rows) {
      expect(row.smallSamplePps).toBe(true)
    }
  })

  it('does not mutate its input', () => {
    const payload = clone()
    const before = structuredClone(payload)
    aggregateCreationMetrics(payload)
    expect(payload).toEqual(before)
  })
})

describe('the † boundary (shared with the zone table — ADR-0031)', () => {
  function withCatchAndShootFga(fga: number): CreationPayload {
    const p = clone()
    const cs = p.general.player[0]!
    // Keep the entry internally coherent; identities with _meta are the
    // schema's concern, not the aggregation's — it consumes typed payloads.
    cs.fga = fga
    cs.fg2a = fga - cs.fg3a
    return p
  }

  it(`flags at ${SMALL_SAMPLE_MAKING_ATTEMPTS - 1} attempts, not at ${SMALL_SAMPLE_MAKING_ATTEMPTS}`, () => {
    const flagged = aggregateCreationMetrics(
      withCatchAndShootFga(SMALL_SAMPLE_MAKING_ATTEMPTS - 1),
    )
    expect(flagged.general.jumperContexts[0]!.smallSamplePps).toBe(true)

    const clear = aggregateCreationMetrics(withCatchAndShootFga(SMALL_SAMPLE_MAKING_ATTEMPTS))
    expect(clear.general.jumperContexts[0]!.smallSamplePps).toBe(false)
  })
})

describe('unusable payloads fail loudly', () => {
  it('throws when the league baseline has no attempts', () => {
    const p = clone()
    p._meta.leagueFga = 0
    expect(() => aggregateCreationMetrics(p)).toThrow('league FGA is 0')
  })

  it('throws when a context is missing (bypassed load boundary)', () => {
    const p = clone()
    p.general.league = p.general.league.filter((e) => e.context !== 'Other')
    expect(() => aggregateCreationMetrics(p)).toThrow("missing context 'Other'")
  })

  it('throws when a clock band constituent is missing', () => {
    const p = clone()
    p.shotClock.player = p.shotClock.player.filter((e) => e.context !== '7-4 Late')
    expect(() => aggregateCreationMetrics(p)).toThrow("missing context '7-4 Late'")
  })
})

describe('CLOCK_BAND_ROLLUP', () => {
  it('partitions all six NBA bands exactly once', () => {
    const covered = CLOCK_BAND_ROLLUP.flatMap((b) => b.contexts)
    expect([...covered].sort()).toEqual(
      [
        '24-22',
        '22-18 Very Early',
        '18-15 Early',
        '15-7 Average',
        '7-4 Late',
        '4-0 Very Late',
      ].sort(),
    )
    expect(new Set(covered).size).toBe(covered.length)
  })
})

describe('DEFENDER_BAND_ROLLUP', () => {
  it('partitions all four NBA distances exactly once', () => {
    const covered = DEFENDER_BAND_ROLLUP.flatMap((b) => b.contexts)
    expect([...covered].sort()).toEqual(
      [
        '0-2 Feet - Very Tight',
        '2-4 Feet - Tight',
        '4-6 Feet - Open',
        '6+ Feet - Wide Open',
      ].sort(),
    )
    expect(new Set(covered).size).toBe(covered.length)
  })
})
