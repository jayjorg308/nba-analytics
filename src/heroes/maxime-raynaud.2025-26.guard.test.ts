// The committed verdict guard (ADR-0017) for Maxime Raynaud's 2025-26 season
// argument, colocated with the hero copy it keeps honest (ADR-0022/0060/
// 0063). Every directional claim is asserted against the DEPLOYED payloads'
// metrics; when the data moves, rewrite the copy and this mapping together —
// never loosen an assertion.
//
// Raynaud is the interior positive: a paint-heavy diet that gives up the
// arc (a real selection cost, NOT the rim-runner-inflated selection
// ADR-0064 warns about — his rim share is league-normal and the non-RA
// paint is a low-value zone), paid back more than twice over by finishing.
//
// Current verdict (voice per docs/voice/VOICE.md, ADR-0070), claim by claim:
//   "more than half of his attempts are short shots in the
//    paint rather than threes"                                -> claim 1
//   "that costs him real value"                               -> claim 2
//   "his shot making pays it back more than twice over"       -> claim 3
//   "converts well above average"                             -> claim 4
//   "a soft touch in the paint"                               -> claim 5
//   "a defender in his chest on six in ten attempts"          -> why 1 (creation)
//   "doesn't dent it"                                         -> why 2 (creation)
//   "pull-ups barely feature"                                 -> why 3 (creation)
//   "more than eight in ten of his makes come off an assist"  -> assist 1
//   "earns trips at about the league rate"                    -> line 1 (free throw)
//   "converts right at average once he gets there"            -> line 2 (free throw)
//   ("the free throw line stays quiet" is the rhetorical frame of line 1 +
//    line 2: neither generation nor conversion moves his story either way.)

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { makingDeltaBin } from '../chart/makingScale'
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
import { maximeRaynaud as hero } from './maxime-raynaud'
import { seasonArgumentOf } from './types'
import type { AssistClaim, CreationClaim, FreethrowClaim } from './verdictLexicon'
import {
  invalidAssistInterpretationsIn,
  unbackedAssistTerms,
  unbackedCreationTerms,
  unbackedFreethrowTerms,
  unshippedTermsIn,
} from './verdictLexicon'
import { FTA_RATE_FLOOR, MATERIAL_PPS, STRONG_PPS } from './verdictLadder'

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
// house ladder (ADR-0068):
// "more than half of his attempts are short shots in the paint": one-sided
// by construction, over the two paint zones' shares (one denominator, so
// the sum is arithmetic, not a re-aggregation; actual: 27.6% RA + 54.2%
// non-RA paint = 81.8%).
const MORE_THAN_HALF = 0.5
// "that costs him real value": a bare directional cost prices at material
// (actual: −0.058).
const MATERIAL_SELECTION_COST_PPS = MATERIAL_PPS
// "pays it back more than twice over": making at least double the
// selection cost — one-sided by construction (actual: +0.144 vs −0.058,
// 2.48x).
const TWICE = 2
// "converts well above average": the ladder's strong bar (actual: +0.144).
const WELL_ABOVE_PPS = STRONG_PPS
// "a soft touch in the paint": the paint zone bins warm on the making
// scale (ADR-0013 semantics — at least warm-1; actual +10.1 pp, warm-2),
// unflagged (364 FGA).
const WARM_BIN_MIN = 1
// "six in ten attempts" (tight-defender share): a TWO-SIDED band
// (ADR-0068's approximation-word discipline; actual: 59.8%).
const SIX_IN_TEN_FLOOR = 0.55
const SIX_IN_TEN_CEILING = 0.65
// "doesn't dent it": tight-defender conversion still above league value —
// a bare comparative prices at material (actual: 1.162 vs 1.056, +0.106).
const ABOVE_PPS = MATERIAL_PPS
// "pull-ups barely feature": at most one attempt in twenty (actual: 3.7%
// vs the league's 25.2% — a 0.15x share).
const BARELY_FEATURES_SHARE = 0.05
// "more than eight in ten of his makes come off an assist": the worst-case
// MINIMUM assisted share (unknowns counted as unassisted) clears eight in
// ten — bounds, never the point estimate (ADR-0037; actual: 82.5% at
// complete coverage).
const EIGHT_IN_TEN_ASSISTED = 0.8
// "at about the league rate": a two-sided band at the FTA-rate family's
// directional floor — inside it no directional claim is licensed, so
// "about the league rate" is the honest description (ADR-0068; actual:
// −0.014 / −0.017 without technicals).
const ABOUT_LEAGUE_FTA_BAND = FTA_RATE_FLOOR
// "converts right at average": a two-sided band, declared locally at the
// same ±0.02 the PPS neutral band uses — the FT-conversion family defines
// only its "well" bar (5 FT% points), and this claim is the neutral case
// beneath any directional word (actual: +0.003 / +0.006 without
// technicals).
const AT_AVERAGE_FT_PCT_BAND = 0.02

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
    name: 'claim 1: more than half of his attempts are paint shots, threes given up',
    assert: (m) => {
      const zone = (z: string) => m.zones.find((r) => r.zone === z)!
      const ra = zone('Restricted Area')
      const paint = zone('In The Paint (Non-RA)')
      expect(ra.attemptShare).not.toBeNull()
      expect(paint.attemptShare).not.toBeNull()
      expect(ra.attemptShare! + paint.attemptShare!).toBeGreaterThan(MORE_THAN_HALF)
      // "rather than threes": the three-point share sits below the league's.
      expect(m.threes.attemptShare).not.toBeNull()
      expect(m.threes.attemptShare!).toBeLessThan(m.threes.leagueAttemptShare)
    },
  },
  {
    name: 'claim 2: the diet costs him real value, material selection cost',
    assert: (m) => {
      expect(m.selection.selectionDelta).not.toBeNull()
      expect(m.selection.selectionDelta!).toBeLessThanOrEqual(-MATERIAL_SELECTION_COST_PPS)
    },
  },
  {
    name: 'claim 3: shot making pays back more than twice the selection cost',
    assert: (m) => {
      expect(m.making.makingPpsDelta).not.toBeNull()
      expect(m.selection.selectionDelta).not.toBeNull()
      expect(m.making.makingPpsDelta!).toBeGreaterThan(
        Math.abs(m.selection.selectionDelta!) * TWICE,
      )
    },
  },
  {
    name: 'claim 4: converts well above average',
    assert: (m) => {
      expect(m.making.makingPpsDelta).not.toBeNull()
      expect(m.making.makingPpsDelta!).toBeGreaterThanOrEqual(WELL_ABOVE_PPS)
    },
  },
  {
    name: 'claim 5: a soft touch in the paint, sample-safe',
    assert: (m) => {
      const paint = m.zones.find((r) => r.zone === 'In The Paint (Non-RA)')!
      expect(paint.smallSampleMaking).toBe(false)
      expect(makingDeltaBin(paint.makingDelta)).toBeGreaterThanOrEqual(WARM_BIN_MIN)
    },
  },
]

// The creation-kind claims (ADR-0029): declaring these licenses the
// verdict's creation vocabulary ('defender', 'pull-ups').
const creationClaims: CreationClaim[] = [
  {
    name: 'why 1: a defender in his chest on six in ten attempts',
    assert: (c) => {
      const tight = c.closestDefender.find((b) => b.band === 'Tight')!
      expect(tight.attemptShare).not.toBeNull()
      expect(tight.attemptShare!).toBeGreaterThanOrEqual(SIX_IN_TEN_FLOOR)
      expect(tight.attemptShare!).toBeLessThanOrEqual(SIX_IN_TEN_CEILING)
    },
  },
  {
    name: "why 2: tight coverage doesn't dent the conversion, sample-safe",
    assert: (c) => {
      const tight = c.closestDefender.find((b) => b.band === 'Tight')!
      expect(tight.pps).not.toBeNull()
      expect(tight.leaguePps).not.toBeNull()
      // stated unhedged in the verdict, so it must clear the † bar
      expect(tight.smallSamplePps).toBe(false)
      expect(tight.pps! - tight.leaguePps!).toBeGreaterThanOrEqual(ABOVE_PPS)
    },
  },
  {
    name: 'why 3: pull-ups barely feature',
    assert: (c) => {
      const pu = c.general.jumperContexts.find((r) => r.context === 'Pull Ups')!
      expect(pu.attemptShare).not.toBeNull()
      expect(pu.attemptShare!).toBeLessThanOrEqual(BARELY_FEATURES_SHARE)
    },
  },
]

// The assist claim consumes aggregation-owned worst-case bounds, never the
// classified point estimate alone (ROADMAP v2.5 Phase 4; ADR-0037).
const assistClaims: AssistClaim[] = [
  {
    name: 'assist 1: more than eight in ten makes come off an assist, across full bounds',
    assert: (context) => {
      expect(context.all.minAssistedShare).not.toBeNull()
      expect(context.all.minAssistedShare!).toBeGreaterThan(EIGHT_IN_TEN_ASSISTED)
    },
  },
]

// The line-sentence's free-throw claims (ADR-0055/0056): every assertion
// on a league-baselined metric holds on BOTH technical cuts.
const freethrowClaims: FreethrowClaim[] = [
  {
    name: 'line 1: earns trips at about the league rate, two-sided on both cuts',
    assert: (f) => {
      const rate = f.seasonLine.ftaRate
      expect(rate.value).not.toBeNull()
      expect(rate.withoutTechnicals).not.toBeNull()
      for (const cut of [rate.value!, rate.withoutTechnicals!]) {
        expect(Math.abs(cut - rate.league)).toBeLessThanOrEqual(ABOUT_LEAGUE_FTA_BAND)
      }
    },
  },
  {
    name: 'line 2: converts right at average, two-sided on both cuts, sample-safe',
    assert: (f) => {
      const conv = f.seasonLine.conversion
      expect(conv.value).not.toBeNull()
      expect(conv.withoutTechnicals).not.toBeNull()
      // stated unhedged in the verdict, so it must clear the † bar
      expect(f.seasonLine.smallSampleConversion).toBe(false)
      for (const cut of [conv.value!, conv.withoutTechnicals!]) {
        expect(Math.abs(cut - conv.league)).toBeLessThanOrEqual(AT_AVERAGE_FT_PCT_BAND)
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
  'verdict guard: Maxime Raynaud 2025-26 (ADR-0017/0029)',
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
