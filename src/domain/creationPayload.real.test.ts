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

// Every hero's expected tracking shortfall, pinned (ADR-0030 as amended):
// a shortfall CHANGING between pulls is as loud as one appearing. The only
// nonzero entry is Ace Bailey's — two characterized outage games
// (2025-12-07 partial, 2026-03-05 league-wide meltdown; 3 + 5 attempts).
// A new hero-season starts at 0 and earns an entry here only from a
// characterized outage, never from "the derive said so".
const EXPECTED_TRACKING_SHORTFALL: Record<string, number> = {
  'ace-bailey/2025-26': 8,
}

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
        // The ADR-0030 identity at deployed grain: General plus the
        // reported shortfall covers the pre-drop season exactly (the schema
        // pins Σ general.player.fga to seasonFga − trackingShortfall; this
        // ties seasonFga to the sibling's truth).
        expect(creation._meta.seasonFga).toBe(
          shot._meta.totalShots + shot._meta.zoneConflictsDropped,
        )
        // The shortfall is pinned per hero-season — 0 unless a characterized
        // outage earned an entry in the map above.
        expect(creation._meta.trackingShortfall).toBe(
          EXPECTED_TRACKING_SHORTFALL[`${slug}/${season}`] ?? 0,
        )
        // Four-way frontier equality (ADR-0058): a one-sided hero:sync now
        // fails visibly as a frontier mismatch.
        expect(creation._meta.dataThrough).toBe(shot._meta.dataThrough)
        expect(creation._meta.gamesIncluded).toBe(shot._meta.gamesIncluded)
      })

      it('aggregates without flags on the product grains (the rollups earn their keep)', () => {
        const creation = parseCreationPayload(
          JSON.parse(readFileSync(creationPath, 'utf-8')),
        )
        const m = aggregateCreationMetrics(creation)
        // The product grains were chosen (ADR-0030 / v2.1) because they
        // clear the small-sample bar for both current heroes — the NBA's
        // finer bands do not.
        for (const band of [...m.shotClock, ...m.closestDefender]) {
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
    const inside = m.general.inside
    expect(inside.attemptShare).toBeCloseTo(0.5540, 4)
    expect(inside.leagueAttemptShare).toBeCloseTo(0.4257, 4)
    expect(inside.pps).toBeCloseTo(1.1844, 4) // dead on league (1.1864)
    expect(inside.leaguePps).toBeCloseTo(1.1864, 4)

    // The jumper parent states his jump shooting in one line: 227 attempts
    // at 0.749 PPS against a 1.021 league jumper baseline — the whole
    // making story, at a grain far clear of the small-sample bar.
    const jumpers = m.general.jumpers
    expect(jumpers.attempts).toBe(227)
    expect(jumpers.attemptShare).toBeCloseTo(0.4460, 4)
    expect(jumpers.leagueAttemptShare).toBeCloseTo(0.5743, 4)
    expect(jumpers.pps).toBeCloseTo(0.7489, 4)
    expect(jumpers.leaguePps).toBeCloseTo(1.0208, 4)
    expect(jumpers.smallSamplePps).toBe(false)

    // Catch-and-shoot is where the making collapse lives: 0.711 PPS on the
    // league's most efficient jumper context (1.100), on 121 attempts —
    // clear of the small-sample bar, so the claim can be stated unflagged.
    const cs = m.general.jumperContexts.find((r) => r.context === 'Catch and Shoot')!
    expect(cs.attempts).toBe(121)
    expect(cs.pps).toBeCloseTo(0.7107, 4)
    expect(cs.leaguePps).toBeCloseTo(1.1003, 4)
    expect(cs.smallSamplePps).toBe(false)

    // ...and it is nearly his WHOLE three-point story: 117 of his 131
    // threes arrive off the catch (89.3%; league 72.1%) — "cold from three"
    // means missing open, off-the-catch looks, not self-created difficulty.
    const cs3 = m.general.catchAndShootThrees
    expect(cs3.attempts).toBe(117)
    expect(cs3.totalThrees).toBe(131)
    expect(cs3.share).toBeCloseTo(0.8931, 4)
    expect(cs3.leagueShare).toBeCloseTo(0.7209, 4)

    // The product-grain clock bands (195/243/71) all clear the bar; the
    // late-clock cost is real but modest volume.
    expect(m.shotClock.map((b) => b.attempts)).toEqual([195, 243, 71])
    const late = m.shotClock.find((b) => b.band === 'Late')!
    expect(late.pps).toBeCloseTo(0.5352, 4)
    expect(late.leaguePps).toBeCloseTo(0.9414, 4)

    // The defender family (v2.1) measures "open" directly: on 117 wide-open
    // attempts he produces 0.880 against a league 1.178 — while his tight
    // and open bands sit near league. Being left alone is where the value
    // leaks, which corroborates the catch-and-shoot story from independent
    // tracking data.
    expect(m.defenderUnattributed).toBe(0)
    expect(m.closestDefender.map((b) => b.attempts)).toEqual([257, 135, 117])
    const wideOpen = m.closestDefender.find((b) => b.band === 'Wide open')!
    expect(wideOpen.pps).toBeCloseTo(0.8803, 4)
    expect(wideOpen.leaguePps).toBeCloseTo(1.1778, 4)
    const tight = m.closestDefender.find((b) => b.band === 'Tight')!
    expect(tight.pps).toBeCloseTo(1.0545, 4)
    expect(tight.leaguePps).toBeCloseTo(1.0563, 4)
  })
})
