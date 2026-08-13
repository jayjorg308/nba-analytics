// Real-data coverage for the comparison aggregation (comparison plan,
// increment 1): the two motivating examples over the committed deployment
// copies. Skips cleanly on clones without synced files, per convention.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { aggregatePlayerComparison, aggregateSplitComparison } from './aggregateComparison'
import { parseDerivedPayload } from './payload'

const publicData = path.resolve(process.cwd(), 'public/data')
const mitchellPath = path.join(publicData, 'donovan-mitchell', '2025-26.json')
const brunsonPath = path.join(publicData, 'jalen-brunson', '2025-26.json')

const load = (p: string) => parseDerivedPayload(JSON.parse(readFileSync(p, 'utf-8')))

describe.skipIf(!existsSync(mitchellPath) || !existsSync(brunsonPath))(
  'player comparison over deployed payloads (Mitchell vs Brunson, 2025-26)',
  () => {
    it('shares one identical league baseline and builds both full-season sides', () => {
      const mitchell = load(mitchellPath)
      const brunson = load(brunsonPath)
      const m = aggregatePlayerComparison({
        season: '2025-26',
        left: { slug: 'donovan-mitchell', payload: mitchell },
        right: { slug: 'jalen-brunson', payload: brunson },
      })
      expect(m.baselineSeason).toBe('2025-26')
      // Each side is its payload's complete record, frontier included.
      expect(m.left.playerName).toBe('Donovan Mitchell')
      expect(m.left.shots).toBe(mitchell._meta.totalShots)
      expect(m.left.games).toBe(mitchell._meta.gamesIncluded)
      expect(m.left.endDate).toBe(mitchell._meta.dataThrough)
      expect(m.right.playerName).toBe('Jalen Brunson')
      expect(m.right.shots).toBe(brunson._meta.totalShots)
      expect(m.right.games).toBe(brunson._meta.gamesIncluded)
      expect(m.right.endDate).toBe(brunson._meta.dataThrough)
      // The decomposition identity holds on both sides (ADR-0016), so the
      // headline surface can show residuals with their raw anchors.
      for (const side of [m.left, m.right]) {
        const s = side.metrics.selection
        const mk = side.metrics.making
        expect(s.leagueDietExpectedPps + s.selectionDelta! + mk.makingPpsDelta!).toBeCloseTo(
          mk.actualPps!,
          12,
        )
      }
    })
  },
)

describe.skipIf(!existsSync(mitchellPath))(
  'within-season comparison over the deployed payload (Mitchell, split 2026-02-07)',
  () => {
    it('pins the committed partition: 48 games / 994 shots before, 22 / 409 since', () => {
      const payload = load(mitchellPath)
      const m = aggregateSplitComparison({
        slug: 'donovan-mitchell',
        season: '2025-26',
        splitDate: '2026-02-07',
        payload,
      })
      expect(m.left.games).toBe(48)
      expect(m.left.shots).toBe(994)
      expect(m.right.games).toBe(22)
      expect(m.right.shots).toBe(409)
      // Complete natural windows: the partition reproduces the season.
      expect(m.left.shots + m.right.shots).toBe(payload._meta.totalShots)
      expect(m.left.games + m.right.games).toBe(payload._meta.gamesIncluded)
      expect(m.right.endDate).toBe(payload._meta.dataThrough)
    })

    it('flags the since-window left corner as locally thin without vetoing anything', () => {
      const m = aggregateSplitComparison({
        slug: 'donovan-mitchell',
        season: '2025-26',
        splitDate: '2026-02-07',
        payload: load(mitchellPath),
      })
      const leftCorner = m.zones.find((r) => r.zone === 'Left Corner 3')!
      // 11 attempts since the split: below the 15-attempt selection bar, so
      // marked too thin — but the row stays, attempts visible (ADR-0075).
      expect(leftCorner.right.attempts).toBe(11)
      expect(leftCorner.right.included).toBe(false)
      expect(leftCorner.right.smallSampleMaking).toBe(true)
      expect(m.zones).toHaveLength(6)
    })
  },
)
