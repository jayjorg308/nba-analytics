// The committed verdict guard (ADR-0017) for Keyonte George, colocated with
// the hero copy it keeps honest (ADR-0022). Every directional claim the
// verdict makes is asserted here against the DEPLOYED payload's metrics, so
// a hero:sync that breaks a claim breaks the build. The fix is always to
// rewrite the copy (and this claim mapping with it) — never to loosen an
// assertion so stale prose survives.
//
// George and Cody Williams sit in opposite quadrants of the two-axis model,
// so the two heroes' claim mappings share no shape.
//
// Current verdict, claim by claim:
//   "his shot selection costs him"                          -> claim 1
//   "gets to the rim about half as often as the league,
//    trading it for paint floaters and mid-range"           -> claim 2
//   "converts at or above league expectation in every zone" -> claim 3
//   "Making is not the problem"                             -> claim 3 (rollup)
//   "far more of his shots are pull-up jumpers than is
//    typical"                                               -> why 1 (creation)
//   "the catch-and-shoot looks he does take convert well
//    above league value"                                    -> why 2 (creation)
//   ("the diet is how he creates" is the rhetorical frame of why 1: the
//    selection cost and the pull-up-heavy creation are the same fact.)
//   "he draws fouls far more often than the league"         -> line 1 (free throw)
//   "converts well above the league rate once there"        -> line 2 (free throw)
//   ("the line softens the no" is the rhetorical frame of line 1 + line 2:
//    real scoring the shot chart cannot see, on both technical cuts.)

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { makingDeltaBin } from '../chart/makingScale'
import { aggregateShotMetrics } from '../domain/aggregate'
import { aggregateCreationMetrics } from '../domain/aggregateCreation'
import { aggregateFreethrowMetrics } from '../domain/aggregateFreethrow'
import { parseCreationPayload } from '../domain/creationPayload'
import { parseFreethrowPayload } from '../domain/freethrowPayload'
import { parseDerivedPayload } from '../domain/payload'
import { keyonteGeorge as hero } from './keyonte-george'
import type { CreationClaim, FreethrowClaim } from './verdictLexicon'
import {
  invalidAssistInterpretationsIn,
  unbackedAssistTerms,
  unbackedCreationTerms,
  unbackedFreethrowTerms,
  unshippedTermsIn,
} from './verdictLexicon'

// One source of hero truth: the guard reads the same deployed payloads the
// app fetches for this slug/season (see src/heroes/urls.ts).
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
const freethrowPath = path.resolve(
  process.cwd(),
  'public',
  'data',
  hero.slug,
  `${hero.season}.freethrow.json`,
)

// Verdict semantics — thresholds the prose is held to:
// "costs him": selection at least 0.05 PPS below the league diet — too large
// to be rounding or one noisy zone (George: −0.069).
const MATERIAL_SELECTION_PPS = 0.05
// "about half as often": his rim share may not exceed 60% of the league's —
// past that, "half" is a lie (George: 15.3% vs 28.4% = 54%).
const RIM_SHARE_HALF_CEILING = 0.6
// "Making is not the problem": the making rollup must be positive by more
// than rounding (George: +0.044).
const MATERIAL_MAKING_PPS = 0.02
// "far more ... than is typical": a pull-up share at least 10 percentage
// points above the league's — double the diet-lean bar (George: 41.4% vs
// 25.2%).
const FAR_MORE_SHARE_PP = 0.1
// "well above league value": a PPS gap of at least 0.10 — twice the
// materiality bar (George: 1.273 vs 1.100).
const WELL_ABOVE_PPS = 0.1
// "draws fouls far more often": FTA rate at least 0.10 over the league's —
// ten extra free throws per hundred shots, well past any rounding story
// (actual: 0.429 / 0.418 without technicals, vs league 0.264).
const FAR_MORE_FTA_RATE = 0.1
// "converts well above the league rate": FT% at least 5 points over league —
// the gap between an average and a very good free-throw shooter (actual:
// 0.892 / 0.894 without technicals, vs league 0.783).
const WELL_ABOVE_FT_PCT = 0.05

// The creation-kind claims (ADR-0029): declaring these — asserted against
// aggregateCreationMetrics over the DEPLOYED creation payload — is what
// licenses the verdict's creation vocabulary.
const creationClaims: CreationClaim[] = [
  {
    name: 'why 1: pull-up share far above the league diet',
    assert: (c) => {
      const pu = c.general.jumperContexts.find((r) => r.context === 'Pull Ups')!
      expect(pu.attemptShare).not.toBeNull()
      expect(pu.attemptShare! - pu.leagueAttemptShare).toBeGreaterThanOrEqual(FAR_MORE_SHARE_PP)
    },
  },
  {
    name: 'why 2: catch-and-shoot converts well above league value, sample-safe',
    assert: (c) => {
      const cs = c.general.jumperContexts.find((r) => r.context === 'Catch and Shoot')!
      expect(cs.pps).not.toBeNull()
      expect(cs.leaguePps).not.toBeNull()
      // stated unhedged in the verdict, so it must clear the † bar
      expect(cs.smallSamplePps).toBe(false)
      expect(cs.pps! - cs.leaguePps!).toBeGreaterThanOrEqual(WELL_ABOVE_PPS)
    },
  },
]

// The line-sentence's free-throw claims (ADR-0055/0056): every assertion on
// a league-baselined metric holds on BOTH technical cuts — a claim that
// flips on eight technical free throws was never sturdy enough to author.
// Season FTA (378) clears the † bar, so both sentences state unhedged.
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
      // stated unhedged in the verdict, so it must clear the † bar
      expect(f.seasonLine.smallSampleConversion).toBe(false)
      expect(conv.value! - conv.league).toBeGreaterThanOrEqual(WELL_ABOVE_FT_PCT)
      expect(conv.withoutTechnicals! - conv.league).toBeGreaterThanOrEqual(WELL_ABOVE_FT_PCT)
    },
  },
]

describe.skipIf(
  !existsSync(payloadPath) || !existsSync(creationPath) || !existsSync(freethrowPath),
)(
  'verdict guard: Keyonte George (ADR-0017/0029)',
  () => {
  const payload = parseDerivedPayload(JSON.parse(readFileSync(payloadPath, 'utf-8')))
  const m = aggregateShotMetrics(payload.shots, payload.zoneBaseline)
  const zone = (z: string) => m.zones.find((r) => r.zone === z)!
  const creation = aggregateCreationMetrics(
    parseCreationPayload(JSON.parse(readFileSync(creationPath, 'utf-8'))),
  )
  const freethrow = aggregateFreethrowMetrics(
    parseFreethrowPayload(JSON.parse(readFileSync(freethrowPath, 'utf-8'))),
  )

  it('claim 1: selection is materially below the league diet', () => {
    expect(m.selection.selectionDelta).not.toBeNull()
    expect(m.selection.selectionDelta!).toBeLessThanOrEqual(-MATERIAL_SELECTION_PPS)
  })

  it('claim 2: rim share ~half the league, traded for paint floaters and mid-range', () => {
    const ra = zone('Restricted Area')
    expect(ra.attemptShare).not.toBeNull()
    expect(ra.attemptShare!).toBeLessThanOrEqual(ra.leagueAttemptShare * RIM_SHARE_HALF_CEILING)
    const itp = zone('In The Paint (Non-RA)')
    expect(itp.attemptShare!).toBeGreaterThan(itp.leagueAttemptShare)
    const mid = zone('Mid-Range')
    expect(mid.attemptShare!).toBeGreaterThan(mid.leagueAttemptShare)
  })

  it('claim 3: making at or above league in every zone, and materially positive overall', () => {
    // "reads at league average or better" is the making scale's own
    // semantics (ADR-0013): no zone may bin cold.
    for (const z of m.zones) {
      expect(makingDeltaBin(z.makingDelta), z.zone).toBeGreaterThanOrEqual(0)
    }
    expect(m.making.makingPpsDelta).not.toBeNull()
    expect(m.making.makingPpsDelta!).toBeGreaterThanOrEqual(MATERIAL_MAKING_PPS)
  })

  // The why-sentence's creation-kind claims (ADR-0029), run against the
  // deployed creation payload's metrics.
  for (const claim of creationClaims) {
    it(claim.name, () => claim.assert(creation))
  }

  // The line-sentence's free-throw claims (ADR-0055/0056), run against the
  // deployed free-throw payload's metrics.
  for (const claim of freethrowClaims) {
    it(claim.name, () => claim.assert(freethrow))
  }

  it('creation and line vocabulary are claim-backed; unshipped vocabulary absent (ADR-0029)', () => {
    // Case 2 vocabulary requires a creation claim, free-throw vocabulary a
    // free-throw claim. Case 3 assist vocabulary is independently gated;
    // Keyonte's current verdict chooses not to use it.
    expect(unshippedTermsIn(hero.verdict)).toEqual([])
    expect(unbackedCreationTerms(hero.verdict, creationClaims.length)).toEqual([])
    expect(unbackedFreethrowTerms(hero.verdict, freethrowClaims.length)).toEqual([])
    expect(unbackedAssistTerms(hero.verdict, 0)).toEqual([])
    expect(invalidAssistInterpretationsIn(hero.verdict)).toEqual([])
  })
  },
)
