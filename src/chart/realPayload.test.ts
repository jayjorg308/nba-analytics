// Guards the committed deployment copy (public/data/) against drift: it must
// strict-parse, fit entirely on the rendered half court, and match the latest
// derived payload when the gitignored data/ layer is present (dev machines).
// Skips cleanly on clones without the synced file.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { aggregateShotMetrics } from '../domain/aggregate'
import { parseDerivedPayload } from '../domain/payload'
import { classifyByGeometry, isOnCourt } from './geometry'
import { makingDeltaBin } from './makingScale'

const publicPayloadPath = path.resolve(process.cwd(), 'public/data/cody-williams/2025-26.json')

describe.skipIf(!existsSync(publicPayloadPath))('deployed payload (launch hero)', () => {
  it('strict-parses and renders every shot on the half court', () => {
    const payload = parseDerivedPayload(
      JSON.parse(readFileSync(publicPayloadPath, 'utf-8')),
    )
    expect(payload.shots).toHaveLength(509)
    expect(payload.shots.every(isOnCourt)).toBe(true) // 509 dots, 0 skipped
  })

  it('drawn zone geometry agrees with the data zone assignment on every shot', () => {
    // 509/509 is PAYLOAD-SPECIFIC: this payload contains no boundary-sitting
    // shots (RA max radial 39.66 vs paint min 40.46). If a future payload
    // disagrees, document the disagreement per ADR-0012 — the data's
    // assignment stands; never "fix" it by reassigning the shot.
    const payload = parseDerivedPayload(
      JSON.parse(readFileSync(publicPayloadPath, 'utf-8')),
    )
    const disagreements = payload.shots
      .filter((s) => s.zoneBasic !== 'Backcourt')
      .filter((s) => classifyByGeometry(s.locX, s.locY) !== s.zoneBasic)
    expect(disagreements).toEqual([])
  })

  it('bins the launch hero zones as the plan expects', () => {
    const payload = parseDerivedPayload(
      JSON.parse(readFileSync(publicPayloadPath, 'utf-8')),
    )
    const m = aggregateShotMetrics(payload.shots, payload.zoneBaseline)
    const bins = Object.fromEntries(
      m.zones.map((z) => [z.zone, makingDeltaBin(z.makingDelta)]),
    )
    expect(bins).toEqual({
      'Restricted Area': 0, // +0.7pp — league-level finishing reads neutral
      'In The Paint (Non-RA)': 0, // +0.4pp
      'Mid-Range': 1, // +2.8pp
      'Left Corner 3': -3, // −18.3pp
      'Right Corner 3': -1, // −3.3pp
      'Above the Break 3': -3, // −22.5pp — the story: cold from deep
    })
  })

  it('anchors the verdict-grain numbers the headline blocks will state', () => {
    // ADR-0016: selection ~league-average; making costs ~0.11 PPS; the
    // combined threes carry it at a grain that clears the small-sample bar.
    const payload = parseDerivedPayload(
      JSON.parse(readFileSync(publicPayloadPath, 'utf-8')),
    )
    const m = aggregateShotMetrics(payload.shots, payload.zoneBaseline)
    expect(m.selection.playerDietExpectedPps).toBeCloseTo(1.0986, 3)
    expect(m.making.actualPps).toBeCloseTo(0.9902, 3)
    expect(m.making.makingPpsDelta).toBeCloseTo(-0.1084, 3)
    expect(m.threes.attempts).toBe(131)
    expect(m.threes.smallSampleMaking).toBe(false)
    expect(m.threes.makingDelta).toBeCloseTo(-0.1458, 3)
  })

  it('matches the latest derived payload when data/ is present', () => {
    const derivedDir = path.resolve(process.cwd(), 'data/derived/cody-williams/2025-26')
    if (!existsSync(derivedDir)) return
    const latest = readdirSync(derivedDir).filter((f) => f.endsWith('.json')).sort().at(-1)
    if (!latest) return
    const derived: unknown = JSON.parse(readFileSync(path.join(derivedDir, latest), 'utf-8'))
    const deployed: unknown = JSON.parse(readFileSync(publicPayloadPath, 'utf-8'))
    // out of sync -> run `npm run hero:sync`
    expect(deployed).toEqual(derived)
  })
})
