// The committed verdict guard (ADR-0017) for Donovan Mitchell's 2025-26
// season argument, colocated with the hero copy it keeps honest
// (ADR-0022/0060/0063). Every directional claim is asserted against the
// DEPLOYED payloads' metrics; when the data moves, rewrite the copy and
// this mapping together — never loosen an assertion.
//
// Mitchell is the Shai quadrant at gentler volume: a pull-up-heavy diet
// whose selection cost stays modest while conversion clearly pays for it.
// The interest of the argument is that the same diet shape that indicts
// Ace (pull-ups and long twos) reads as a fair bet here, because the
// conversion actually arrives.
//
// Current verdict, claim by claim:
//   "tilts away from the rim and the corners toward ... long twos" -> claim 2
//   "costs a little value ... never enough to become the story"    -> claim 1
//   "adds back more than twice what his selection gives away"      -> claim 3
//   "paint and mid-range touch well above league"                  -> claim 4
//   "nearly half of his attempts are pull-ups, close to double
//    the league share"                                             -> why 1
//   "still beat the league pull-up value"                          -> why 2
//   "catch-and-shoot looks land even further above it"             -> why 3
//   "fewer than four in ten of his makes are officially assisted"  -> assist 1
//   "earns trips to the line a bit more often than the league"     -> line 1
//   "converts well above the league rate once there"               -> line 2

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { makingDeltaBin } from '../chart/makingScale'
import type { ShotMetrics } from '../domain/aggregate'
import { aggregateShotMetrics } from '../domain/aggregate'
import { aggregateCreationMetrics } from '../domain/aggregateCreation'
import { aggregateFreethrowMetrics } from '../domain/aggregateFreethrow'
import { aggregateShotContextMetrics } from '../domain/aggregateShotContext'
import { LONG_TWO_BAND } from '../domain/constants'
import { parseCreationPayload } from '../domain/creationPayload'
import { parseFreethrowPayload } from '../domain/freethrowPayload'
import { parseDerivedPayload } from '../domain/payload'
import { parseShotContextPayload } from '../domain/shotContextPayload'
import { authoringProblems } from './authoring'
import { donovanMitchell as hero } from './donovan-mitchell'
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
  FAR_FTA_RATE,
  FTA_RATE_FLOOR,
  MATERIAL_PPS,
  NEUTRAL_BAND_PPS,
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

// Verdict semantics — thresholds the prose is held to, priced from the
// house ladder (ADR-0068; the neutral, material, and strong bars are
// imported directly — the names already match):
// "costs a little value ... never enough to become the story": selection
// past the neutral band but short of materiality — TWO-SIDED, because "a
// little" overstates inside the band and understates past materiality
// (actual: −0.031).
// "tilts away from the rim and the corners": rim share clearly under the
// league's (actual 0.78x), each corner at no more than two-thirds of its
// league share (actual: left 0.50x, right 0.56x).
const RIM_SHARE_CEILING = 0.85
const CORNER_SHARE_CEILING = 0.67
// "toward ... long twos": the 16-24 ft band's diet share at least 1.25x
// the league's (actual: 6.7% vs 4.9% — 1.37x).
const LONG_TWO_MIN_RATIO = 1.25
// "adds back more than twice what his selection gives away": making at
// least material AND at least double the selection cost (actual: +0.066
// vs −0.031 — 2.1x).
const TWICE = 2
// "paint and mid-range touch well above league": both zones bin warm on
// the making scale (ADR-0013; actual +9.6 pp and +7.7 pp, warm-1),
// unflagged (306 and 170 FGA).
const WARM_BIN_MIN = 1
// "nearly half of his attempts are pull-ups": share in [0.40, 0.50] —
// two-sided, "nearly half" is wrong in both directions (actual: 45.4%).
const NEARLY_HALF_FLOOR = 0.4
const NEARLY_HALF_CEILING = 0.5
// "close to double the league share": ratio in [1.6, 2.0] — two-sided
// for the same reason (actual: 45.4% vs 25.2% — 1.80x).
const CLOSE_TO_DOUBLE_FLOOR = 1.6
const CLOSE_TO_DOUBLE_CEILING = 2
// "still beat the league pull-up value": a bare comparative prices at
// material (actual: +0.077).
const BEAT_PPS = MATERIAL_PPS
// "land even further above it": catch-and-shoot's gap clears the ladder's
// strong bar and exceeds the pull-up gap (actual: +0.115 vs +0.077).
// "fewer than four in ten of his makes are officially assisted": the
// worst-case MAXIMUM assisted share stays under 0.40 — bounds, not the
// classified point estimate (actual: 38.5% at complete coverage).
const FOUR_IN_TEN = 0.4
// "earns trips to the line a bit more often than the league": the ladder's
// FTA-rate floor up to where "far" begins, on BOTH technical cuts
// (ADR-0055) — two-sided, "a bit" must not quietly become "far more"
// (actual: +0.043 / +0.029).
const A_BIT_MORE_FTA_FLOOR = FTA_RATE_FLOOR
const A_BIT_MORE_FTA_CEILING = FAR_FTA_RATE
// "converts well above the league rate": the ladder's FT "well" bar, on
// both cuts (actual: +0.082 / +0.093), sample-safe (430 FTA).
const WELL_ABOVE_FT_PCT = WELL_FT_PCT

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
    name: 'claim 1: selection costs a little, past neutral but short of material',
    assert: (m) => {
      expect(m.selection.selectionDelta).not.toBeNull()
      expect(m.selection.selectionDelta!).toBeLessThanOrEqual(-NEUTRAL_BAND_PPS)
      expect(m.selection.selectionDelta!).toBeGreaterThanOrEqual(-MATERIAL_PPS)
    },
  },
  {
    name: 'claim 2: the diet tilts away from rim and corners toward long twos',
    assert: (m) => {
      const zone = (z: string) => m.zones.find((r) => r.zone === z)!
      const ra = zone('Restricted Area')
      expect(ra.attemptShare).not.toBeNull()
      expect(ra.attemptShare!).toBeLessThanOrEqual(ra.leagueAttemptShare * RIM_SHARE_CEILING)
      for (const corner of ['Left Corner 3', 'Right Corner 3']) {
        const row = zone(corner)
        expect(row.attemptShare).not.toBeNull()
        expect(row.attemptShare!).toBeLessThanOrEqual(
          row.leagueAttemptShare * CORNER_SHARE_CEILING,
        )
      }
      // The long-two claim is stated at the band grain the split ships
      // (ADR-0008 — visible for this hero because 16-24 ft clears the bar).
      expect(m.midRangeSplit.visible).toBe(true)
      const longTwo = m.midRangeSplit.bands.find((b) => b.band === LONG_TWO_BAND)!
      expect(longTwo.attemptShare).not.toBeNull()
      expect(longTwo.attemptShare!).toBeGreaterThanOrEqual(
        longTwo.leagueAttemptShare * LONG_TWO_MIN_RATIO,
      )
    },
  },
  {
    name: 'claim 3: making adds back more than twice the selection give-away, material',
    assert: (m) => {
      expect(m.making.makingPpsDelta).not.toBeNull()
      expect(m.selection.selectionDelta).not.toBeNull()
      expect(m.making.makingPpsDelta!).toBeGreaterThanOrEqual(MATERIAL_PPS)
      expect(m.making.makingPpsDelta!).toBeGreaterThanOrEqual(
        Math.abs(m.selection.selectionDelta!) * TWICE,
      )
    },
  },
  {
    name: 'claim 4: paint and mid-range touch bin warm, sample-safe',
    assert: (m) => {
      for (const name of ['In The Paint (Non-RA)', 'Mid-Range']) {
        const row = m.zones.find((r) => r.zone === name)!
        expect(row.smallSampleMaking).toBe(false)
        expect(makingDeltaBin(row.makingDelta)).toBeGreaterThanOrEqual(WARM_BIN_MIN)
      }
    },
  },
]

// The creation-kind claims (ADR-0029): declaring these licenses the
// verdict's creation vocabulary ('pull-up', 'jumpers', 'catch-and-shoot',
// 'creation').
const creationClaims: CreationClaim[] = [
  {
    name: 'why 1: nearly half his attempts are pull-ups, close to double the league share',
    assert: (c) => {
      const pu = c.general.jumperContexts.find((r) => r.context === 'Pull Ups')!
      expect(pu.attemptShare).not.toBeNull()
      expect(pu.attemptShare!).toBeGreaterThanOrEqual(NEARLY_HALF_FLOOR)
      expect(pu.attemptShare!).toBeLessThanOrEqual(NEARLY_HALF_CEILING)
      const ratio = pu.attemptShare! / pu.leagueAttemptShare
      expect(ratio).toBeGreaterThanOrEqual(CLOSE_TO_DOUBLE_FLOOR)
      expect(ratio).toBeLessThanOrEqual(CLOSE_TO_DOUBLE_CEILING)
    },
  },
  {
    name: 'why 2: pull-ups beat the league pull-up value, sample-safe',
    assert: (c) => {
      const pu = c.general.jumperContexts.find((r) => r.context === 'Pull Ups')!
      expect(pu.pps).not.toBeNull()
      expect(pu.smallSamplePps).toBe(false)
      expect(pu.pps! - pu.leaguePps!).toBeGreaterThanOrEqual(BEAT_PPS)
    },
  },
  {
    name: 'why 3: catch-and-shoot lands even further above league than pull-ups, sample-safe',
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
]

// The assist claim consumes aggregation-owned worst-case bounds, never the
// classified point estimate alone (ROADMAP v2.5 Phase 4; ADR-0037).
const assistClaims: AssistClaim[] = [
  {
    name: 'assist 1: fewer than four in ten makes officially assisted, across full bounds',
    assert: (context) => {
      expect(context.all.maxAssistedShare).not.toBeNull()
      expect(context.all.maxAssistedShare!).toBeLessThan(FOUR_IN_TEN)
    },
  },
]

// The line-sentence's free-throw claims (ADR-0055/0056): every assertion
// on a league-baselined metric holds on BOTH technical cuts.
const freethrowClaims: FreethrowClaim[] = [
  {
    name: 'line 1: earns trips a bit more often than the league, on both cuts',
    assert: (f) => {
      const rate = f.seasonLine.ftaRate
      expect(rate.value).not.toBeNull()
      expect(rate.withoutTechnicals).not.toBeNull()
      for (const cut of [rate.value!, rate.withoutTechnicals!]) {
        expect(cut - rate.league).toBeGreaterThanOrEqual(A_BIT_MORE_FTA_FLOOR)
        expect(cut - rate.league).toBeLessThanOrEqual(A_BIT_MORE_FTA_CEILING)
      }
    },
  },
  {
    name: 'line 2: converts well above the league rate, on both cuts, sample-safe',
    assert: (f) => {
      const conv = f.seasonLine.conversion
      expect(conv.value).not.toBeNull()
      expect(conv.withoutTechnicals).not.toBeNull()
      expect(f.seasonLine.smallSampleConversion).toBe(false)
      expect(conv.value! - conv.league).toBeGreaterThanOrEqual(WELL_ABOVE_FT_PCT)
      expect(conv.withoutTechnicals! - conv.league).toBeGreaterThanOrEqual(WELL_ABOVE_FT_PCT)
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
  'verdict guard: Donovan Mitchell 2025-26 (ADR-0017/0029)',
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
