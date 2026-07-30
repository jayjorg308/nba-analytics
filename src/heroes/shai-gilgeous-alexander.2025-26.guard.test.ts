import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { aggregateShotMetrics } from '../domain/aggregate'
import { aggregateCreationMetrics } from '../domain/aggregateCreation'
import { aggregateFreethrowMetrics } from '../domain/aggregateFreethrow'
import { aggregateShotContextMetrics } from '../domain/aggregateShotContext'
import { parseCreationPayload } from '../domain/creationPayload'
import { parseFreethrowPayload } from '../domain/freethrowPayload'
import { parseDerivedPayload } from '../domain/payload'
import { parseShotContextPayload } from '../domain/shotContextPayload'
import { authoringProblems } from './authoring'
import { shaiGilgeousAlexander as hero } from './shai-gilgeous-alexander'
import { seasonArgumentOf } from './types'
import type { AssistClaim, CreationClaim, FreethrowClaim } from './verdictLexicon'
import {
  invalidAssistInterpretationsIn,
  unbackedAssistTerms,
  unbackedCreationTerms,
  unbackedFreethrowTerms,
  unshippedTermsIn,
} from './verdictLexicon'
import { FAR_FTA_RATE, FAR_PPS, MATERIAL_PPS, WELL_FT_PCT } from './verdictLadder'

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
// house ladder (ADR-0068) where a house word appears (voice per
// docs/voice/VOICE.md, ADR-0070):
// "a diet that costs him real value": a bare directional cost prices at
// material (actual: −0.054).
const MATERIAL_SELECTION_COST_PPS = MATERIAL_PPS
// "nearly triple the league share": a TWO-SIDED band (ADR-0068's
// approximation-word discipline) — short of 2.5x "triple" overstates,
// past 3x "nearly" understates (actual: 2.66x).
const NEARLY_TRIPLE = 2.5
const NEARLY_TRIPLE_CEILING = 3
// "far fewer threes than average": three-point share at most 60% of the
// league's — a ratio form, declared locally.
const FAR_FEWER_THREES_RATIO = 0.6
// "MVP-level shot making overwhelms the cost, adding back far more than
// the selection gives away": priced at the ladder's far bar, plus the
// overwhelm comparison in the assertion (actual: +0.156).
const MVP_MAKING_GAIN_PPS = FAR_PPS
// "more than half of his attempts": a floor by construction — "more than"
// is one-sided (actual: 57.2%).
const MORE_THAN_HALF = 0.5
// "produce far above average": the ladder's far bar (actual: +0.203).
const FAR_ABOVE_VALUE_PPS = FAR_PPS
// "only one in five of SGA's makes comes off an assist": the worst-case
// MAXIMUM assisted share at most one in five — bounds, never the point
// estimate (ADR-0037). An assist IS the scorer's official credit, so the
// wording change from "officially assisted" alters no semantics.
const ONE_IN_FIVE_ASSISTED = 0.2
// "draws fouls far more often": the ladder's far FTA-rate bar — ten extra
// free throws per hundred shots (actual: 0.465 / 0.447 without
// technicals, vs league 0.264).
const FAR_MORE_FTA_RATE = FAR_FTA_RATE
// "converts well above the league rate": the ladder's FT "well" bar
// (actual: 0.879 / 0.881 without technicals, vs league 0.783).
const WELL_ABOVE_FT_PCT = WELL_FT_PCT
// "roughly a quarter of his scoring": FT points share within [0.22, 0.28] —
// a two-sided band, because the phrase overstates below it and understates
// above it (actual: 0.255 / 0.246 without technicals).
const QUARTER_SHARE_FLOOR = 0.22
const QUARTER_SHARE_CEILING = 0.28

const creationClaims: CreationClaim[] = [
  {
    name: 'why: more than half of his attempts are pull-up jumpers',
    assert: (creation) => {
      const pullups = creation.general.jumperContexts.find((row) => row.context === 'Pull Ups')!
      expect(pullups.attemptShare).not.toBeNull()
      expect(pullups.attemptShare!).toBeGreaterThan(MORE_THAN_HALF)
    },
  },
  {
    name: 'why: pull-ups produce far above league value',
    assert: (creation) => {
      const pullups = creation.general.jumperContexts.find((row) => row.context === 'Pull Ups')!
      expect(pullups.pps).not.toBeNull()
      expect(pullups.leaguePps).not.toBeNull()
      expect(pullups.smallSamplePps).toBe(false)
      expect(pullups.pps! - pullups.leaguePps!).toBeGreaterThanOrEqual(FAR_ABOVE_VALUE_PPS)
    },
  },
]

const assistClaims: AssistClaim[] = [
  {
    name: 'why: at most one in five makes comes off an assist',
    assert: (context) => {
      expect(context.all.maxAssistedShare).not.toBeNull()
      expect(context.all.maxAssistedShare!).toBeLessThanOrEqual(ONE_IN_FIVE_ASSISTED)
    },
  },
]

// The line-sentence's free-throw claims (ADR-0055/0056): every assertion on
// a league-baselined metric holds on BOTH technical cuts — the positive
// control carries the largest technical count (24 FTA) of any hero, so the
// both-cuts discipline earns its keep here. Season FTA (614) clears the †
// bar, so every clause states unhedged.
const freethrowClaims: FreethrowClaim[] = [
  {
    name: 'line 1: draws fouls far more often than the league, on both cuts',
    assert: (f) => {
      const rate = f.seasonLine.ftaRate
      expect(rate.value).not.toBeNull()
      expect(rate.withoutTechnicals).not.toBeNull()
      expect(rate.value! - rate.league).toBeGreaterThanOrEqual(FAR_MORE_FTA_RATE)
      expect(rate.withoutTechnicals! - rate.league).toBeGreaterThanOrEqual(FAR_MORE_FTA_RATE)
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
  {
    name: 'line 3: roughly a quarter of his scoring arrives at the line, on both cuts',
    assert: (f) => {
      const share = f.seasonLine.ftPointsShare
      expect(share.value).not.toBeNull()
      expect(share.withoutTechnicals).not.toBeNull()
      for (const cut of [share.value!, share.withoutTechnicals!]) {
        expect(cut).toBeGreaterThanOrEqual(QUARTER_SHARE_FLOOR)
        expect(cut).toBeLessThanOrEqual(QUARTER_SHARE_CEILING)
      }
    },
  },
]

describe.skipIf(
  !existsSync(payloadPath) ||
    !existsSync(creationPath) ||
    !existsSync(contextPath) ||
    !existsSync(freethrowPath),
)(
  'verdict guard: Shai Gilgeous-Alexander positive control',
  () => {
    const payload = parseDerivedPayload(JSON.parse(readFileSync(payloadPath, 'utf-8')))
    const metrics = aggregateShotMetrics(payload.shots, payload.zoneBaseline)
    const creation = aggregateCreationMetrics(
      parseCreationPayload(JSON.parse(readFileSync(creationPath, 'utf-8'))),
    )
    const context = aggregateShotContextMetrics(
      payload,
      parseShotContextPayload(JSON.parse(readFileSync(contextPath, 'utf-8'))),
    )
    const freethrow = aggregateFreethrowMetrics(
      parseFreethrowPayload(JSON.parse(readFileSync(freethrowPath, 'utf-8'))),
    )
    const zone = (name: string) => metrics.zones.find((row) => row.zone === name)!

    it('selection gives away material value', () => {
      expect(metrics.selection.selectionDelta).not.toBeNull()
      expect(metrics.selection.selectionDelta!).toBeLessThanOrEqual(-MATERIAL_SELECTION_COST_PPS)
    })

    it('takes mid-range jumpers at nearly triple league share and far fewer threes than average', () => {
      const mid = zone('Mid-Range')
      expect(mid.attemptShare!).toBeGreaterThanOrEqual(mid.leagueAttemptShare * NEARLY_TRIPLE)
      expect(mid.attemptShare!).toBeLessThanOrEqual(
        mid.leagueAttemptShare * NEARLY_TRIPLE_CEILING,
      )
      expect(metrics.threes.attemptShare!).toBeLessThanOrEqual(
        metrics.threes.leagueAttemptShare * FAR_FEWER_THREES_RATIO,
      )
    })

    it('MVP-level making overwhelms the selection cost', () => {
      expect(metrics.making.makingPpsDelta).not.toBeNull()
      expect(metrics.making.makingPpsDelta!).toBeGreaterThanOrEqual(MVP_MAKING_GAIN_PPS)
      expect(metrics.making.makingPpsDelta!).toBeGreaterThan(
        Math.abs(metrics.selection.selectionDelta!),
      )
    })

    for (const claim of creationClaims) {
      it(claim.name, () => claim.assert(creation))
    }

    for (const claim of assistClaims) {
      it(claim.name, () => claim.assert(context))
    }

    for (const claim of freethrowClaims) {
      it(claim.name, () => claim.assert(freethrow))
    }

    it('licenses only vocabulary backed by declared claims', () => {
      expect(unshippedTermsIn(seasonConfig.verdict)).toEqual([])
      expect(unbackedCreationTerms(seasonConfig.verdict, creationClaims.length)).toEqual([])
      expect(unbackedAssistTerms(seasonConfig.verdict, assistClaims.length)).toEqual([])
      expect(unbackedFreethrowTerms(seasonConfig.verdict, freethrowClaims.length)).toEqual([])
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
