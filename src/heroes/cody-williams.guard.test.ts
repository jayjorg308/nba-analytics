// The committed verdict guard (ADR-0017), colocated with the hero copy it
// keeps honest — the guard file is part of the hero (ADR-0022): a new hero
// means a new <slug>.guard.test.ts beside its config module. Every
// directional claim the verdict makes is asserted here against the DEPLOYED
// payload's metrics, so a hero:sync that breaks a claim breaks the build.
// The fix is always to rewrite the copy (and this claim mapping with it) —
// never to loosen an assertion so stale prose survives.
//
// Current verdict, claim by claim:
//   "lives at the rim"                                     -> claim 1
//   "rarely fires from three"                              -> claim 2
//   "nets out to an essentially league-average shot diet"  -> claim 3
//   "he converts below what his shot diet should yield"    -> claim 4
//   "the gap comes almost entirely from three"             -> claim 5
//   "almost all of his threes arrive off the catch"        -> why 1 (creation)
//   "those catch-and-shoot looks he converts far below
//    league value"                                         -> why 2 (creation)
//   ("the misses are not self-created difficulty" is the rhetorical frame
//    of why 1 + why 2 together — his threes are overwhelmingly not
//    self-created, and those are the ones missing.)
// One engine-copy claim rides along: the zone table's Restricted Area
// annotation ("highest-value shot on the floor") states a league value
// hierarchy, asserted against the same deployed payload    -> table claim

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { makingDeltaBin } from '../chart/makingScale'
import { aggregateShotMetrics } from '../domain/aggregate'
import { aggregateCreationMetrics } from '../domain/aggregateCreation'
import { ZONE_POINT_VALUE } from '../domain/constants'
import { parseCreationPayload } from '../domain/creationPayload'
import { parseDerivedPayload } from '../domain/payload'
import { codyWilliams as hero } from './cody-williams'
import type { CreationClaim } from './verdictLexicon'
import {
  invalidAssistInterpretationsIn,
  unbackedAssistTerms,
  unbackedCreationTerms,
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

// Verdict semantics — thresholds the prose is held to:
// "essentially league-average": within ±0.02 PPS of the league diet (~2% of
// the ~1.09 baseline; smaller than one made basket per hundred shots).
const LEAGUE_AVERAGE_SELECTION_BAND_PPS = 0.02
// "converts below": making costs at least 0.05 PPS — too large to be
// rounding or one noisy zone.
const MATERIAL_MAKING_PPS = 0.05
// "lives at" / "rarely fires from": a diet lean of at least 5 percentage
// points of attempt share — several shots per hundred, well outside
// single-season share noise (shares stabilize by ~34 attempts, CONTEXT.md).
const MATERIAL_DIET_LEAN_PP = 0.05
// "almost all": at least four of five — below that the phrase is a lie
// (actual: 117/131 = 89.3%).
const ALMOST_ALL_SHARE = 0.8
// "far below league value": a PPS gap of at least 0.25 — five times the
// materiality bar; a quarter point per shot (actual: 0.711 vs 1.100).
const FAR_BELOW_PPS = 0.25

// The creation-kind claims (ADR-0029): declaring these — asserted against
// aggregateCreationMetrics over the DEPLOYED creation payload — is what
// licenses the verdict's creation vocabulary. Zero declared claims + any
// creation vocabulary = tripwire failure.
const creationClaims: CreationClaim[] = [
  {
    name: 'why 1: almost all of his threes arrive off the catch',
    assert: (c) => {
      const cs3 = c.general.catchAndShootThrees
      expect(cs3.share).not.toBeNull()
      expect(cs3.share!).toBeGreaterThanOrEqual(ALMOST_ALL_SHARE)
    },
  },
  {
    name: 'why 2: catch-and-shoot converts far below league value, sample-safe',
    assert: (c) => {
      const cs = c.general.jumperContexts.find((r) => r.context === 'Catch and Shoot')!
      expect(cs.pps).not.toBeNull()
      expect(cs.leaguePps).not.toBeNull()
      // stated unhedged in the verdict, so it must clear the † bar
      expect(cs.smallSamplePps).toBe(false)
      expect(cs.leaguePps! - cs.pps!).toBeGreaterThanOrEqual(FAR_BELOW_PPS)
    },
  },
]

describe.skipIf(!existsSync(payloadPath) || !existsSync(creationPath))(
  'verdict guard (ADR-0017/0029)',
  () => {
  const payload = parseDerivedPayload(JSON.parse(readFileSync(payloadPath, 'utf-8')))
  const m = aggregateShotMetrics(payload.shots, payload.zoneBaseline)
  const creation = aggregateCreationMetrics(
    parseCreationPayload(JSON.parse(readFileSync(creationPath, 'utf-8'))),
  )

  it('claim 1: lives at the rim — rim share materially above league', () => {
    const rim = m.zones.find((z) => z.zone === 'Restricted Area')
    expect(rim?.attemptShare).not.toBeNull()
    expect(rim!.attemptShare! - rim!.leagueAttemptShare).toBeGreaterThanOrEqual(
      MATERIAL_DIET_LEAN_PP,
    )
  })

  it('claim 2: rarely fires from three — three share materially below league', () => {
    expect(m.threes.attemptShare).not.toBeNull()
    expect(m.threes.leagueAttemptShare - m.threes.attemptShare!).toBeGreaterThanOrEqual(
      MATERIAL_DIET_LEAN_PP,
    )
  })

  it('claim 3: the diet nets out essentially league-average', () => {
    expect(m.selection.selectionDelta).not.toBeNull()
    expect(Math.abs(m.selection.selectionDelta!)).toBeLessThanOrEqual(
      LEAGUE_AVERAGE_SELECTION_BAND_PPS,
    )
  })

  it('claim 4: making is materially below expectation', () => {
    expect(m.making.makingPpsDelta).not.toBeNull()
    expect(m.making.makingPpsDelta!).toBeLessThanOrEqual(-MATERIAL_MAKING_PPS)
  })

  it('claim 5: the gap comes almost entirely from three', () => {
    // The combined threes read cold, at a grain that clears the
    // small-sample bar (the whole point of the ADR-0016 rollup)...
    expect(makingDeltaBin(m.threes.makingDelta)).toBeLessThan(0)
    expect(m.threes.smallSampleMaking).toBe(false)
    // ...and no two-point zone reads below league — "reads at league
    // average" is the making scale's neutral band (ADR-0013), so the same
    // semantics the court shows the reader are the ones the prose is held to.
    for (const z of m.zones.filter((r) => ZONE_POINT_VALUE[r.zone] === 2)) {
      expect(makingDeltaBin(z.makingDelta), z.zone).toBeGreaterThanOrEqual(0)
    }
  })

  it('table claim: the restricted area is the highest-value shot on the floor', () => {
    const rim = m.zones.find((z) => z.zone === 'Restricted Area')!
    for (const z of m.zones) {
      if (z.zone !== 'Restricted Area') {
        expect(rim.leaguePps, z.zone).toBeGreaterThan(z.leaguePps)
      }
    }
  })

  // The why-sentence's creation-kind claims (ADR-0029), run against the
  // deployed creation payload's metrics.
  for (const claim of creationClaims) {
    it(claim.name, () => claim.assert(creation))
  }

  it('creation vocabulary is bucket-backed; unshipped vocabulary absent (ADR-0029)', () => {
    // Case 2 vocabulary requires a creation claim. Case 3 assist vocabulary
    // is independently gated; Cody's current verdict chooses not to use it.
    expect(unshippedTermsIn(hero.verdict)).toEqual([])
    expect(unbackedCreationTerms(hero.verdict, creationClaims.length)).toEqual([])
    expect(unbackedAssistTerms(hero.verdict, 0)).toEqual([])
    expect(invalidAssistInterpretationsIn(hero.verdict)).toEqual([])
  })
  },
)
