// Guards the committed team deployment copies (public/data/_teams/, ADR-0082):
// every deployed team shot payload must strict-parse, and its roster and
// rows must be coherent (every shooter is a real player id; the payload's
// season is the file's season). Skips cleanly on clones without synced
// team files. Sibling team contracts (feeding, ledger) join this guard as
// they ship — their frontier fields must then equal this payload's.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { aggregateShotMetrics } from './aggregate'
import { parseTeamShotPayload } from './teamShotPayload'

const teamsDir = path.resolve(process.cwd(), 'public/data/_teams')

function deployedTeamPayloads(): { tricode: string; season: string; file: string }[] {
  if (!existsSync(teamsDir)) return []
  const found: { tricode: string; season: string; file: string }[] = []
  for (const tricode of readdirSync(teamsDir)) {
    const dir = path.join(teamsDir, tricode)
    for (const file of readdirSync(dir)) {
      const m = /^(?<season>\d{4}-\d{2})\.json$/.exec(file)
      if (m?.groups) found.push({ tricode, season: m.groups.season, file: path.join(dir, file) })
    }
  }
  return found
}

const deployed = deployedTeamPayloads()

describe.skipIf(deployed.length === 0)('deployed team shot payloads', () => {
  it.each(deployed)('$tricode $season strict-parses and is coherent', ({ tricode, season, file }) => {
    const payload = parseTeamShotPayload(JSON.parse(readFileSync(file, 'utf-8')))
    expect(payload._meta.tricode.toLowerCase()).toBe(tricode)
    expect(payload._meta.season).toBe(season)
    // Every slice the surface renders aggregates without throwing: the
    // whole season, each shooter, each game.
    const metrics = aggregateShotMetrics(payload.shots, payload.zoneBaseline)
    expect(metrics.totalAttempts).toBe(payload._meta.totalShots)
    const games = new Set(payload.shots.map((s) => s.gameId))
    expect(games.size).toBe(payload._meta.gamesIncluded)
    for (const gameId of games) {
      const slice = payload.shots.filter((s) => s.gameId === gameId)
      expect(aggregateShotMetrics(slice, payload.zoneBaseline).totalAttempts).toBe(slice.length)
    }
  })
})
