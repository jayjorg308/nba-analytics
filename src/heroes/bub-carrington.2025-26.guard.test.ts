// The committed verdict guard (ADR-0017) for Bub Carrington's 2025-26 season
// argument, colocated with the hero copy it keeps honest (ADR-0022/0060/
// 0063). Every directional claim is asserted against the DEPLOYED payloads'
// metrics; when the data moves, rewrite the copy and this mapping together —
// never loosen an assertion.
//
// Carrington is the perimeter inverse of the interior heroes: a diet that
// nearly deletes the rim (0.27x the league share) in favor of mid-range and
// above-the-break threes, a real selection cost that his shot making only
// PARTLY repays — the "adds some of it back, though not all" claim below is
// the one that keeps the verdict honest, since a reader who sees a positive
// making number will otherwise assume it squares the ledger.
//
// Current verdict (voice per docs/voice/VOICE.md, ADR-0070), claim by claim:
//   "his shot diet gives up the rim" / "shoots there less than a
//    third as often as the league does"                          -> claim 1
//   "mid-range jumpers at more than double the league share"      -> claim 2
//   "and threes from above the break"                             -> claim 3
//   "that tradeoff costs him real value"                          -> claim 4
//   "adds some of it back, though not all"                        -> claim 5
//   "converts above what that diet should yield"                  -> claim 6
//   "nearly six in ten of his attempts are pull-ups"              -> why 1 (creation)
//   "more than double the league share" (pull-ups)                -> why 2 (creation)
//   "those pull-ups land far above average"                       -> why 3 (creation)
//   "reaches it at little more than half the league rate"         -> line 1 (free throw)
//   "converts below average once he gets there"                   -> line 2 (free throw)
//   ("the free throw line compounds the problem" is the rhetorical frame of
//    line 1 + line 2: both cuts of the line push the same direction as the
//    diet, so neither softens the no.)

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ShotMetrics } from '../domain/aggregate'
import { aggregateShotMetrics } from '../domain/aggregate'
import { aggregateCreationMetrics } from '../domain/aggregateCreation'
import { aggregateFreethrowMetrics } from '../domain/aggregateFreethrow'
import { parseCreationPayload } from '../domain/creationPayload'
import { parseFreethrowPayload } from '../domain/freethrowPayload'
import { parseDerivedPayload } from '../domain/payload'
import { authoringProblems } from './authoring'
import { bubCarrington as hero } from './bub-carrington'
import { seasonArgumentOf } from './types'
import type { CreationClaim, FreethrowClaim } from './verdictLexicon'
import {
  invalidAssistInterpretationsIn,
  unbackedAssistTerms,
  unbackedCreationTerms,
  unbackedFreethrowTerms,
  unshippedTermsIn,
} from './verdictLexicon'
import { FAR_PPS, MATERIAL_PPS, NEUTRAL_BAND_PPS } from './verdictLadder'

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
// "shoots there less than a third as often as the league does": a share
// RATIO, one-sided by construction (actual: 7.7% vs 28.4% = 0.27x).
const LESS_THAN_A_THIRD = 1 / 3
// "at more than double the league share": one-sided by construction
// (actual: mid-range 23.3% vs 10.1% = 2.32x; pull-ups 58.8% vs 25.2% =
// 2.34x). Shared by claim 2 and why 2 — same phrase, same bar.
const MORE_THAN_DOUBLE = 2
// "that tradeoff costs him real value": a bare directional cost prices at
// material (actual: −0.082, which does NOT reach STRONG — hence "real
// value" and never "well below").
const MATERIAL_SELECTION_COST_PPS = MATERIAL_PPS
// "converts above what that diet should yield": a bare comparative prices
// at material (actual: +0.066, again short of STRONG on purpose).
const ABOVE_PPS = MATERIAL_PPS
// "nearly six in ten of his attempts are pull-ups": a TWO-SIDED band
// (ADR-0068's approximation-word discipline — "nearly" overstates below
// the band and understates above it; actual: 58.8%).
const NEARLY_SIX_IN_TEN_FLOOR = 0.55
const NEARLY_SIX_IN_TEN_CEILING = 0.6
// "those pull-ups land far above average": the ladder's far bar (actual:
// +0.190).
const FAR_ABOVE_PPS = FAR_PPS
// "reaches it at little more than half the league rate": a TWO-SIDED band
// on the FTA-rate RATIO, held on both technical cuts (actual: 0.57x with
// technicals, 0.52x without).
const LITTLE_MORE_THAN_HALF_FLOOR = 0.5
const LITTLE_MORE_THAN_HALF_CEILING = 0.6
// "converts below average once he gets there": a bare directional claim on
// FT%, so it must clear the neutral band at minimum. Deliberately NOT
// "well below" (WELL_FT_PCT = 0.05): the without-technicals cut sits at
// −0.0502, which clears that bar by 0.0002 — arithmetically true and no
// margin at all, so the copy states the weaker word the data actually
// earns (actual: −0.053 / −0.050).
const BELOW_FT_PCT = NEUTRAL_BAND_PPS

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
    name: 'claim 1: gives up the rim, shooting there less than a third as often as the league',
    assert: (m) => {
      const ra = zoneOf(m, 'Restricted Area')
      expect(ra.attemptShare).not.toBeNull()
      expect(ra.attemptShare! / ra.leagueAttemptShare).toBeLessThan(LESS_THAN_A_THIRD)
    },
  },
  {
    name: 'claim 2: mid-range jumpers at more than double the league share',
    assert: (m) => {
      const mid = zoneOf(m, 'Mid-Range')
      expect(mid.attemptShare).not.toBeNull()
      expect(mid.attemptShare! / mid.leagueAttemptShare).toBeGreaterThan(MORE_THAN_DOUBLE)
    },
  },
  {
    name: 'claim 3: and threes from above the break, a share above the league',
    assert: (m) => {
      const atb = zoneOf(m, 'Above the Break 3')
      expect(atb.attemptShare).not.toBeNull()
      expect(atb.attemptShare!).toBeGreaterThan(atb.leagueAttemptShare)
    },
  },
  {
    name: 'claim 4: the tradeoff costs him real value, a material selection cost',
    assert: (m) => {
      expect(m.selection.selectionDelta).not.toBeNull()
      expect(m.selection.selectionDelta!).toBeLessThanOrEqual(-MATERIAL_SELECTION_COST_PPS)
    },
  },
  {
    name: 'claim 5: shot making adds some of it back, though not all of the selection cost',
    assert: (m) => {
      expect(m.making.makingPpsDelta).not.toBeNull()
      expect(m.selection.selectionDelta).not.toBeNull()
      // "adds some of it back": the making axis is positive at all.
      expect(m.making.makingPpsDelta!).toBeGreaterThan(0)
      // "though not all": and it stays SHORT of the selection cost, so the
      // ledger does not square. This is the claim that stops a reader from
      // reading a positive making number as a rescue.
      expect(m.making.makingPpsDelta!).toBeLessThan(Math.abs(m.selection.selectionDelta!))
    },
  },
  {
    name: 'claim 6: converts above what that diet should yield',
    assert: (m) => {
      expect(m.making.makingPpsDelta).not.toBeNull()
      expect(m.making.makingPpsDelta!).toBeGreaterThanOrEqual(ABOVE_PPS)
    },
  },
]

// The creation-kind claims (ADR-0029): declaring these licenses the
// verdict's creation vocabulary ('pull-ups', and 'jumpers' in claim 2's
// prose).
const creationClaims: CreationClaim[] = [
  {
    name: 'why 1: nearly six in ten of his attempts are pull-ups, two-sided',
    assert: (c) => {
      const pu = c.general.jumperContexts.find((r) => r.context === 'Pull Ups')!
      expect(pu.attemptShare).not.toBeNull()
      expect(pu.attemptShare!).toBeGreaterThanOrEqual(NEARLY_SIX_IN_TEN_FLOOR)
      expect(pu.attemptShare!).toBeLessThanOrEqual(NEARLY_SIX_IN_TEN_CEILING)
    },
  },
  {
    name: 'why 2: pull-ups at more than double the league share',
    assert: (c) => {
      const pu = c.general.jumperContexts.find((r) => r.context === 'Pull Ups')!
      expect(pu.attemptShare).not.toBeNull()
      expect(pu.attemptShare! / pu.leagueAttemptShare).toBeGreaterThan(MORE_THAN_DOUBLE)
    },
  },
  {
    name: 'why 3: those pull-ups land far above average, sample-safe',
    assert: (c) => {
      const pu = c.general.jumperContexts.find((r) => r.context === 'Pull Ups')!
      expect(pu.pps).not.toBeNull()
      expect(pu.leaguePps).not.toBeNull()
      // stated unhedged in the verdict, so it must clear the † bar
      expect(pu.smallSamplePps).toBe(false)
      expect(pu.pps! - pu.leaguePps!).toBeGreaterThanOrEqual(FAR_ABOVE_PPS)
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
    name: 'line 1: reaches the line at little more than half the league rate, both cuts',
    assert: (f) => {
      const rate = f.seasonLine.ftaRate
      expect(rate.value).not.toBeNull()
      expect(rate.withoutTechnicals).not.toBeNull()
      for (const cut of [rate.value!, rate.withoutTechnicals!]) {
        const ratio = cut / rate.league
        expect(ratio).toBeGreaterThanOrEqual(LITTLE_MORE_THAN_HALF_FLOOR)
        expect(ratio).toBeLessThanOrEqual(LITTLE_MORE_THAN_HALF_CEILING)
      }
    },
  },
  {
    name: 'line 2: converts below average once he gets there, both cuts, sample-safe',
    assert: (f) => {
      const conv = f.seasonLine.conversion
      expect(conv.value).not.toBeNull()
      expect(conv.withoutTechnicals).not.toBeNull()
      // stated unhedged in the verdict, so it must clear the † bar
      expect(f.seasonLine.smallSampleConversion).toBe(false)
      for (const cut of [conv.value!, conv.withoutTechnicals!]) {
        expect(cut - conv.league).toBeLessThanOrEqual(-BELOW_FT_PCT)
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

describe.skipIf(metrics === null)(
  'verdict guard: Bub Carrington 2025-26 (ADR-0017/0029)',
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
