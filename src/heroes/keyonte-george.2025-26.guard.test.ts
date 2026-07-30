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
// Current verdict (voice per docs/voice/VOICE.md, ADR-0070), claim by claim:
//   "his shot selection costs him"                          -> claim 1
//   "gets to the rim about half as often as the league
//    does, trading those attempts for paint floaters and
//    mid-range jumpers"                                     -> claim 2
//   "converts at or above expectation in every zone"        -> claim 3
//   "Shot making isn't the problem"                         -> claim 3 (rollup)
//   "far more of his attempts are pull-up jumpers than is
//    typical"                                               -> why 1 (creation)
//   "the catch-and-shoot looks he gets least often"         -> why 2 (creation)
//   "are the ones he hits far above average"                -> why 3 (creation)
//   "he draws fouls far more often than average"            -> line 1 (free throw)
//   "converts well above the league rate once he gets
//    there"                                                 -> line 2 (free throw)
//   ("the free throw line softens the verdict" is the rhetorical frame of
//    line 1 + line 2: real scoring the shot chart cannot see, on both
//    technical cuts.)

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
import { authoringProblems } from './authoring'
import { keyonteGeorge as hero } from './keyonte-george'
import { seasonArgumentOf } from './types'
import {
  FAR_DIET_LEAN_PP,
  FAR_FTA_RATE,
  FAR_PPS,
  MATERIAL_PPS,
  NEUTRAL_BAND_PPS,
  WELL_FT_PCT,
} from './verdictLadder'
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
// "costs him": a bare directional cost prices at material — too large to
// be rounding or one noisy zone (George: −0.069).
const MATERIAL_SELECTION_PPS = MATERIAL_PPS
// "about half as often": a TWO-SIDED band (ADR-0068's approximation-word
// discipline) — under 40% of the league's rim share "half" understates,
// past 60% it overstates (George: 15.3% vs 28.4% = 54%).
const RIM_SHARE_HALF_FLOOR = 0.4
const RIM_SHARE_HALF_CEILING = 0.6
// "Making is not the problem": positive past the neutral band — the claim
// is direction, not magnitude, so the neutral edge is the right price
// (George: +0.044; previously misnamed MATERIAL while carrying this same
// neutral-edge value).
const POSITIVE_MAKING_PPS = NEUTRAL_BAND_PPS
// "far more ... than is typical": the ladder's far diet lean — double the
// diet-lean bar (George: 41.4% vs 25.2%).
const FAR_MORE_SHARE_PP = FAR_DIET_LEAN_PP
// "hits far above average": the ladder's far bar (George: 1.273 vs
// 1.100 — a +0.172 gap, past the 0.15 floor with margin).
const FAR_ABOVE_PPS = FAR_PPS
// "draws fouls far more often": the ladder's far FTA-rate bar — ten extra
// free throws per hundred shots, well past any rounding story
// (actual: 0.429 / 0.418 without technicals, vs league 0.264).
const FAR_MORE_FTA_RATE = FAR_FTA_RATE
// "converts well above the league rate": the ladder's FT "well" bar — the
// gap between an average and a very good free-throw shooter (actual:
// 0.892 / 0.894 without technicals, vs league 0.783).
const WELL_ABOVE_FT_PCT = WELL_FT_PCT

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
    name: 'why 2: catch-and-shoot is the context he gets least often',
    assert: (c) => {
      // "least often" is a within-diet comparative over the real contexts:
      // catch-and-shoot's share sits under both inside-10 and pull-ups
      // (22.5% vs 35.9% and 41.4%). The 2-attempt 'Other' residual is the
      // classifier's gap, not a kind of look a reader counts (ADR-0031).
      const cs = c.general.jumperContexts.find((r) => r.context === 'Catch and Shoot')!
      const pu = c.general.jumperContexts.find((r) => r.context === 'Pull Ups')!
      expect(cs.attemptShare).not.toBeNull()
      expect(c.general.inside.attemptShare).not.toBeNull()
      expect(pu.attemptShare).not.toBeNull()
      expect(cs.attemptShare!).toBeLessThan(c.general.inside.attemptShare!)
      expect(cs.attemptShare!).toBeLessThan(pu.attemptShare!)
    },
  },
  {
    name: 'why 3: catch-and-shoot hits far above average, sample-safe',
    assert: (c) => {
      const cs = c.general.jumperContexts.find((r) => r.context === 'Catch and Shoot')!
      expect(cs.pps).not.toBeNull()
      expect(cs.leaguePps).not.toBeNull()
      // stated unhedged in the verdict, so it must clear the † bar
      expect(cs.smallSamplePps).toBe(false)
      expect(cs.pps! - cs.leaguePps!).toBeGreaterThanOrEqual(FAR_ABOVE_PPS)
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

  it('claim 2: rim share ~half the league, traded for paint floaters and mid-range jumpers', () => {
    const ra = zone('Restricted Area')
    expect(ra.attemptShare).not.toBeNull()
    expect(ra.attemptShare!).toBeGreaterThanOrEqual(ra.leagueAttemptShare * RIM_SHARE_HALF_FLOOR)
    expect(ra.attemptShare!).toBeLessThanOrEqual(ra.leagueAttemptShare * RIM_SHARE_HALF_CEILING)
    const itp = zone('In The Paint (Non-RA)')
    expect(itp.attemptShare!).toBeGreaterThan(itp.leagueAttemptShare)
    const mid = zone('Mid-Range')
    expect(mid.attemptShare!).toBeGreaterThan(mid.leagueAttemptShare)
  })

  it('claim 3: making at or above league in every zone, and positive past the neutral band', () => {
    // "reads at league average or better" is the making scale's own
    // semantics (ADR-0013): no zone may bin cold.
    for (const z of m.zones) {
      expect(makingDeltaBin(z.makingDelta), z.zone).toBeGreaterThanOrEqual(0)
    }
    expect(m.making.makingPpsDelta).not.toBeNull()
    expect(m.making.makingPpsDelta!).toBeGreaterThanOrEqual(POSITIVE_MAKING_PPS)
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
