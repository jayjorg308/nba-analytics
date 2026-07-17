import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { aggregateShotMetrics } from '../domain/aggregate'
import { aggregateCreationMetrics } from '../domain/aggregateCreation'
import { aggregateShotContextMetrics } from '../domain/aggregateShotContext'
import { parseCreationPayload } from '../domain/creationPayload'
import { parseDerivedPayload } from '../domain/payload'
import { parseShotContextPayload } from '../domain/shotContextPayload'
import { shaiGilgeousAlexander as hero } from './shai-gilgeous-alexander'
import type { AssistClaim, CreationClaim } from './verdictLexicon'
import {
  invalidAssistInterpretationsIn,
  unbackedAssistTerms,
  unbackedCreationTerms,
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

const MATERIAL_SELECTION_COST_PPS = 0.05
const NEARLY_TRIPLE = 2.5
const FAR_FEWER_THREES_RATIO = 0.6
const MVP_MAKING_GAIN_PPS = 0.15
const MORE_THAN_HALF = 0.5
const FAR_ABOVE_VALUE_PPS = 0.15
const ONE_IN_FIVE_ASSISTED = 0.2

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

describe.skipIf(
  !existsSync(payloadPath) || !existsSync(creationPath) || !existsSync(contextPath),
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

    it('licenses only creation vocabulary backed by declared claims', () => {
      expect(unshippedTermsIn(hero.verdict)).toEqual([])
      expect(unbackedCreationTerms(hero.verdict, creationClaims.length)).toEqual([])
      expect(unbackedAssistTerms(hero.verdict, assistClaims.length)).toEqual([])
      expect(invalidAssistInterpretationsIn(hero.verdict)).toEqual([])
    })
  },
)
