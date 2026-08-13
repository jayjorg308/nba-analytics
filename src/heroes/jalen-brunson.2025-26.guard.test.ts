// The committed verdict guard (ADR-0017) for Jalen Brunson's 2025-26 season
// argument, colocated with the hero copy it keeps honest (ADR-0022/0060/
// 0063). Every directional claim is asserted against the DEPLOYED payloads'
// metrics; when the data moves, rewrite the copy and this mapping together —
// never loosen an assertion.
//
// Brunson is the roster's anti-modern diet: half the league's rim clip,
// double its mid-range share, and a making axis that wins most of the cost
// back without ever closing it — the first verdict whose answer word is
// "Not quite". The creation section carries the explanation (a pull-up
// majority, an unassisted floor near seven in ten), and THE LINE trims
// what remains without a trip-frequency claim, which the ladder's FTA-rate
// floor forbids here (see the line-claims comment).
//
// Current verdict (voice per docs/voice/VOICE.md, ADR-0070; red-penned
// 2026-08-12 — docs/voice/samples/jalen-brunson.txt), claim by claim:
//   "makes it close"                                              -> claim 4
//   "shots at the rim at about half the league's clip"            -> claim 1
//   "sends more than twice the typical share to the mid-range"    -> claim 2
//   "a diet that costs him real value"                            -> claim 3
//   "pays back most of the cost, but not quite all"               -> claim 4
//   "hits the mid-range far above expectation"                    -> claim 5
//   "the long two most of all"                                    -> claim 6
//   "more than half of Brunson's attempts are pull-up jumpers,
//    better than double the league share"                         -> why 1
//   "nearly seven in ten of his makes are unassisted"             -> assist 1
//   "those pull-ups still beat the average for that shot"         -> why 2
//   "the catch-and-shoot looks he sees least often"               -> why 3
//   "land even further above"                                     -> why 4
//   "with the shot clock running down he produces well above
//    the league's late-clock value"                               -> why 5
//   "converts well above the league rate once he gets there"      -> line 1
//   "free throws carry nearly a fifth of his scoring"             -> line 2

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ShotMetrics } from '../domain/aggregate'
import { aggregateShotMetrics } from '../domain/aggregate'
import { aggregateCreationMetrics } from '../domain/aggregateCreation'
import { aggregateFreethrowMetrics } from '../domain/aggregateFreethrow'
import { aggregateShotContextMetrics } from '../domain/aggregateShotContext'
import { parseCreationPayload } from '../domain/creationPayload'
import { parseFreethrowPayload } from '../domain/freethrowPayload'
import { parseDerivedPayload } from '../domain/payload'
import { parseShotContextPayload } from '../domain/shotContextPayload'
import { authoringProblems } from './authoring'
import { jalenBrunson as hero } from './jalen-brunson'
import { seasonArgumentOf } from './types'
import type { AssistClaim, CreationClaim, FreethrowClaim } from './verdictLexicon'
import {
  invalidAssistInterpretationsIn,
  unbackedAssistTerms,
  unbackedCreationTerms,
  unbackedFreethrowTerms,
  unshippedTermsIn,
} from './verdictLexicon'
import {
  FAR_PPS,
  MATERIAL_DIET_LEAN_PP,
  MATERIAL_PPS,
  STRONG_PPS,
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
const contextPath = path.resolve(
  process.cwd(),
  'public',
  'data',
  hero.slug,
  `${seasonConfig.season}.context.json`,
)
const freethrowPath = path.resolve(
  process.cwd(),
  'public',
  'data',
  hero.slug,
  `${seasonConfig.season}.freethrow.json`,
)

// Verdict semantics — thresholds the prose is held to, priced from the house
// ladder (ADR-0068; ladder bars are imported directly, their names already
// matching):
//
// "shots at the rim at about half the league's clip": his rim share over
// the league's as a TWO-SIDED band — "about half" overstates below the
// floor and understates past the ceiling (actual: 14.2% vs 28.4%, 0.50x).
const ABOUT_HALF_FLOOR = 0.45
const ABOUT_HALF_CEILING = 0.55
// "sends more than twice the typical share to the mid-range": the
// mid-range share ratio exceeds two — one-sided by construction
// (actual: 21.2% vs 10.1%, 2.11x).
const TWICE = 2
// "a diet that costs him real value": selection at least material
// (actual: −0.084, past material with 0.034 of headroom, short of strong).
//
// "pays back most of the cost, but not quite all" (and the opener's
// "makes it close"): making at least material, covering MORE THAN HALF of
// the selection cost but strictly LESS than all of it — the shortfall
// that remains is what keeps the answer word at "Not quite", and it must
// stay smaller than material for "close" to hold (actual: +0.060 against
// −0.084, a 71% payback, shortfall 0.025).
const MOST = 0.5
// "hits the mid-range far above expectation": the zone's PPS gap clears
// the ladder's far bar, sample-safe (actual: +0.170 on 313 attempts).
//
// "the long two most of all": the 16-24 ft band's PPS gap clears far AND
// strictly exceeds every evaluation zone's gap and the 8-16 ft band's —
// the broad reading, priced deliberately (actual: +0.234 on 141 attempts,
// against +0.170 mid-range and +0.122 for 8-16 ft, the runners-up).
//
// "more than half of Brunson's attempts are pull-up jumpers": the Pull Ups
// context's share of the season denominator exceeds half (actual: 54.7%) —
// one-sided.
const MORE_THAN_HALF = 0.5
// "better than double the league share": that share over the league's
// exceeds two — one-sided (actual: 54.7% vs 25.2%, 2.17x).
//
// "those pull-ups still beat the average for that shot": a bare
// comparative against the same-context league value prices at material,
// sample-safe (actual: +0.087 on 807 attempts).
//
// "the catch-and-shoot looks he sees least often": his catch-and-shoot
// share below the league's by at least the bare diet bar (actual: 15.5%
// vs 31.7% — 16.2 share points, which also clears the "far" bar; the
// prose only claims the direction).
//
// "land even further above": catch-and-shoot's gap clears the ladder's
// strong bar AND exceeds the pull-up gap the sentence just stated
// (actual: +0.105 on 229 attempts vs +0.087 — the strong bar is THE
// THINNEST CLAIM ON THE PAGE at 0.005 of margin. It is exact because the
// season is complete; on a living season this margin would not be
// authorable).
//
// "with the shot clock running down he produces well above the league's
// late-clock value": the Late band (7-0 seconds) clears strong,
// sample-safe (actual: +0.122 on 330 attempts).
//
// "nearly seven in ten of his makes are unassisted": TWO-SIDED across the
// aggregation's worst-case bounds (ADR-0037) — the unassisted FLOOR
// (every unknown counted assisted) must reach the band and the unassisted
// CEILING (every unknown counted unassisted) must not overrun it (actual:
// 68.9% exactly, both bounds, at complete coverage).
const NEARLY_SEVEN_IN_TEN_FLOOR = 0.65
const NEARLY_SEVEN_IN_TEN_CEILING = 0.7
// "converts well above the league rate once he gets there": the FT "well"
// bar on BOTH technical cuts (ADR-0055), sample-safe at 421 FTA
// (actual: +0.058 / +0.060).
//
// "free throws carry nearly a fifth of his scoring": FT points share as a
// TWO-SIDED band on both cuts — below the floor a reader would round to a
// sixth and the phrase overstates; at a fifth and beyond it understates
// (actual: 0.184 / 0.179).
const NEARLY_A_FIFTH_FLOOR = 0.17
const NEARLY_A_FIFTH_CEILING = 0.2
// NO FTA-rate claim: the without-technicals cut sits at +0.013, under the
// ladder's FTA_RATE_FLOOR (0.02), so no directional trip-frequency claim
// is authorable on both cuts (ADR-0055) and the verdict says nothing
// about how often he gets to the line.

// The verdict's directional shot claims (ADR-0017): one entry per claim,
// named after the verdict words it backs, asserted against the shot
// metrics. Shot claims need no lexicon licensing (two-axis vocabulary is
// always legal), so the type is local.
interface ShotClaim {
  name: string
  assert: (m: ShotMetrics) => void
}

const zoneOf = (m: ShotMetrics, z: string) => m.zones.find((r) => r.zone === z)!
const bandOf = (m: ShotMetrics, b: string) => m.midRangeSplit.bands.find((r) => r.band === b)!

const shotClaims: ShotClaim[] = [
  {
    name: "claim 1: shots at the rim at about half the league's clip, two-sided",
    assert: (m) => {
      const rim = zoneOf(m, 'Restricted Area')
      expect(rim.attemptShare).not.toBeNull()
      const ratio = rim.attemptShare! / rim.leagueAttemptShare
      expect(ratio).toBeGreaterThanOrEqual(ABOUT_HALF_FLOOR)
      expect(ratio).toBeLessThanOrEqual(ABOUT_HALF_CEILING)
    },
  },
  {
    name: 'claim 2: more than twice the typical mid-range share',
    assert: (m) => {
      const mid = zoneOf(m, 'Mid-Range')
      expect(mid.attemptShare).not.toBeNull()
      expect(mid.attemptShare! / mid.leagueAttemptShare).toBeGreaterThan(TWICE)
    },
  },
  {
    name: 'claim 3: the diet costs real value, at least material',
    assert: (m) => {
      expect(m.selection.selectionDelta).not.toBeNull()
      expect(m.selection.selectionDelta!).toBeLessThanOrEqual(-MATERIAL_PPS)
    },
  },
  {
    name: 'claim 4: making pays back most of the cost, but not quite all, and the miss stays close',
    assert: (m) => {
      expect(m.selection.selectionDelta).not.toBeNull()
      expect(m.making.makingPpsDelta).not.toBeNull()
      const cost = Math.abs(m.selection.selectionDelta!)
      const payback = m.making.makingPpsDelta!
      expect(payback).toBeGreaterThanOrEqual(MATERIAL_PPS)
      expect(payback).toBeGreaterThan(cost * MOST)
      expect(payback).toBeLessThan(cost)
      // "makes it close": the remaining shortfall is smaller than material.
      expect(cost - payback).toBeLessThan(MATERIAL_PPS)
    },
  },
  {
    name: 'claim 5: hits the mid-range far above expectation, sample-safe',
    assert: (m) => {
      const mid = zoneOf(m, 'Mid-Range')
      expect(mid.pps).not.toBeNull()
      expect(mid.smallSampleMaking).toBe(false)
      expect(mid.pps! - mid.leaguePps).toBeGreaterThanOrEqual(FAR_PPS)
    },
  },
  {
    name: 'claim 6: the long two clears far and leads every zone and band, sample-safe',
    assert: (m) => {
      expect(m.midRangeSplit.visible).toBe(true)
      const longTwo = bandOf(m, '16-24 ft')
      expect(longTwo.pps).not.toBeNull()
      expect(longTwo.smallSampleMaking).toBe(false)
      const gap = longTwo.pps! - longTwo.leaguePps
      expect(gap).toBeGreaterThanOrEqual(FAR_PPS)
      for (const row of m.zones) {
        expect(row.pps).not.toBeNull()
        expect(gap).toBeGreaterThan(row.pps! - row.leaguePps)
      }
      const shortTwo = bandOf(m, '8-16 ft')
      expect(shortTwo.pps).not.toBeNull()
      expect(gap).toBeGreaterThan(shortTwo.pps! - shortTwo.leaguePps)
    },
  },
]

// The creation-kind claims (ADR-0029): declaring these licenses the
// verdict's creation vocabulary ('pull-up', 'jumper', 'catch-and-shoot',
// 'clock').
const creationClaims: CreationClaim[] = [
  {
    name: 'why 1: more than half his attempts are pull-ups, better than double the league share',
    assert: (c) => {
      const pu = c.general.jumperContexts.find((r) => r.context === 'Pull Ups')!
      expect(pu.attemptShare).not.toBeNull()
      expect(pu.attemptShare!).toBeGreaterThan(MORE_THAN_HALF)
      expect(pu.attemptShare! / pu.leagueAttemptShare).toBeGreaterThan(TWICE)
    },
  },
  {
    name: 'why 2: pull-ups beat the average for that shot, at least material, sample-safe',
    assert: (c) => {
      const pu = c.general.jumperContexts.find((r) => r.context === 'Pull Ups')!
      expect(pu.pps).not.toBeNull()
      expect(pu.smallSamplePps).toBe(false)
      expect(pu.pps! - pu.leaguePps!).toBeGreaterThanOrEqual(MATERIAL_PPS)
    },
  },
  {
    name: 'why 3: catch-and-shoot is the look he sees least often vs the league',
    assert: (c) => {
      const cs = c.general.jumperContexts.find((r) => r.context === 'Catch and Shoot')!
      expect(cs.attemptShare).not.toBeNull()
      expect(cs.leagueAttemptShare - cs.attemptShare!).toBeGreaterThanOrEqual(
        MATERIAL_DIET_LEAN_PP,
      )
    },
  },
  {
    name: 'why 4: catch-and-shoot lands even further above, past strong and past the pull-up gap, sample-safe',
    assert: (c) => {
      const cs = c.general.jumperContexts.find((r) => r.context === 'Catch and Shoot')!
      const pu = c.general.jumperContexts.find((r) => r.context === 'Pull Ups')!
      expect(cs.pps).not.toBeNull()
      expect(cs.smallSamplePps).toBe(false)
      const csGap = cs.pps! - cs.leaguePps!
      expect(csGap).toBeGreaterThanOrEqual(STRONG_PPS)
      expect(csGap).toBeGreaterThan(pu.pps! - pu.leaguePps!)
    },
  },
  {
    name: "why 5: late in the clock he produces well above the league's late-clock value, sample-safe",
    assert: (c) => {
      const late = c.shotClock.find((r) => r.band === 'Late')!
      expect(late.pps).not.toBeNull()
      expect(late.smallSamplePps).toBe(false)
      expect(late.pps! - late.leaguePps!).toBeGreaterThanOrEqual(STRONG_PPS)
    },
  },
]

// The assist claim consumes aggregation-owned worst-case bounds, never the
// classified point estimate alone (ROADMAP v2.5 Phase 4; ADR-0037).
const assistClaims: AssistClaim[] = [
  {
    name: 'assist 1: nearly seven in ten makes unassisted, two-sided across full bounds',
    assert: (context) => {
      expect(context.all.maxAssistedShare).not.toBeNull()
      expect(context.all.minAssistedShare).not.toBeNull()
      // Worst case for the floor: every unknown make counted as assisted.
      expect(1 - context.all.maxAssistedShare!).toBeGreaterThanOrEqual(
        NEARLY_SEVEN_IN_TEN_FLOOR,
      )
      // Worst case for the ceiling: every unknown make counted as unassisted.
      expect(1 - context.all.minAssistedShare!).toBeLessThanOrEqual(
        NEARLY_SEVEN_IN_TEN_CEILING,
      )
    },
  },
]

// The line-sentence's free-throw claims (ADR-0055/0056): every assertion on
// a league-baselined metric holds on BOTH technical cuts.
const freethrowClaims: FreethrowClaim[] = [
  {
    name: 'line 1: converts well above the league rate, on both cuts, sample-safe',
    assert: (f) => {
      const conv = f.seasonLine.conversion
      expect(conv.value).not.toBeNull()
      expect(conv.withoutTechnicals).not.toBeNull()
      expect(f.seasonLine.smallSampleConversion).toBe(false)
      for (const cut of [conv.value!, conv.withoutTechnicals!]) {
        expect(cut - conv.league).toBeGreaterThanOrEqual(WELL_FT_PCT)
      }
    },
  },
  {
    name: 'line 2: free throws carry nearly a fifth of his scoring, two-sided, on both cuts',
    assert: (f) => {
      const share = f.seasonLine.ftPointsShare
      expect(share.value).not.toBeNull()
      expect(share.withoutTechnicals).not.toBeNull()
      for (const cut of [share.value!, share.withoutTechnicals!]) {
        expect(cut).toBeGreaterThanOrEqual(NEARLY_A_FIFTH_FLOOR)
        expect(cut).toBeLessThanOrEqual(NEARLY_A_FIFTH_CEILING)
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
    context: aggregateShotContextMetrics(
      payload,
      parseShotContextPayload(JSON.parse(readFileSync(contextPath, 'utf-8'))),
    ),
    freethrow: aggregateFreethrowMetrics(
      parseFreethrowPayload(JSON.parse(readFileSync(freethrowPath, 'utf-8'))),
    ),
  }
}
const deployed =
  existsSync(payloadPath) &&
  existsSync(creationPath) &&
  existsSync(contextPath) &&
  existsSync(freethrowPath)
const metrics = deployed ? loadMetrics() : null

describe.skipIf(metrics === null)(
  'verdict guard: Jalen Brunson 2025-26 (ADR-0017/0029)',
  () => {
    for (const claim of shotClaims) {
      it(claim.name, () => claim.assert(metrics!.shot))
    }

    // The why-sentence's creation-kind claims (ADR-0029), run against the
    // deployed creation payload's metrics.
    for (const claim of creationClaims) {
      it(claim.name, () => claim.assert(metrics!.creation))
    }

    for (const claim of assistClaims) {
      it(claim.name, () => claim.assert(metrics!.context))
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
      expect(unbackedAssistTerms(seasonConfig.verdict, assistClaims.length)).toEqual([])
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
