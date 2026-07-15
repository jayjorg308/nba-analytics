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
