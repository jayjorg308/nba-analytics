import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { aggregateShotContextMetrics, shotIdentity } from './aggregateShotContext'
import { parseDerivedPayload } from './payload'
import { parseShotContextPayload } from './shotContextPayload'

const shots = parseDerivedPayload(
  JSON.parse(readFileSync(new URL('../../tests/fixtures/derived.golden.json', import.meta.url), 'utf-8')),
)
const context = parseShotContextPayload(
  JSON.parse(
    readFileSync(new URL('../../tests/fixtures/shot-context.golden.json', import.meta.url), 'utf-8'),
  ),
)

describe('aggregateShotContextMetrics', () => {
  it('computes classified share, coverage, and honest bounds over all makes', () => {
    const metrics = aggregateShotContextMetrics(shots, context)
    expect(metrics.all).toMatchObject({
      attempts: 15,
      makes: 7,
      assistedMakes: 1,
      unassistedMakes: 0,
      unknownMakes: 6,
      classifiedMakes: 1,
    })
    expect(metrics.all.coverage).toBeCloseTo(1 / 7)
    expect(metrics.all.assistedShare).toBe(1)
    expect(metrics.all.minAssistedShare).toBeCloseTo(1 / 7)
    expect(metrics.all.maxAssistedShare).toBe(1)
  })

  it('uses the existing zone hierarchy and a sum-before-divide threes parent', () => {
    const metrics = aggregateShotContextMetrics(shots, context)
    expect(metrics.zones).toHaveLength(6)
    expect(metrics.threes).toMatchObject({ makes: 3, assistedMakes: 1, unknownMakes: 2 })
    expect(metrics.threes.makes).toBe(
      metrics.zones
        .filter((row) => row.zone.includes('3'))
        .reduce((sum, row) => sum + row.makes, 0),
    )
    expect(metrics.midRangeBands).toHaveLength(3)
  })

  it('provides the normalized assist status lookup used by shot tooltips', () => {
    const metrics = aggregateShotContextMetrics(shots, context)
    expect(metrics.assistStatusByShotKey.get(shotIdentity(shots.shots[3]!))).toBe('assisted')
    expect(metrics.assistStatusByShotKey.get(shotIdentity(shots.shots[0]!))).toBe(
      'notApplicable',
    )
  })

  it('rejects sibling identity drift before computing anything', () => {
    const broken = structuredClone(context)
    broken.shots[0]!.gameEventId = 123456
    expect(() => aggregateShotContextMetrics(shots, broken)).toThrow(/shot identities/i)
  })

  it('rejects same-count provenance for unrelated source games', () => {
    const broken = structuredClone(context)
    broken._meta.sourceGames[0]!.gameId = '0022500099'
    expect(() => aggregateShotContextMetrics(shots, broken)).toThrow(/provenance/i)
  })

  it('rejects a classified assist status on a missed shot', () => {
    const broken = structuredClone(context)
    broken.shots[0]!.assistStatus = 'assisted'
    broken.shots[0]!.assistEvidence = 'descriptionCredit'
    broken.shots[0]!.eventMatch = 'matched'
    broken.shots[0]!.failureReason = null
    expect(() => aggregateShotContextMetrics(shots, broken)).toThrow(/miss.*notApplicable/i)
  })
})
