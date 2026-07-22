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
import { shaiGilgeousAlexander as hero } from './shai-gilgeous-alexander'
import type { AssistClaim, CreationClaim, FreethrowClaim } from './verdictLexicon'
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
const contextPath = path.resolve(
  process.cwd(),
  'public',
  'data',
  hero.slug,
  `${hero.season}.context.json`,
)
const freethrowPath = path.resolve(
  process.cwd(),
  'public',
  'data',
  hero.slug,
  `${hero.season}.freethrow.json`,
)

const MATERIAL_SELECTION_COST_PPS = 0.05
const NEARLY_TRIPLE = 2.5
const FAR_FEWER_THREES_RATIO = 0.6
const MVP_MAKING_GAIN_PPS = 0.15
const MORE_THAN_HALF = 0.5
const FAR_ABOVE_VALUE_PPS = 0.15
const ONE_IN_FIVE_ASSISTED = 0.2
// "draws fouls far more often": FTA rate at least 0.10 over the league's —
// ten extra free throws per hundred shots (actual: 0.465 / 0.447 without
// technicals, vs league 0.264).
const FAR_MORE_FTA_RATE = 0.1
// "converts well above the league rate": FT% at least 5 points over league
// (actual: 0.879 / 0.881 without technicals, vs league 0.783).
const WELL_ABOVE_FT_PCT = 0.05
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
    name: 'why: at most one in five makes is officially assisted',
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

    it('takes mid-range shots at nearly triple league share and far fewer threes', () => {
      const mid = zone('Mid-Range')
      expect(mid.attemptShare!).toBeGreaterThanOrEqual(mid.leagueAttemptShare * NEARLY_TRIPLE)
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
      expect(unshippedTermsIn(hero.verdict)).toEqual([])
      expect(unbackedCreationTerms(hero.verdict, creationClaims.length)).toEqual([])
      expect(unbackedAssistTerms(hero.verdict, assistClaims.length)).toEqual([])
      expect(unbackedFreethrowTerms(hero.verdict, freethrowClaims.length)).toEqual([])
      expect(invalidAssistInterpretationsIn(hero.verdict)).toEqual([])
    })
  },
)
