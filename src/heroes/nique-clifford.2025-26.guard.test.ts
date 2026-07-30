// The committed verdict guard (ADR-0017) for Nique Clifford's 2025-26 season
// argument, colocated with the hero copy it keeps honest (ADR-0022/0060/
// 0063). Every directional claim is asserted against the DEPLOYED payloads'
// metrics; when the data moves, rewrite the copy and this mapping together —
// never loosen an assertion.
//
// Clifford is the roster's first FOURTH-quadrant argument: selection and
// making both materially negative — the diet costs value AND the conversion
// falls short of even that diet. The making claims speak at the grain the
// samples support (rim / paint / mid-range / the threes combined — the
// ADR-0016 rollup pattern), and the one warm zone signal (the right corner,
// 26 FGA) is stated WITH its flag, never unhedged.
//
// Current verdict (voice per docs/voice/VOICE.md, ADR-0070), claim by claim:
//   "misses on both halves of the question"                  -> claims 1 + 2
//   "trades the rim for paint floaters and mid-range
//    jumpers"                                                -> claim 3
//   "a diet that costs him real value"                       -> claim 1
//   "shoots worse than even that diet should yield"          -> claim 2
//   "the rim is about the only place Clifford breaks even,
//    and the shortfall shows up nearly everywhere else"      -> claim 4
//   "even on wide-open looks"                                -> why 1 (creation)
//   "that make up nearly three in ten of his attempts"       -> why 2 (creation)
//   "worth watching whether the right corner holds up on
//    real volume"                                            -> claim 5 (flagged
//                                                               warm, stated with
//                                                               its thinness)
//   "gets there at under two-thirds of the league rate"      -> line 1 (free throw)
//   "converts well below average once he does"               -> line 2 (free throw)
//   ("the free throw line doesn't soften any of it" is the rhetorical frame
//    of line 1 + line 2: neither generation nor conversion offsets the
//    two-axis story.)

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { makingDeltaBin } from '../chart/makingScale'
import type { ShotMetrics } from '../domain/aggregate'
import { aggregateShotMetrics } from '../domain/aggregate'
import { aggregateCreationMetrics } from '../domain/aggregateCreation'
import { aggregateFreethrowMetrics } from '../domain/aggregateFreethrow'
import { parseCreationPayload } from '../domain/creationPayload'
import { parseFreethrowPayload } from '../domain/freethrowPayload'
import { parseDerivedPayload } from '../domain/payload'
import { authoringProblems } from './authoring'
import { niqueClifford as hero } from './nique-clifford'
import { seasonArgumentOf } from './types'
import type { CreationClaim, FreethrowClaim } from './verdictLexicon'
import {
  invalidAssistInterpretationsIn,
  unbackedAssistTerms,
  unbackedCreationTerms,
  unbackedFreethrowTerms,
  unshippedTermsIn,
} from './verdictLexicon'
import { MATERIAL_PPS, WELL_FT_PCT } from './verdictLadder'

// The guarded season argument, selected explicitly (ADR-0060/0061): a flip
// moving the canonical pointer must never silently repoint these claims at
// a different season's data.
const seasonConfig = seasonArgumentOf(hero, '2025-26')

const payloadPath = path.resolve(
  process.cwd(),
  'public',
  'data',
  hero.slug,
  `${seasonConfig.season}.json`,
)
const creationPath = path.resolve(
  process.cwd(),
  'public',
  'data',
  hero.slug,
  `${seasonConfig.season}.creation.json`,
)
const freethrowPath = path.resolve(
  process.cwd(),
  'public',
  'data',
  hero.slug,
  `${seasonConfig.season}.freethrow.json`,
)

// Verdict semantics — thresholds the prose is held to, priced from the
// house ladder (ADR-0068):
// "a diet that costs him real value": a bare directional cost prices at
// material. Actual −0.051: a 0.001 margin, acceptable only because the
// season is frozen (the Ace precedent, ADR-0068); on a living season the
// sentence would be rewritten.
const MATERIAL_SELECTION_COST_PPS = MATERIAL_PPS
// "shoots worse than even that diet should yield": a bare directional
// shortfall prices at material (actual: −0.074).
const MATERIAL_MAKING_SHORTFALL_PPS = MATERIAL_PPS
// "breaks even" at the rim: the making scale's neutral band, exactly
// (ADR-0013 semantics — a warm rim would make "breaks even" the wrong
// word too; actual −0.4 pp on 111 FGA, unflagged).
// "the shortfall shows up nearly everywhere else": paint, mid-range, and
// the combined threes all bin cold at sample-safe grain (the ADR-0016
// rollup — Above the Break alone reads neutral, which is what "about the
// only" and "nearly everywhere" honestly hedge); no unflagged zone bins
// warm.
// "worth watching whether the right corner holds up on real volume": the
// right corner bins warm AND carries the small-sample flag — the flag's
// presence is part of the claim, because "on real volume" asserts the
// current 26 attempts are not yet real volume.
const WARM_BIN_MIN = 1
// "nearly three in ten of his attempts" (wide-open share): a TWO-SIDED
// band (ADR-0068's approximation-word discipline; actual: 29.0%).
const NEARLY_THREE_IN_TEN_FLOOR = 0.25
const NEARLY_THREE_IN_TEN_CEILING = 0.3
// "the shortfall shows up ... on wide-open looks": a bare directional
// shortfall prices at material (actual: 0.988 vs 1.178 — a 0.190 gap).
const BELOW_PPS = MATERIAL_PPS
// "under two-thirds of the league rate": a one-sided ratio ceiling,
// declared locally (actual: 0.163 / 0.161 without technicals, vs league
// 0.264 — 0.62x / 0.61x).
const TWO_THIRDS_CEILING = 2 / 3
// "converts well below average": the ladder's FT "well" bar (actual:
// 0.722 / 0.719 without technicals, vs league 0.783).
const WELL_BELOW_FT_PCT = WELL_FT_PCT

// The verdict's directional shot claims (ADR-0017): one entry per claim,
// named after the verdict words it backs, asserted against the shot
// metrics. Shot claims need no lexicon licensing (two-axis vocabulary is
// always legal), so the type is local.
interface ShotClaim {
  name: string
  assert: (m: ShotMetrics) => void
}

const shotClaims: ShotClaim[] = [
  {
    name: 'claim 1: the diet costs him real value, material selection cost',
    assert: (m) => {
      expect(m.selection.selectionDelta).not.toBeNull()
      expect(m.selection.selectionDelta!).toBeLessThanOrEqual(-MATERIAL_SELECTION_COST_PPS)
    },
  },
  {
    name: 'claim 2: shoots worse than the diet should yield, material making shortfall',
    assert: (m) => {
      expect(m.making.makingPpsDelta).not.toBeNull()
      expect(m.making.makingPpsDelta!).toBeLessThanOrEqual(-MATERIAL_MAKING_SHORTFALL_PPS)
    },
  },
  {
    name: 'claim 3: trades the rim for paint floaters and mid-range jumpers',
    assert: (m) => {
      const zone = (z: string) => m.zones.find((r) => r.zone === z)!
      const ra = zone('Restricted Area')
      expect(ra.attemptShare).not.toBeNull()
      expect(ra.attemptShare!).toBeLessThan(ra.leagueAttemptShare)
      const paint = zone('In The Paint (Non-RA)')
      expect(paint.attemptShare!).toBeGreaterThan(paint.leagueAttemptShare)
      const mid = zone('Mid-Range')
      expect(mid.attemptShare!).toBeGreaterThan(mid.leagueAttemptShare)
    },
  },
  {
    name: 'claim 4: breaks even at the rim, the shortfall nearly everywhere else',
    assert: (m) => {
      // The rim reads exactly neutral (ADR-0013's band), sample-safe.
      const rim = m.zones.find((r) => r.zone === 'Restricted Area')!
      expect(rim.smallSampleMaking).toBe(false)
      expect(makingDeltaBin(rim.makingDelta)).toBe(0)
      // The shortfall, at sample-safe grain: paint and mid-range cold, the
      // arc cold at the combined-threes rollup (ADR-0016).
      for (const name of ['In The Paint (Non-RA)', 'Mid-Range']) {
        const row = m.zones.find((r) => r.zone === name)!
        expect(row.smallSampleMaking, name).toBe(false)
        expect(makingDeltaBin(row.makingDelta), name).toBeLessThan(0)
      }
      expect(m.threes.smallSampleMaking).toBe(false)
      expect(makingDeltaBin(m.threes.makingDelta)).toBeLessThan(0)
      // "about the only": no unflagged zone anywhere bins warm.
      for (const row of m.zones.filter((r) => !r.smallSampleMaking)) {
        expect(makingDeltaBin(row.makingDelta), row.zone).toBeLessThanOrEqual(0)
      }
    },
  },
  {
    name: 'claim 5: the right corner reads warm, on a sample the flag calls thin',
    assert: (m) => {
      const rc = m.zones.find((r) => r.zone === 'Right Corner 3')!
      expect(makingDeltaBin(rc.makingDelta)).toBeGreaterThanOrEqual(WARM_BIN_MIN)
      // "on real volume" claims the current volume is NOT yet real: the
      // small-sample flag must be set for the hedge to be honest.
      expect(rc.smallSampleMaking).toBe(true)
    },
  },
]

// The creation-kind claims (ADR-0029): declaring these licenses the
// verdict's creation vocabulary ('wide-open', 'jumpers').
const creationClaims: CreationClaim[] = [
  {
    name: 'why 1: wide-open looks make up nearly three in ten attempts',
    assert: (c) => {
      const wideOpen = c.closestDefender.find((b) => b.band === 'Wide open')!
      expect(wideOpen.attemptShare).not.toBeNull()
      expect(wideOpen.attemptShare!).toBeGreaterThanOrEqual(NEARLY_THREE_IN_TEN_FLOOR)
      expect(wideOpen.attemptShare!).toBeLessThanOrEqual(NEARLY_THREE_IN_TEN_CEILING)
    },
  },
  {
    name: 'why 2: the shortfall shows up even on wide-open looks, sample-safe',
    assert: (c) => {
      const wideOpen = c.closestDefender.find((b) => b.band === 'Wide open')!
      expect(wideOpen.pps).not.toBeNull()
      expect(wideOpen.leaguePps).not.toBeNull()
      // stated unhedged in the verdict, so it must clear the † bar
      expect(wideOpen.smallSamplePps).toBe(false)
      expect(wideOpen.leaguePps! - wideOpen.pps!).toBeGreaterThanOrEqual(BELOW_PPS)
    },
  },
]

// The line-sentence's free-throw claims (ADR-0055/0056): every assertion
// on a league-baselined metric holds on BOTH technical cuts.
const freethrowClaims: FreethrowClaim[] = [
  {
    name: 'line 1: gets to the line at under two-thirds of the league rate, on both cuts',
    assert: (f) => {
      const rate = f.seasonLine.ftaRate
      expect(rate.value).not.toBeNull()
      expect(rate.withoutTechnicals).not.toBeNull()
      expect(rate.value!).toBeLessThan(rate.league * TWO_THIRDS_CEILING)
      expect(rate.withoutTechnicals!).toBeLessThan(rate.league * TWO_THIRDS_CEILING)
    },
  },
  {
    name: 'line 2: converts well below average once there, on both cuts, sample-safe',
    assert: (f) => {
      const conv = f.seasonLine.conversion
      expect(conv.value).not.toBeNull()
      expect(conv.withoutTechnicals).not.toBeNull()
      // stated unhedged in the verdict, so it must clear the † bar
      expect(f.seasonLine.smallSampleConversion).toBe(false)
      expect(conv.league - conv.value!).toBeGreaterThanOrEqual(WELL_BELOW_FT_PCT)
      expect(conv.league - conv.withoutTechnicals!).toBeGreaterThanOrEqual(WELL_BELOW_FT_PCT)
    },
  },
]

// Loaded only when every payload is deployed; the suite below skips
// otherwise. (A skipped describe still executes its factory at collection,
// so the loads cannot live at describe scope.)
function loadMetrics() {
  const payload = parseDerivedPayload(JSON.parse(readFileSync(payloadPath, 'utf-8')))
  return {
    shot: aggregateShotMetrics(payload.shots, payload.zoneBaseline),
    creation: aggregateCreationMetrics(
      parseCreationPayload(JSON.parse(readFileSync(creationPath, 'utf-8'))),
    ),
    freethrow: aggregateFreethrowMetrics(
      parseFreethrowPayload(JSON.parse(readFileSync(freethrowPath, 'utf-8'))),
    ),
  }
}
const deployed =
  existsSync(payloadPath) && existsSync(creationPath) && existsSync(freethrowPath)
const metrics = deployed ? loadMetrics() : null

describe.skipIf(metrics === null)(
  'verdict guard: Nique Clifford 2025-26 (ADR-0017/0029)',
  () => {
    for (const claim of shotClaims) {
      it(claim.name, () => claim.assert(metrics!.shot))
    }

    // The why-sentence's creation-kind claims (ADR-0029), run against the
    // deployed creation payload's metrics.
    for (const claim of creationClaims) {
      it(claim.name, () => claim.assert(metrics!.creation))
    }

    // The line-sentence's free-throw claims (ADR-0055/0056), run against the
    // deployed free-throw payload's metrics.
    for (const claim of freethrowClaims) {
      it(claim.name, () => claim.assert(metrics!.freethrow))
    }

    it('vocabulary is claim-backed; unshipped vocabulary absent (ADR-0029)', () => {
      // Case 2 vocabulary requires a creation claim, free-throw vocabulary a
      // free-throw claim. Case 3 assist vocabulary is independently gated;
      // Clifford's current verdict chooses not to use it.
      expect(unshippedTermsIn(seasonConfig.verdict)).toEqual([])
      expect(unbackedCreationTerms(seasonConfig.verdict, creationClaims.length)).toEqual([])
      expect(unbackedFreethrowTerms(seasonConfig.verdict, freethrowClaims.length)).toEqual([])
      expect(unbackedAssistTerms(seasonConfig.verdict, 0)).toEqual([])
      expect(invalidAssistInterpretationsIn(seasonConfig.verdict)).toEqual([])
    })
  },
)

// The authoring tripwire (ADR-0063): deliberately OUTSIDE the payload
// skipIf — no data needed, so it holds on clean clones and CI alike.
describe('authoring completeness (ADR-0063)', () => {
  it('no scaffold sentinel remains and referenced banner assets exist', () => {
    expect(authoringProblems(hero, seasonConfig)).toEqual([])
  })
})
