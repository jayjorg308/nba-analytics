// Registry coherence (ADR-0060): the invariants every consumer leans on —
// hero × seasons iteration, the canonical alias, unique permalinks — hold
// for every registered hero. canonicalSeasonOf throws at runtime; this
// makes the same breakage a named test failure at commit time.

import { describe, expect, it } from 'vitest'
import { HEROES } from './registry'

describe('hero registry coherence (ADR-0060)', () => {
  it('slugs are unique (each hero owns its /<slug> namespace)', () => {
    expect(new Set(HEROES.map((h) => h.slug)).size).toBe(HEROES.length)
  })

  for (const hero of HEROES) {
    it(`${hero.slug}: seasons are non-empty, unique, ordered, and contain the canonical season`, () => {
      expect(hero.seasons.length).toBeGreaterThan(0)
      expect(new Set(hero.seasons.map((s) => s.season)).size).toBe(hero.seasons.length)
      expect(hero.seasons.map((s) => s.season)).toContain(hero.canonicalSeason)
      // Oldest first — the convention the growth coda's prior-season lookup
      // and the growth aggregation's order gate both lean on (ADR-0061).
      const seasons = hero.seasons.map((s) => s.season)
      expect([...seasons].sort()).toEqual(seasons)
    })
  }
})
