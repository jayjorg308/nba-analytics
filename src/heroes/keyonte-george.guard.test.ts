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

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { makingDeltaBin } from '../chart/makingScale'
import { aggregateShotMetrics } from '../domain/aggregate'
import { parseDerivedPayload } from '../domain/payload'
import { keyonteGeorge as hero } from './keyonte-george'

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
// "costs him": selection at least 0.05 PPS below the league diet — too large
// to be rounding or one noisy zone (George: −0.069).
const MATERIAL_SELECTION_PPS = 0.05
// "about half as often": his rim share may not exceed 60% of the league's —
// past that, "half" is a lie (George: 15.3% vs 28.4% = 54%).
const RIM_SHARE_HALF_CEILING = 0.6
// "Making is not the problem": the making rollup must be positive by more
// than rounding (George: +0.044).
const MATERIAL_MAKING_PPS = 0.02

describe.skipIf(!existsSync(payloadPath))('verdict guard: Keyonte George (ADR-0017)', () => {
  const payload = parseDerivedPayload(JSON.parse(readFileSync(payloadPath, 'utf-8')))
  const m = aggregateShotMetrics(payload.shots, payload.zoneBaseline)
  const zone = (z: string) => m.zones.find((r) => r.zone === z)!

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
