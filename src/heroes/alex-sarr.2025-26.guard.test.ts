// The committed verdict guard (ADR-0017) for Alex Sarr's 2025-26 season
// argument, colocated with the hero copy it keeps honest (ADR-0022/0060/
// 0063). Every directional claim is asserted against the DEPLOYED payloads'
// metrics; when the data moves, rewrite the copy and this mapping together —
// never loosen an assertion.
//
// Sarr is the neutral-selection case: a paint-heavy diet that abandons the
// corners almost entirely, yet nets out INSIDE the neutral band (−0.010) —
// so the v1 question answers yes and the whole cost lands on the making
// axis. Claim 3 is therefore a two-sided band, not a directional floor: the
// verdict's "essentially league-average shot diet" would be false if the
// selection Δ ever grew in EITHER direction.
//
// Current verdict (voice per docs/voice/VOICE.md, ADR-0070), claim by claim:
//   "lives in the paint"                                          -> claim 1
//   "barely touches the corners"                                  -> claim 2
//   "nets out to an essentially league-average shot diet"         -> claim 3
//   "the problem is his shot making" / "converts a bit below
//    what that diet should yield"                                 -> claim 4
//   "finishes above average at the rim"                           -> claim 5
//   "everything from the short paint out through the mid-range
//    sits below"                                                  -> claim 6
//   "nearly two in ten of his attempts come wide open"            -> why 1 (creation)
//   "those are the ones that land far below average"              -> why 2 (creation)
//   "earns trips a bit less often than average"                   -> line 1 (free throw)
//   "converts well below the league rate once he gets there"      -> line 2 (free throw)
//   ("the free throw line doesn't help" is the rhetorical frame of line 1 +
//    line 2: neither cut of the line offsets the making shortfall.)

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
import { alexSarr as hero } from './alex-sarr'
import { seasonArgumentOf } from './types'
import type { CreationClaim, FreethrowClaim } from './verdictLexicon'
import {
  invalidAssistInterpretationsIn,
  unbackedAssistTerms,
  unbackedCreationTerms,
  unbackedFreethrowTerms,
  unshippedTermsIn,
} from './verdictLexicon'
import {
  FAR_FTA_RATE,
  FAR_PPS,
  FTA_RATE_FLOOR,
  MATERIAL_PPS,
  NEUTRAL_BAND_PPS,
  WELL_FT_PCT,
} from './verdictLadder'

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
// "lives in the paint": more than half his attempts across the two paint
// zones (one denominator, so the sum is arithmetic, not a re-aggregation),
// AND a bigger share of them than the league takes (actual: 35.1% RA +
// 31.4% non-RA paint = 66.5%, vs the league's 48.4%).
const MORE_THAN_HALF = 0.5
// "barely touches the corners": at most one attempt in twenty across both
// corners (actual: 1.7% combined, vs the league's 10.8% — a 0.16x share).
const BARELY_TOUCHES_SHARE = 0.05
// "nets out to an essentially league-average shot diet": the ladder's
// neutral band, TWO-SIDED — this claim fails if the selection Δ grows in
// either direction (actual: −0.010).
const ESSENTIALLY_AVERAGE_PPS = NEUTRAL_BAND_PPS
// "converts a bit below what that diet should yield": the hedged rung —
// past neutral but SHORT of material, which is exactly what licenses "a
// bit" and forbids a bare "below" (actual: −0.042). Two-sided by
// construction: both ends are asserted below.
const A_BIT_FLOOR_PPS = NEUTRAL_BAND_PPS
const A_BIT_CEILING_PPS = MATERIAL_PPS
// "finishes above average at the rim": the restricted area bins warm on
// the making scale (ADR-0013 semantics — at least warm-1; actual +3.3 pp),
// unflagged (230 FGA).
const WARM_BIN_MIN = 1
// "everything from the short paint out through the mid-range sits below":
// both zones bin cold, unflagged (actual: non-RA paint −5.2 pp and
// mid-range −8.8 pp, both cold-1). Scoped deliberately: the three-point
// zones are NOT claimed here, because above-the-break threes bin neutral
// (−1.9 pp) and the right corner is warm — "everywhere else" would have
// been false.
const COLD_BIN_MAX = -1
// "earns trips a bit less often than average": past the FTA-rate floor
// that licenses any directional claim, but short of the bar where "far
// less often" begins — a TWO-SIDED band, held on both cuts (actual:
// −0.041 on both).
const A_BIT_FTA_FLOOR = FTA_RATE_FLOOR
const A_BIT_FTA_CEILING = FAR_FTA_RATE
// "converts well below the league rate": the FT-conversion family's "well"
// bar, held on both cuts (actual: −0.091 on both, so the word clears with
// real margin).
const WELL_BELOW_FT_PCT = WELL_FT_PCT
// "nearly two in ten of his attempts come wide open": a TWO-SIDED band
// (ADR-0068's approximation-word discipline; actual: 18.4%).
const NEARLY_TWO_IN_TEN_FLOOR = 0.15
const NEARLY_TWO_IN_TEN_CEILING = 0.2
// "land far below average": the ladder's far bar (actual: −0.269).
const FAR_BELOW_PPS = FAR_PPS

// The verdict's directional shot claims (ADR-0017): one entry per claim,
// named after the verdict words it backs, asserted against the shot
// metrics. Shot claims need no lexicon licensing (two-axis vocabulary is
// always legal), so the type is local.
interface ShotClaim {
  name: string
  assert: (m: ShotMetrics) => void
}

const zoneOf = (m: ShotMetrics, name: string) => m.zones.find((r) => r.zone === name)!

const shotClaims: ShotClaim[] = [
  {
    name: 'claim 1: lives in the paint, more than half his attempts and above the league share',
    assert: (m) => {
      const ra = zoneOf(m, 'Restricted Area')
      const paint = zoneOf(m, 'In The Paint (Non-RA)')
      expect(ra.attemptShare).not.toBeNull()
      expect(paint.attemptShare).not.toBeNull()
      const his = ra.attemptShare! + paint.attemptShare!
      expect(his).toBeGreaterThan(MORE_THAN_HALF)
      expect(his).toBeGreaterThan(ra.leagueAttemptShare + paint.leagueAttemptShare)
    },
  },
  {
    name: 'claim 2: barely touches the corners',
    assert: (m) => {
      const left = zoneOf(m, 'Left Corner 3')
      const right = zoneOf(m, 'Right Corner 3')
      expect(left.attemptShare).not.toBeNull()
      expect(right.attemptShare).not.toBeNull()
      expect(left.attemptShare! + right.attemptShare!).toBeLessThanOrEqual(BARELY_TOUCHES_SHARE)
    },
  },
  {
    name: 'claim 3: the tradeoff nets out to an essentially league-average diet, two-sided',
    assert: (m) => {
      expect(m.selection.selectionDelta).not.toBeNull()
      expect(Math.abs(m.selection.selectionDelta!)).toBeLessThanOrEqual(ESSENTIALLY_AVERAGE_PPS)
    },
  },
  {
    name: 'claim 4: shot making is the problem, a bit below what the diet should yield',
    assert: (m) => {
      expect(m.making.makingPpsDelta).not.toBeNull()
      const gap = Math.abs(m.making.makingPpsDelta!)
      // "the problem is his shot making": the making axis is negative.
      expect(m.making.makingPpsDelta!).toBeLessThan(0)
      // "a bit below": past neutral, so a directional word is licensed at
      // all...
      expect(gap).toBeGreaterThan(A_BIT_FLOOR_PPS)
      // ...but short of material, so the hedge is REQUIRED. If this end
      // ever fails, the copy must be re-graded upward, not the bar moved.
      expect(gap).toBeLessThan(A_BIT_CEILING_PPS)
    },
  },
  {
    name: 'claim 5: finishes above average at the rim, sample-safe',
    assert: (m) => {
      const ra = zoneOf(m, 'Restricted Area')
      expect(ra.smallSampleMaking).toBe(false)
      expect(makingDeltaBin(ra.makingDelta)).toBeGreaterThanOrEqual(WARM_BIN_MIN)
    },
  },
  {
    name: 'claim 6: short paint out through the mid-range sits below, both sample-safe',
    assert: (m) => {
      for (const name of ['In The Paint (Non-RA)', 'Mid-Range']) {
        const zone = zoneOf(m, name)
        // stated unhedged in the verdict, so both must clear the † bar
        expect(zone.smallSampleMaking).toBe(false)
        expect(makingDeltaBin(zone.makingDelta)).toBeLessThanOrEqual(COLD_BIN_MAX)
      }
    },
  },
]

// The creation-kind claims (ADR-0029): declaring these licenses the
// verdict's creation vocabulary ('wide open').
const creationClaims: CreationClaim[] = [
  {
    name: 'why 1: nearly two in ten of his attempts come wide open, two-sided',
    assert: (c) => {
      const wide = c.closestDefender.find((b) => b.band === 'Wide open')!
      expect(wide.attemptShare).not.toBeNull()
      expect(wide.attemptShare!).toBeGreaterThanOrEqual(NEARLY_TWO_IN_TEN_FLOOR)
      expect(wide.attemptShare!).toBeLessThanOrEqual(NEARLY_TWO_IN_TEN_CEILING)
    },
  },
  {
    name: 'why 2: those wide-open looks land far below average, sample-safe',
    assert: (c) => {
      const wide = c.closestDefender.find((b) => b.band === 'Wide open')!
      expect(wide.pps).not.toBeNull()
      expect(wide.leaguePps).not.toBeNull()
      // stated unhedged in the verdict, so it must clear the † bar
      expect(wide.smallSamplePps).toBe(false)
      expect(wide.pps! - wide.leaguePps!).toBeLessThanOrEqual(-FAR_BELOW_PPS)
    },
  },
]

// Assist vocabulary needs its own claim kind over the shot-context payload
// (AssistClaim, worst-case bounds); this verdict makes no assist claim, so
// the tripwire below holds it at zero.

// The line-sentence's free-throw claims (ADR-0055/0056): every assertion
// on a league-baselined metric holds on BOTH technical cuts.
const freethrowClaims: FreethrowClaim[] = [
  {
    name: 'line 1: earns trips a bit less often than average, two-sided on both cuts',
    assert: (f) => {
      const rate = f.seasonLine.ftaRate
      expect(rate.value).not.toBeNull()
      expect(rate.withoutTechnicals).not.toBeNull()
      for (const cut of [rate.value!, rate.withoutTechnicals!]) {
        const gap = rate.league - cut
        // "less often than average", past the directional floor...
        expect(gap).toBeGreaterThan(A_BIT_FTA_FLOOR)
        // ...but short of "far", which is what the hedge promises.
        expect(gap).toBeLessThan(A_BIT_FTA_CEILING)
      }
    },
  },
  {
    name: 'line 2: converts well below the league rate, both cuts, sample-safe',
    assert: (f) => {
      const conv = f.seasonLine.conversion
      expect(conv.value).not.toBeNull()
      expect(conv.withoutTechnicals).not.toBeNull()
      // stated unhedged in the verdict, so it must clear the † bar
      expect(f.seasonLine.smallSampleConversion).toBe(false)
      for (const cut of [conv.value!, conv.withoutTechnicals!]) {
        expect(cut - conv.league).toBeLessThanOrEqual(-WELL_BELOW_FT_PCT)
      }
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

describe.skipIf(metrics === null)('verdict guard: Alex Sarr 2025-26 (ADR-0017/0029)', () => {
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
    expect(unshippedTermsIn(seasonConfig.verdict)).toEqual([])
    expect(unbackedCreationTerms(seasonConfig.verdict, creationClaims.length)).toEqual([])
    expect(unbackedFreethrowTerms(seasonConfig.verdict, freethrowClaims.length)).toEqual([])
    expect(unbackedAssistTerms(seasonConfig.verdict, 0)).toEqual([])
    expect(invalidAssistInterpretationsIn(seasonConfig.verdict)).toEqual([])
  })
})

// The authoring tripwire (ADR-0063): deliberately OUTSIDE the payload
// skipIf — no data needed, so it holds on clean clones and CI alike.
describe('authoring completeness (ADR-0063)', () => {
  it('no scaffold sentinel remains and referenced banner assets exist', () => {
    expect(authoringProblems(hero, seasonConfig)).toEqual([])
  })
})
