// The committed verdict guard (ADR-0017). heroConfig.verdict is authored
// prose — this test is what keeps it honest. Every directional claim the
// copy makes is asserted here against the DEPLOYED payload's metrics, so a
// hero:sync (or a hero swap) that breaks a claim breaks the build. The fix
// is always to rewrite the copy (and this guard's claim mapping with it) —
// never to loosen an assertion so stale prose survives.
//
// Current verdict, claim by claim:
//   "where he shoots from is essentially league-average"  -> claim 1
//   "he converts below what his shot diet should yield"   -> claim 2
//   "the gap comes almost entirely from three"            -> claim 3

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { makingDeltaBin } from '../chart/makingScale'
import { aggregateShotMetrics } from '../domain/aggregate'
import { ZONE_POINT_VALUE } from '../domain/constants'
import { parseDerivedPayload } from '../domain/payload'
import { heroConfig } from '../heroConfig'

// One source of hero truth: the guard reads the same payload the app fetches.
const payloadPath = path.resolve(
  process.cwd(),
  'public',
  heroConfig.payloadUrl.replace(import.meta.env.BASE_URL, ''),
)

// Verdict semantics — thresholds the prose is held to:
// "essentially league-average": within ±0.02 PPS of the league diet (~2% of
// the ~1.09 baseline; smaller than one made basket per hundred shots).
const LEAGUE_AVERAGE_SELECTION_BAND_PPS = 0.02
// "converts below": making costs at least 0.05 PPS — too large to be
// rounding or one noisy zone.
const MATERIAL_MAKING_PPS = 0.05

describe.skipIf(!existsSync(payloadPath))('verdict guard (ADR-0017)', () => {
  const payload = parseDerivedPayload(JSON.parse(readFileSync(payloadPath, 'utf-8')))
  const m = aggregateShotMetrics(payload.shots, payload.zoneBaseline)

  it('claim 1: selection is essentially league-average', () => {
    expect(m.selection.selectionDelta).not.toBeNull()
    expect(Math.abs(m.selection.selectionDelta!)).toBeLessThanOrEqual(
      LEAGUE_AVERAGE_SELECTION_BAND_PPS,
    )
  })

  it('claim 2: making is materially below expectation', () => {
    expect(m.making.makingPpsDelta).not.toBeNull()
    expect(m.making.makingPpsDelta!).toBeLessThanOrEqual(-MATERIAL_MAKING_PPS)
  })

  it('claim 3: the gap comes almost entirely from three', () => {
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
      expect(heroConfig.verdict.toLowerCase()).not.toContain(term)
    }
  })
})
