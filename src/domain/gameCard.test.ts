// The game card's pure computation (ADR-0081): pricing at league rates by
// zone (pairs, never rates), the ADR-0019 boundary (heaves and conflicts
// never price, made unpriced points stay real), and the credit counts.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { computeGameCard } from './gameCard'
import { parseGameLogPayload } from './gameLogPayload'

const golden = parseGameLogPayload(
  JSON.parse(
    readFileSync(path.resolve(process.cwd(), 'tests/fixtures/gamelog.golden.json'), 'utf-8'),
  ),
)

describe('computeGameCard', () => {
  it('prices the golden game coherently', () => {
    const game = golden.games[0]!
    const n = computeGameCard(game, golden)
    expect(n.pricedAttempts + n.unpricedAttempts).toBe(game.shots.length)
    // Expected points = attempts priced at league zone rates: bounded by
    // the extreme zone PPS values, and never negative.
    const ppsValues = Object.values(n.leaguePps)
    expect(n.expectedPts).toBeGreaterThanOrEqual(n.pricedAttempts * Math.min(...ppsValues))
    expect(n.expectedPts).toBeLessThanOrEqual(n.pricedAttempts * Math.max(...ppsValues))
    // Scored + unpriced points + trip and technical free throws is the box
    // line (the receipt identity, from the computed side).
    expect(n.scoredPts + n.unpricedPts + n.tripPts + game.technicalFtm).toBe(game.box.pts)
    expect(n.tripCount).toBe(game.trips.length)
  })

  it('separates priced pricing from real unpriced points', () => {
    const game = structuredClone(golden.games[0]!)
    // A made heave: real points on the receipt, never priced into expected.
    game.shots.push({
      zone: 'Backcourt',
      value: 3,
      made: true,
      period: 4,
      clock: '0:01',
      assist: 'unassisted',
    })
    game.box.pts += 3
    const before = computeGameCard(golden.games[0]!, golden)
    const after = computeGameCard(game, golden)
    expect(after.expectedPts).toBe(before.expectedPts)
    expect(after.pricedAttempts).toBe(before.pricedAttempts)
    expect(after.unpricedAttempts).toBe(before.unpricedAttempts + 1)
    expect(after.unpricedPts).toBe(before.unpricedPts + 3)
  })

  it('counts the credit from assist statuses, unknown included', () => {
    const before = computeGameCard(golden.games[0]!, golden)
    const game = structuredClone(golden.games[0]!)
    const madeShot = game.shots.find(
      (s) => s.made && (s.assist === 'assisted' || s.assist === 'unassisted'),
    )!
    const wasAssisted = madeShot.assist === 'assisted'
    madeShot.assist = 'unknown'
    const after = computeGameCard(game, golden)
    expect(after.unknownMakes).toBe(before.unknownMakes + 1)
    expect(after.assisted).toBe(before.assisted - (wasAssisted ? 1 : 0))
    expect(after.unassisted).toBe(before.unassisted - (wasAssisted ? 0 : 1))
  })
})
