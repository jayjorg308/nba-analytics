// Guards the committed creation deployment copies (public/data/) — the
// ADR-0030 reconciliation, at the deployed grain: every deployed creation
// payload must strict-parse, agree with its SIBLING shot payload on the
// pre-drop season total (a one-sided hero:sync cannot quietly ship
// contradictory payloads), and match the latest derived copy when the
// gitignored data/ layer is present (dev machines). Skips cleanly on clones
// without synced files.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { HEROES } from '../heroes/registry'
import { aggregateCreationMetrics } from './aggregateCreation'
import { parseCreationPayload } from './creationPayload'
import { parseDerivedPayload } from './payload'

const publicData = path.resolve(process.cwd(), 'public/data')

// Every deployed creation payload, whether or not its hero is registered
// (an unregistered hero's committed payloads stay guarded — the
// TEMPORARY(single-hero) stance).
function deployedCreationPairs(): { slug: string; season: string }[] {
  if (!existsSync(publicData)) return []
  const pairs: { slug: string; season: string }[] = []
  for (const slug of readdirSync(publicData)) {
    const dir = path.join(publicData, slug)
    for (const file of readdirSync(dir)) {
      const m = /^(?<season>\d{4}-\d{2})\.creation\.json$/.exec(file)
      if (m?.groups) pairs.push({ slug, season: m.groups.season })
    }
  }
  return pairs
}

describe('deployed creation payloads', () => {
  it('exist for every registered hero (required — ADR-0030)', () => {
    for (const hero of HEROES) {
      const p = path.join(publicData, hero.slug, `${hero.season}.creation.json`)
      // A registered hero without a synced creation payload is a broken
      // deploy, not a lesser page: run derive_creation + hero:sync.
      expect(existsSync(p), `missing ${p}`).toBe(true)
    }
  })

  for (const { slug, season } of deployedCreationPairs()) {
    describe(`${slug} ${season}`, () => {
      const creationPath = path.join(publicData, slug, `${season}.creation.json`)
      const shotPath = path.join(publicData, slug, `${season}.json`)

      it('strict-parses and reconciles with its sibling shot payload', () => {
        const creation = parseCreationPayload(
          JSON.parse(readFileSync(creationPath, 'utf-8')),
        )
        // The sibling must exist — a creation payload with no shot payload
        // has nothing to reconcile against.
        expect(existsSync(shotPath), `missing sibling ${shotPath}`).toBe(true)
        const shot = parseDerivedPayload(JSON.parse(readFileSync(shotPath, 'utf-8')))

        expect(creation._meta.player).toBe(shot._meta.player)
        expect(creation._meta.season).toBe(shot._meta.season)
        // The ADR-0030 identity at deployed grain: General partitions the
        // pre-drop season exactly (schema already pins Σ general.player.fga
        // to seasonFga; this ties seasonFga to the sibling's truth).
        expect(creation._meta.seasonFga).toBe(
          shot._meta.totalShots + shot._meta.zoneConflictsDropped,
        )
      })

      it('aggregates without flags on the clock product grain (the rollup earns its keep)', () => {
        const creation = parseCreationPayload(
          JSON.parse(readFileSync(creationPath, 'utf-8')),
        )
        const m = aggregateCreationMetrics(creation)
        // The three-band grain was chosen (ADR-0030) because it clears the
        // small-sample bar for both current heroes — the six NBA bands do not.
        for (const band of m.shotClock) {
          expect(band.smallSamplePps, `${band.band} flagged`).toBe(false)
        }
      })

      it('matches the latest derived creation payload when data/ is present', () => {
        const derivedDir = path.resolve(
          process.cwd(),
          'data/derived',
          slug,
          season,
          'creation',
        )
        if (!existsSync(derivedDir)) return
        const latest = readdirSync(derivedDir)
          .filter((f) => f.endsWith('.json'))
          .sort()
          .at(-1)
        if (!latest) return
        const derived: unknown = JSON.parse(
          readFileSync(path.join(derivedDir, latest), 'utf-8'),
        )
        const deployed: unknown = JSON.parse(readFileSync(creationPath, 'utf-8'))
        // out of sync -> run `npm run hero:sync`
        expect(deployed).toEqual(derived)
      })
    })
  }
})

// The launch hero's creation anchors — the numbers the v2 why-sentence will
// state, locked through the aggregation path (mirrors realPayload.test.ts's
// verdict-grain anchors). Values from the 2026-07-15 spike, exact.
const codyCreationPath = path.join(publicData, 'cody-williams', '2025-26.creation.json')

describe.skipIf(!existsSync(codyCreationPath))('creation anchors (launch hero)', () => {
  it('anchors the creation story: rim-heavy diet, catch-and-shoot collapse, late-clock cost', () => {
    const m = aggregateCreationMetrics(
      parseCreationPayload(JSON.parse(readFileSync(codyCreationPath, 'utf-8'))),
    )
    expect(m.seasonFga).toBe(509)
    expect(m.shotClockUnattributed).toBe(0)

    // More than half his diet arrives inside 10 ft (league: ~43%) — the
    // creation mechanism behind v1's rim-heavy zone story.
    const lt10 = m.general.find((r) => r.context === 'Less than 10 ft')!
    expect(lt10.attemptShare).toBeCloseTo(0.5540, 4)
    expect(lt10.leagueAttemptShare).toBeCloseTo(0.4257, 4)
    expect(lt10.pps).toBeCloseTo(1.1844, 4) // dead on league (1.1864)
    expect(lt10.leaguePps).toBeCloseTo(1.1864, 4)

    // Catch-and-shoot is where the making collapse lives: 0.711 PPS on the
    // league's most efficient jumper context (1.100), on 121 attempts —
    // clear of the small-sample bar, so the claim can be stated unflagged.
    const cs = m.general.find((r) => r.context === 'Catch and Shoot')!
    expect(cs.attempts).toBe(121)
    expect(cs.pps).toBeCloseTo(0.7107, 4)
    expect(cs.leaguePps).toBeCloseTo(1.1003, 4)
    expect(cs.smallSamplePps).toBe(false)

    // The product-grain clock bands (195/243/71) all clear the bar; the
    // late-clock cost is real but modest volume.
    expect(m.shotClock.map((b) => b.attempts)).toEqual([195, 243, 71])
    const late = m.shotClock.find((b) => b.band === 'Late')!
    expect(late.pps).toBeCloseTo(0.5352, 4)
    expect(late.leaguePps).toBeCloseTo(0.9414, 4)
  })
})
