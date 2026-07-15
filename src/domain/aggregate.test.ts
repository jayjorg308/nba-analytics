// Tests for the single pure aggregation function (ADR-0007).
// Micro-fixture numbers are all hand-computed with round values.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { aggregateShotMetrics } from './aggregate'
import type { BasicZone } from './constants'
import { ZONE_POINT_VALUE } from './constants'
import type { EnrichedShot, ZoneBaselineEntry } from './payload'
import { parseDerivedPayload } from './payload'

function shot(zoneBasic: BasicZone, made: boolean, over: Partial<EnrichedShot> = {}): EnrichedShot {
  const pointValue = ZONE_POINT_VALUE[zoneBasic]
  return {
    gameId: '0022500001',
    gameEventId: 1,
    gameDate: '2025-11-01',
    opponent: 'PHX',
    home: false,
    period: 1,
    minutesRemaining: 5,
    secondsRemaining: 30,
    made,
    pointValue,
    zoneBasic,
    zoneArea: zoneBasic === 'Backcourt' ? 'Back Court(BC)' : 'Center(C)',
    zoneRange:
      zoneBasic === 'Backcourt' ? 'Back Court Shot' : pointValue === 3 ? '24+ ft' : 'Less Than 8 ft',
    distanceFt: 10,
    locX: 0,
    locY: 100,
    ...over,
  }
}

function reps(n: number, zone: BasicZone, made: boolean, over: Partial<EnrichedShot> = {}): EnrichedShot[] {
  return Array.from({ length: n }, () => shot(zone, made, over))
}

// League FG% / PPS per zone: RA .6/1.2, ITP .4/.8, MR .4/.8, LC3 .4/1.2,
// RC3 .4/1.2, ATB3 .35/1.05. League eval FGA = 4000.
const microBaseline: ZoneBaselineEntry[] = [
  { grain: 'basic', zone: 'Restricted Area', fga: 1000, fgm: 600 },
  { grain: 'basic', zone: 'In The Paint (Non-RA)', fga: 500, fgm: 200 },
  { grain: 'basic', zone: 'Mid-Range', fga: 1000, fgm: 400 },
  { grain: 'basic', zone: 'Left Corner 3', fga: 250, fgm: 100 },
  { grain: 'basic', zone: 'Right Corner 3', fga: 250, fgm: 100 },
  { grain: 'basic', zone: 'Above the Break 3', fga: 1000, fgm: 350 },
  { grain: 'basic', zone: 'Backcourt', fga: 10, fgm: 1 },
  { grain: 'midRangeBand', band: '8-16 ft', fga: 600, fgm: 270 }, // .45 / .9
  { grain: 'midRangeBand', band: '16-24 ft', fga: 400, fgm: 130 }, // .325 / .65
]

// 18 shots: 16 evaluation attempts + 2 Backcourt heaves.
const microShots: EnrichedShot[] = [
  ...reps(3, 'Restricted Area', true),
  ...reps(1, 'Restricted Area', false),
  ...reps(1, 'Mid-Range', true, { zoneRange: '8-16 ft' }),
  ...reps(1, 'Mid-Range', false, { zoneRange: '8-16 ft' }),
  ...reps(2, 'Mid-Range', false, { zoneRange: '16-24 ft' }),
  ...reps(2, 'Left Corner 3', true),
  ...reps(2, 'Left Corner 3', false),
  ...reps(1, 'Right Corner 3', true),
  ...reps(1, 'Right Corner 3', false),
  ...reps(2, 'Above the Break 3', false),
  ...reps(1, 'Backcourt', true),
  ...reps(1, 'Backcourt', false),
]

describe('aggregateShotMetrics on the hand-computed micro-fixture', () => {
  const m = aggregateShotMetrics(microShots, microBaseline)
  const zone = (z: BasicZone) => m.zones.find((r) => r.zone === z)!

  it('counts totals and reports (never hides) backcourt', () => {
    expect(m.comparisonClass).toBe('league-average')
    expect(m.totalAttempts).toBe(18)
    expect(m.evalAttempts).toBe(16)
    expect(m.backcourt).toEqual({ attempts: 2, makes: 1 })
    expect(m.zones.map((r) => r.zone)).not.toContain('Backcourt')
  })

  it('computes per-zone shares, FG%, PPS and making deltas', () => {
    const ra = zone('Restricted Area')
    expect(ra.attempts).toBe(4)
    expect(ra.makes).toBe(3)
    expect(ra.attemptShare).toBeCloseTo(0.25, 12) // 4/16
    expect(ra.leagueAttemptShare).toBeCloseTo(0.25, 12) // 1000/4000
    expect(ra.fgPct).toBeCloseTo(0.75, 12)
    expect(ra.leagueFgPct).toBeCloseTo(0.6, 12)
    expect(ra.pps).toBeCloseTo(1.5, 12)
    expect(ra.leaguePps).toBeCloseTo(1.2, 12)
    expect(ra.makingDelta).toBeCloseTo(0.15, 12)
  })

  it('yields nulls (never NaN) for a zone with no attempts', () => {
    const itp = zone('In The Paint (Non-RA)')
    expect(itp.attempts).toBe(0)
    expect(itp.attemptShare).toBe(0)
    expect(itp.fgPct).toBeNull()
    expect(itp.pps).toBeNull()
    expect(itp.makingDelta).toBeNull()
    expect(itp.leaguePps).toBeCloseTo(0.8, 12)
  })

  it('computes the headline diet-weighted expected PPS for both diets', () => {
    // player: .25*1.2 + 0*.8 + .25*.8 + .25*1.2 + .125*1.2 + .125*1.05 = 1.08125
    expect(m.selection.playerDietExpectedPps).toBeCloseTo(1.08125, 12)
    // league: .25*1.2 + .125*.8 + .25*.8 + .0625*1.2*2 + .25*1.05 = 1.0125
    expect(m.selection.leagueDietExpectedPps).toBeCloseTo(1.0125, 12)
    expect(m.selection.selectionDelta).toBeCloseTo(0.06875, 12)
  })

  it('computes the making rollup and its decomposition identity', () => {
    // eval points: RA 3x2 + MR 1x2 + LC3 2x3 + RC3 1x3 = 17; 17/16 = 1.0625
    expect(m.making.actualPps).toBeCloseTo(1.0625, 12)
    expect(m.making.makingPpsDelta).toBeCloseTo(-0.01875, 12) // 1.0625 - 1.08125
    // ADR-0016: league diet + selection delta + making delta reassembles
    // actual PPS exactly — the decomposition the headline blocks will show.
    expect(
      m.selection.leagueDietExpectedPps + m.selection.selectionDelta! + m.making.makingPpsDelta!,
    ).toBeCloseTo(m.making.actualPps!, 12)
  })

  it('rolls the combined threes up by summing, never averaging rates', () => {
    expect(m.threes.attempts).toBe(8) // LC3 4 + RC3 2 + ATB3 2
    expect(m.threes.makes).toBe(3)
    expect(m.threes.attemptShare).toBeCloseTo(0.5, 12) // 8/16
    expect(m.threes.leagueAttemptShare).toBeCloseTo(0.375, 12) // 1500/4000
    expect(m.threes.fgPct).toBeCloseTo(0.375, 12)
    // summed 550/1500 (ADR-0004) — NOT the naive zone-rate average
    // (.4+.4+.35)/3 ~= .3833, which would overweight the low-volume corners
    expect(m.threes.leagueFgPct).toBeCloseTo(550 / 1500, 12)
    expect(m.threes.leagueFgPct).not.toBeCloseTo((0.4 + 0.4 + 0.35) / 3, 3)
    expect(m.threes.pps).toBeCloseTo(1.125, 12)
    expect(m.threes.leaguePps).toBeCloseTo(1.1, 12)
    expect(m.threes.makingDelta).toBeCloseTo(0.375 - 550 / 1500, 12)
    expect(m.threes.smallSampleMaking).toBe(true) // 8 < 50
  })

  it('satisfies the identity: league diet PPS == league eval points / eval FGA', () => {
    // Sum(share_z * pps_z) must collapse to total points over total attempts —
    // a free invariant that catches renormalization bugs.
    expect(m.selection.leagueDietExpectedPps).toBeCloseTo(4050 / 4000, 12)
  })

  it('computes the mid-range band view on the diet denominator', () => {
    expect(m.midRangeSplit.visible).toBe(false) // long-two attempts 2 < 15
    const [b816, b1624] = m.midRangeSplit.bands
    expect(b816!.band).toBe('8-16 ft')
    expect(b816!.attempts).toBe(2)
    expect(b816!.attemptShare).toBeCloseTo(0.125, 12) // 2/16 of ALL eval attempts
    expect(b816!.leagueAttemptShare).toBeCloseTo(0.15, 12) // 600/4000
    expect(b816!.makingDelta).toBeCloseTo(0.05, 12) // .5 - .45
    expect(b1624!.attempts).toBe(2)
    expect(b1624!.fgPct).toBe(0)
    expect(b1624!.makingDelta).toBeCloseTo(-0.325, 12)
    expect(b1624!.leaguePps).toBeCloseTo(0.65, 12)
    // one denominator rule: the bands sum to their Mid-Range parent
    const mrShare = m.zones.find((r) => r.zone === 'Mid-Range')!.attemptShare!
    expect(b816!.attemptShare! + b1624!.attemptShare!).toBeCloseTo(mrShare, 12)
  })

  it('flags every low-volume zone and gates both secondary views', () => {
    for (const r of m.zones) {
      expect(r.included).toBe(false) // all < 15
      expect(r.smallSampleMaking).toBe(true) // all < 50
    }
    expect(m.cornerSplit.visible).toBe(false)
    expect(m.cornerSplit.left.zone).toBe('Left Corner 3')
    expect(m.cornerSplit.right.zone).toBe('Right Corner 3')
  })
})

describe('threshold boundaries', () => {
  it('includes a zone at exactly 15 attempts, not at 14', () => {
    const at15 = aggregateShotMetrics(reps(15, 'Restricted Area', true), microBaseline)
    expect(at15.zones.find((r) => r.zone === 'Restricted Area')!.included).toBe(true)
    const at14 = aggregateShotMetrics(reps(14, 'Restricted Area', true), microBaseline)
    expect(at14.zones.find((r) => r.zone === 'Restricted Area')!.included).toBe(false)
  })

  it('clears the small-sample making flag at exactly 50 attempts, not at 49', () => {
    const at50 = aggregateShotMetrics(reps(50, 'Restricted Area', true), microBaseline)
    expect(at50.zones.find((r) => r.zone === 'Restricted Area')!.smallSampleMaking).toBe(false)
    const at49 = aggregateShotMetrics(reps(49, 'Restricted Area', true), microBaseline)
    expect(at49.zones.find((r) => r.zone === 'Restricted Area')!.smallSampleMaking).toBe(true)
  })

  it('clears the combined-threes flag at exactly 50 attempts, not at 49', () => {
    const at50 = aggregateShotMetrics(reps(50, 'Above the Break 3', true), microBaseline)
    expect(at50.threes.smallSampleMaking).toBe(false)
    const at49 = aggregateShotMetrics(reps(49, 'Above the Break 3', true), microBaseline)
    expect(at49.threes.smallSampleMaking).toBe(true)
  })

  it('shows the corner split only when BOTH corners clear the bar', () => {
    const both = aggregateShotMetrics(
      [...reps(15, 'Left Corner 3', true), ...reps(15, 'Right Corner 3', true)],
      microBaseline,
    )
    expect(both.cornerSplit.visible).toBe(true)
    const oneShort = aggregateShotMetrics(
      [...reps(14, 'Left Corner 3', true), ...reps(15, 'Right Corner 3', true)],
      microBaseline,
    )
    expect(oneShort.cornerSplit.visible).toBe(false)
  })

  it('promotes the mid-range split when the long-two band is material', () => {
    const material = aggregateShotMetrics(
      reps(15, 'Mid-Range', false, { zoneRange: '16-24 ft' }),
      microBaseline,
    )
    expect(material.midRangeSplit.visible).toBe(true)
    const notMaterial = aggregateShotMetrics(
      reps(14, 'Mid-Range', false, { zoneRange: '16-24 ft' }),
      microBaseline,
    )
    expect(notMaterial.midRangeSplit.visible).toBe(false)
  })
})

describe('degenerate inputs', () => {
  it('handles an empty shots array with nulls, never NaN', () => {
    const m = aggregateShotMetrics([], microBaseline)
    expect(m.totalAttempts).toBe(0)
    expect(m.evalAttempts).toBe(0)
    expect(m.selection.playerDietExpectedPps).toBeNull()
    expect(m.selection.selectionDelta).toBeNull()
    expect(m.selection.leagueDietExpectedPps).toBeCloseTo(1.0125, 12)
    expect(m.making.actualPps).toBeNull()
    expect(m.making.makingPpsDelta).toBeNull()
    expect(m.threes.attempts).toBe(0)
    expect(m.threes.attemptShare).toBeNull()
    expect(m.threes.fgPct).toBeNull()
    expect(m.threes.makingDelta).toBeNull()
    expect(m.threes.leagueFgPct).toBeCloseTo(550 / 1500, 12) // league side still real
    for (const r of m.zones) {
      expect(r.attemptShare).toBeNull()
      expect(r.fgPct).toBeNull()
    }
  })

  it('throws on a baseline missing an evaluation zone', () => {
    const broken = microBaseline.filter((e) => !(e.grain === 'basic' && e.zone === 'Mid-Range'))
    expect(() => aggregateShotMetrics([], broken)).toThrow(/baseline unusable/)
  })

  it('throws on a player mid-range band with no baseline entry', () => {
    const noBands = microBaseline.filter((e) => e.grain !== 'midRangeBand')
    const midShot = [shot('Mid-Range', true, { zoneRange: '8-16 ft' })]
    expect(() => aggregateShotMetrics(midShot, noBands)).toThrow(/no baseline entry/)
  })
})

describe('aggregation over the committed golden', () => {
  const goldenUrl = new URL('../../tests/fixtures/derived.golden.json', import.meta.url)
  const payload = parseDerivedPayload(JSON.parse(readFileSync(goldenUrl, 'utf-8')))
  const m = aggregateShotMetrics(payload.shots, payload.zoneBaseline)

  it('matches hand-computed counts from the fixture', () => {
    expect(m.totalAttempts).toBe(15)
    expect(m.evalAttempts).toBe(14)
    expect(m.backcourt).toEqual({ attempts: 1, makes: 0 })
    // first made + first missed per zone => 2 attempts / 1 make everywhere,
    // with Mid-Range covered per band (4 attempts / 2 makes)
    for (const r of m.zones) {
      const expected = r.zone === 'Mid-Range' ? { a: 4, m: 2 } : { a: 2, m: 1 }
      expect({ a: r.attempts, m: r.makes }).toEqual(expected)
    }
    expect(m.midRangeSplit.visible).toBe(false)
    expect(m.cornerSplit.visible).toBe(false)
  })

  it('computes the real league diet PPS from the verbatim league frame', () => {
    // hand-computed: league eval points / eval FGA = 239124/219131 = 1.09124
    expect(m.selection.leagueDietExpectedPps).toBeCloseTo(1.09124, 4)
  })

  it('computes the verdict-grain rollups over the golden', () => {
    // 1 make per zone except Mid-Range (2): 2+2+4+3+3+3 = 17 points / 14 att
    expect(m.making.actualPps).toBeCloseTo(17 / 14, 12)
    expect(m.threes).toMatchObject({ attempts: 6, makes: 3 })
    expect(
      m.selection.leagueDietExpectedPps + m.selection.selectionDelta! + m.making.makingPpsDelta!,
    ).toBeCloseTo(m.making.actualPps!, 12)
  })
})

// Runs only where the gitignored real derived payload exists (dev machines);
// catches drift between the schema and actual pipeline output.
const seasonDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'data', 'derived', 'cody-williams', '2025-26',
)
const latestReal = existsSync(seasonDir)
  ? readdirSync(seasonDir).filter((f) => f.endsWith('.json')).sort().at(-1) ?? null
  : null

describe.skipIf(!latestReal)('real derived payload (launch hero, launch season)', () => {
  it('strict-parses and reproduces the pre-build gate-report numbers', () => {
    const payload = parseDerivedPayload(
      JSON.parse(readFileSync(path.join(seasonDir, latestReal!), 'utf-8')),
    )
    expect(payload.shots).toHaveLength(509)

    const m = aggregateShotMetrics(payload.shots, payload.zoneBaseline)
    const zone = (z: BasicZone) => m.zones.find((r) => r.zone === z)!
    expect(zone('Restricted Area').attempts).toBe(177)
    expect(zone('In The Paint (Non-RA)').attempts).toBe(129)
    expect(zone('Mid-Range').attempts).toBe(72)
    expect(zone('Left Corner 3').attempts).toBe(49)
    expect(zone('Right Corner 3').attempts).toBe(34)
    expect(zone('Above the Break 3').attempts).toBe(48)

    // ADR-0008: all six evaluation zones clear the volume bar...
    expect(m.zones.every((r) => r.included)).toBe(true)
    // ...both hero refinements ship...
    expect(m.midRangeSplit.visible).toBe(true) // 33 long twos >= 15
    expect(m.cornerSplit.visible).toBe(true) // L49 / R34
    // ...and per-corner making carries the small-sample flag.
    expect(m.cornerSplit.left.smallSampleMaking).toBe(true)
    expect(m.cornerSplit.right.smallSampleMaking).toBe(true)

    // hand-computed headline: selection nearly league-average
    expect(m.selection.playerDietExpectedPps).toBeCloseTo(1.0986, 3)
    expect(m.selection.leagueDietExpectedPps).toBeCloseTo(1.0912, 3)

    // verdict-grain rollups (ADR-0016): making is the story, and it is
    // carried by the combined threes — which clear the small-sample bar
    // even though every individual 3PT zone is flagged.
    expect(m.making.actualPps).toBeCloseTo(0.9902, 3)
    expect(m.making.makingPpsDelta).toBeCloseTo(-0.1084, 3)
    expect(m.threes.attempts).toBe(131)
    expect(m.threes.makes).toBe(28)
    expect(m.threes.smallSampleMaking).toBe(false)
    expect(m.threes.makingDelta).toBeCloseTo(-0.1458, 3)
  })
})
