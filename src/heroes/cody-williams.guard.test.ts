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
// One engine-copy claim rides along: the zone table's Restricted Area
// annotation ("highest-value shot on the floor") states a league value
// hierarchy, asserted against the same deployed payload    -> table claim

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { makingDeltaBin } from '../chart/makingScale'
import { aggregateShotMetrics } from '../domain/aggregate'
import { ZONE_POINT_VALUE } from '../domain/constants'
import { parseDerivedPayload } from '../domain/payload'
import { codyWilliams as hero } from './cody-williams'

// One source of hero truth: the guard reads the same deployed payload the
// app fetches for this slug/season (see src/heroes/urls.ts).
const payloadPath = path.resolve(
  process.cwd(),
  'public',
  'data',
  hero.slug,
  `${hero.season}.json`,
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

describe.skipIf(!existsSync(payloadPath))('verdict guard (ADR-0017)', () => {
  const payload = parseDerivedPayload(JSON.parse(readFileSync(payloadPath, 'utf-8')))
  const m = aggregateShotMetrics(payload.shots, payload.zoneBaseline)

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

  it('stays inside the v1 thesis: no creation language (ADR-0005)', () => {
    // Lexical tripwire, not NLP: the obvious creation vocabulary must never
    // appear in the verdict — v1 has no creation signal to back it.
    const forbidden = [
      'catch-and-shoot',
      'pull-up',
      'pull up',
      'assisted',
      'unassisted',
      'contested',
      'uncontested',
      'off the dribble',
      'creates',
      'creation',
      'settles',
      'shot clock',
    ]
    for (const term of forbidden) {
      expect(hero.verdict.toLowerCase()).not.toContain(term)
    }
  })
})
