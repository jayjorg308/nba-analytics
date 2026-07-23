// Guards the committed free-throw deployment copies (public/data/) — the
// ADR-0053 contract at the deployed grain: every deployed free-throw payload
// must strict-parse, agree with its SIBLING shot payload on the pre-drop
// season FGA and on every and-one shot identity (a one-sided hero:sync
// cannot quietly ship contradictory payloads), and match the latest derived
// copy when the gitignored data/ layer is present (dev machines). Skips
// cleanly on clones without synced files.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { HEROES } from '../heroes/registry'
import { aggregateFreethrowMetrics } from './aggregateFreethrow'
import { parseFreethrowPayload } from './freethrowPayload'
import { parseDerivedPayload } from './payload'

const publicData = path.resolve(process.cwd(), 'public/data')

// Every deployed free-throw payload, whether or not its hero is registered
// (an unregistered hero's committed payloads stay guarded — the
// TEMPORARY(single-hero) stance).
function deployedFreethrowPairs(): { slug: string; season: string }[] {
  if (!existsSync(publicData)) return []
  const pairs: { slug: string; season: string }[] = []
  for (const slug of readdirSync(publicData)) {
    const dir = path.join(publicData, slug)
    for (const file of readdirSync(dir)) {
      const m = /^(?<season>\d{4}-\d{2})\.freethrow\.json$/.exec(file)
      if (m?.groups) pairs.push({ slug, season: m.groups.season })
    }
  }
  return pairs
}

describe('deployed free-throw payloads', () => {
  it('exist for every registered hero (required — ADR-0053)', () => {
    for (const hero of HEROES) {
      const p = path.join(publicData, hero.slug, `${hero.season}.freethrow.json`)
      // A registered hero without a synced free-throw payload is a broken
      // deploy, not a lesser page: run derive_freethrow + hero:sync.
      expect(existsSync(p), `missing ${p}`).toBe(true)
    }
  })

  for (const { slug, season } of deployedFreethrowPairs()) {
    describe(`${slug} ${season}`, () => {
      const freethrowPath = path.join(publicData, slug, `${season}.freethrow.json`)
      const shotPath = path.join(publicData, slug, `${season}.json`)

      it('strict-parses and reconciles with its sibling shot payload', () => {
        const freethrow = parseFreethrowPayload(
          JSON.parse(readFileSync(freethrowPath, 'utf-8')),
        )
        // The sibling must exist — a free-throw payload with no shot payload
        // has nothing to reconcile against.
        expect(existsSync(shotPath), `missing sibling ${shotPath}`).toBe(true)
        const shot = parseDerivedPayload(JSON.parse(readFileSync(shotPath, 'utf-8')))

        expect(freethrow._meta.player).toBe(shot._meta.player)
        expect(freethrow._meta.playerId).toBe(shot._meta.playerId)
        expect(freethrow._meta.season).toBe(shot._meta.season)
        // The ADR-0055 identity at deployed grain: the FTA-rate denominator
        // is the sibling's pre-drop season FGA — external totals know
        // nothing of our ADR-0019 drops.
        expect(freethrow._meta.seasonFga).toBe(
          shot._meta.totalShots + shot._meta.zoneConflictsDropped,
        )
        // Gate 5's corpus completeness at deployed grain (ADR-0054): every
        // expected game loaded — a shortfall means the season could hide
        // free throws the corpus never saw.
        expect(freethrow._meta.gamesLoaded).toBe(freethrow._meta.gamesExpected)
        // Four-way frontier equality (ADR-0058): a one-sided hero:sync now
        // fails visibly as a frontier mismatch.
        expect(freethrow._meta.dataThrough).toBe(shot._meta.dataThrough)
        expect(freethrow._meta.gamesIncluded).toBe(shot._meta.gamesIncluded)
      })

      it('links every and-one trip to a made shot in the sibling payload (ADR-0053)', () => {
        const freethrow = parseFreethrowPayload(
          JSON.parse(readFileSync(freethrowPath, 'utf-8')),
        )
        const shot = parseDerivedPayload(JSON.parse(readFileSync(shotPath, 'utf-8')))
        const madeByIdentity = new Set(
          shot.shots.filter((s) => s.made).map((s) => `${s.gameId}:${s.gameEventId}`),
        )
        // Exact join, never nearest-event (ADR-0036): the and-one is the one
        // trip class with a shot identity, and it must resolve to a MADE
        // shot — the derive validated this in Python; the deployed pair must
        // still agree after any one-sided sync.
        for (const trip of freethrow.trips) {
          if (trip.tripClass !== 'andOne') continue
          expect(
            madeByIdentity.has(`${trip.gameId}:${trip.shotId}`),
            `and-one ${trip.gameId}:${trip.shotId} has no made sibling shot`,
          ).toBe(true)
        }
      })

      it('aggregates with coherent tiers (the taxonomy partitions the trips)', () => {
        const freethrow = parseFreethrowPayload(
          JSON.parse(readFileSync(freethrowPath, 'utf-8')),
        )
        const m = aggregateFreethrowMetrics(freethrow)
        // The two tiers partition the trips exactly (ADR-0053) — counts
        // summed, never rates averaged, so the rollup must reassemble.
        expect(m.attemptEquivalent.trips + m.addOn.trips).toBe(freethrow._meta.totalTrips)
        expect(m.attemptEquivalent.fta + m.addOn.fta).toBe(
          freethrow._meta.seasonFta - freethrow._meta.technicalFta,
        )
        expect(m.attemptEquivalent.ftm + m.addOn.ftm).toBe(
          freethrow._meta.seasonFtm - freethrow._meta.technicalFtm,
        )
      })

      it('matches the latest derived free-throw payload when data/ is present', () => {
        const derivedDir = path.resolve(
          process.cwd(),
          'data/derived',
          slug,
          season,
          'freethrow',
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
        const deployed: unknown = JSON.parse(readFileSync(freethrowPath, 'utf-8'))
        // out of sync -> run `npm run hero:sync`
        expect(deployed).toEqual(derived)
      })
    })
  }
})
