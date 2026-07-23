// The committed verdict guard (ADR-0017) for Ace Bailey, colocated with the
// hero copy it keeps honest (ADR-0022). Every directional claim is asserted
// against the DEPLOYED payloads' metrics; when the data moves, rewrite the
// copy and this mapping together — never loosen an assertion.
//
// Ace is the third quadrant of the two-axis model among registered heroes:
// selection carries the argument (a mid-range and long-two diet), making is
// essentially league. The line sentence is the diet's consequence stated at
// the line: a jump-shot diet forfeits trips.
//
// Current verdict, claim by claim:
//   "the reason is the diet, not the touch"                  -> claims 1 + 4
//   "mid-range jumpers at more than double the league share" -> claim 2
//   "long twos at nearly triple it"                          -> claim 2 (band)
//   "the rim attempts they trade away are the most valuable
//    shots on the floor"                                     -> claim 3
//   "conversion is essentially league average overall"       -> claim 4
//   "a genuinely warm paint touch underneath"                -> claim 5
//   "pull-ups convert above league value"                    -> why 1 (creation)
//   "the easier catch-and-shoot looks land well below it"    -> why 2 (creation)
//   "reaches the free-throw line at well under half the
//    league rate"                                            -> line 1 (free throw)
//   "the priciest trips to the line barely touch his
//    scoring"                                                -> line 2 (free throw)
//   ("the line compounds the diet" is the rhetorical frame of line 1 + 2.)

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { makingDeltaBin } from '../chart/makingScale'
import { aggregateShotMetrics } from '../domain/aggregate'
import { aggregateCreationMetrics } from '../domain/aggregateCreation'
import { aggregateFreethrowMetrics } from '../domain/aggregateFreethrow'
import { LONG_TWO_BAND } from '../domain/constants'
import { parseCreationPayload } from '../domain/creationPayload'
import { parseFreethrowPayload } from '../domain/freethrowPayload'
import { parseDerivedPayload } from '../domain/payload'
import { aceBailey as hero } from './ace-bailey'
import type { CreationClaim, FreethrowClaim } from './verdictLexicon'
import {
  invalidAssistInterpretationsIn,
  unbackedAssistTerms,
  unbackedCreationTerms,
  unbackedFreethrowTerms,
  unshippedTermsIn,
} from './verdictLexicon'

const payloadPath = path.resolve(
  process.cwd(),
  'public',
  'data',
  hero.slug,
  `${hero.season}.json`,
)
const creationPath = path.resolve(
  process.cwd(),
  'public',
  'data',
  hero.slug,
  `${hero.season}.creation.json`,
)
const freethrowPath = path.resolve(
  process.cwd(),
  'public',
  'data',
  hero.slug,
  `${hero.season}.freethrow.json`,
)

// Verdict semantics — thresholds the prose is held to:
// "the diet, not the touch" / "essentially league average": the ADR-0017
// ±0.02 PPS band — selection must sit below it, making inside it
// (actual: selection −0.038, making −0.014).
const NEUTRAL_BAND_PPS = 0.02
// "more than double the league share": mid-range share at least 2x the
// league's (actual: 22.2% vs 10.1% — 2.19x).
const DOUBLE_SHARE = 2
// "nearly triple": the long-two band's diet share at least 2.5x the
// league's (actual: 14.2% vs 4.9% — 2.90x).
const NEARLY_TRIPLE_SHARE = 2.5
// "a genuinely warm paint touch": the paint zone bins warm on the making
// scale (ADR-0013 semantics — at least warm-1; actual +11.7 pp, warm-2),
// unflagged (119 FGA).
const WARM_BIN_MIN = 1
// "convert above league value": a PPS gap past the neutral band (actual:
// pull-ups +0.051).
const ABOVE_PPS = 0.02
// "land well below it": a PPS gap of at least 0.10 — twice the materiality
// bar (actual: catch-and-shoot 0.924 vs league 1.100, gap 0.176).
const WELL_BELOW_PPS = 0.1
// "well under half the league rate" / "barely touch his scoring": at most
// half the league value, on BOTH technical cuts (ADR-0055). Actual FTA
// rate: 0.099 / 0.096 vs league 0.264 (0.37x); FT points share:
// 0.066 / 0.064 vs league 0.159 (0.41x).
const HALF_CEILING = 0.5

// The creation-kind claims (ADR-0029): declaring these licenses the
// verdict's creation vocabulary ('jumpers', 'creation', 'pull-ups',
// 'catch-and-shoot').
const creationClaims: CreationClaim[] = [
  {
    name: 'why 1: pull-ups convert above league value, sample-safe',
    assert: (c) => {
      const pu = c.general.jumperContexts.find((r) => r.context === 'Pull Ups')!
      expect(pu.pps).not.toBeNull()
      expect(pu.smallSamplePps).toBe(false)
      expect(pu.pps! - pu.leaguePps!).toBeGreaterThanOrEqual(ABOVE_PPS)
    },
  },
  {
    name: 'why 2: catch-and-shoot lands well below league value on the easier context, sample-safe',
    assert: (c) => {
      const cs = c.general.jumperContexts.find((r) => r.context === 'Catch and Shoot')!
      const pu = c.general.jumperContexts.find((r) => r.context === 'Pull Ups')!
      expect(cs.pps).not.toBeNull()
      expect(cs.smallSamplePps).toBe(false)
      expect(cs.leaguePps! - cs.pps!).toBeGreaterThanOrEqual(WELL_BELOW_PPS)
      // "easier": the league itself converts the catch-and-shoot context
      // better than the pull-up context — the inversion is his, not the
      // league's.
      expect(cs.leaguePps!).toBeGreaterThan(pu.leaguePps!)
    },
  },
]

// The line-sentence's free-throw claims (ADR-0055/0056): every assertion
// holds on BOTH technical cuts. Both are ratios of season totals, not
// conversion estimates, so the † discipline does not bind them; his 88
// season FTA would clear the bar regardless.
const freethrowClaims: FreethrowClaim[] = [
  {
    name: 'line 1: FTA rate at most half the league rate, on both cuts',
    assert: (f) => {
      const rate = f.seasonLine.ftaRate
      expect(rate.value).not.toBeNull()
      expect(rate.withoutTechnicals).not.toBeNull()
      expect(rate.value!).toBeLessThanOrEqual(rate.league * HALF_CEILING)
      expect(rate.withoutTechnicals!).toBeLessThanOrEqual(rate.league * HALF_CEILING)
    },
  },
  {
    name: 'line 2: FT points share at most half the league share, on both cuts',
    assert: (f) => {
      const share = f.seasonLine.ftPointsShare
      expect(share.value).not.toBeNull()
      expect(share.withoutTechnicals).not.toBeNull()
      expect(share.value!).toBeLessThanOrEqual(share.league * HALF_CEILING)
      expect(share.withoutTechnicals!).toBeLessThanOrEqual(share.league * HALF_CEILING)
    },
  },
]

describe.skipIf(
  !existsSync(payloadPath) || !existsSync(creationPath) || !existsSync(freethrowPath),
)('verdict guard: Ace Bailey (ADR-0017/0029)', () => {
  const payload = parseDerivedPayload(JSON.parse(readFileSync(payloadPath, 'utf-8')))
  const m = aggregateShotMetrics(payload.shots, payload.zoneBaseline)
  const zone = (z: string) => m.zones.find((r) => r.zone === z)!
  const creation = aggregateCreationMetrics(
    parseCreationPayload(JSON.parse(readFileSync(creationPath, 'utf-8'))),
  )
  const freethrow = aggregateFreethrowMetrics(
    parseFreethrowPayload(JSON.parse(readFileSync(freethrowPath, 'utf-8'))),
  )

  it('claim 1: selection sits below the league diet, past the neutral band', () => {
    expect(m.selection.selectionDelta).not.toBeNull()
    expect(m.selection.selectionDelta!).toBeLessThanOrEqual(-NEUTRAL_BAND_PPS)
  })

  it('claim 2: mid-range at more than double the league share, long twos at nearly triple', () => {
    const mid = zone('Mid-Range')
    expect(mid.attemptShare).not.toBeNull()
    expect(mid.attemptShare!).toBeGreaterThanOrEqual(mid.leagueAttemptShare * DOUBLE_SHARE)
    // The long-two claim is stated at the band grain the split ships
    // (ADR-0008 — visible for this hero because 16-24 ft clears the bar).
    expect(m.midRangeSplit.visible).toBe(true)
    const longTwo = m.midRangeSplit.bands.find((b) => b.band === LONG_TWO_BAND)!
    expect(longTwo.attemptShare).not.toBeNull()
    expect(longTwo.attemptShare!).toBeGreaterThanOrEqual(
      longTwo.leagueAttemptShare * NEARLY_TRIPLE_SHARE,
    )
  })

  it('claim 3: rim attempts below the league share, and the rim is the most valuable zone', () => {
    const ra = zone('Restricted Area')
    expect(ra.attemptShare).not.toBeNull()
    expect(ra.attemptShare!).toBeLessThan(ra.leagueAttemptShare)
    // "the most valuable shots on the floor": the league's own PPS ranks
    // the Restricted Area first among the evaluation zones.
    for (const z of m.zones) {
      expect(ra.leaguePps).toBeGreaterThanOrEqual(z.leaguePps)
    }
  })

  it('claim 4: making is essentially league average overall', () => {
    expect(m.making.makingPpsDelta).not.toBeNull()
    expect(Math.abs(m.making.makingPpsDelta!)).toBeLessThanOrEqual(NEUTRAL_BAND_PPS)
  })

  it('claim 5: the paint touch bins warm, sample-safe', () => {
    const paint = zone('In The Paint (Non-RA)')
    expect(paint.smallSampleMaking).toBe(false)
    expect(makingDeltaBin(paint.makingDelta)).toBeGreaterThanOrEqual(WARM_BIN_MIN)
  })

  // The why-sentence's creation-kind claims (ADR-0029), run against the
  // deployed creation payload's metrics.
  for (const claim of creationClaims) {
    it(claim.name, () => claim.assert(creation))
  }

  // The line-sentence's free-throw claims (ADR-0055/0056), run against the
  // deployed free-throw payload's metrics.
  for (const claim of freethrowClaims) {
    it(claim.name, () => claim.assert(freethrow))
  }

  it('creation and line vocabulary are claim-backed; unshipped vocabulary absent (ADR-0029)', () => {
    expect(unshippedTermsIn(hero.verdict)).toEqual([])
    expect(unbackedCreationTerms(hero.verdict, creationClaims.length)).toEqual([])
    expect(unbackedFreethrowTerms(hero.verdict, freethrowClaims.length)).toEqual([])
    expect(unbackedAssistTerms(hero.verdict, 0)).toEqual([])
    expect(invalidAssistInterpretationsIn(hero.verdict)).toEqual([])
  })
})
