// The compile-proof (ADR-0063): emitted modules are written to a temp dir
// and dynamically imported — vitest's transform compiles them, so this
// proves the generated source is real TypeScript producing a coherent
// HeroConfig, without a byte-golden. (Hero modules have no runtime imports;
// their type-only `import type` line is erased at transform, so they load
// from anywhere.) The guard skeleton is covered structurally in
// emit.test.ts — its real execution happens the moment a scaffold lands.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { authoringProblems, SCAFFOLD_SENTINEL } from '../heroes/authoring'
import { seasonArgumentOf, type HeroConfig } from '../heroes/types'
import { appendSeasonEntry, emitHeroModule, heroExportName } from './emit'

const tmp = mkdtempSync(join('tests', 'scaffold-tmp-'))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

async function importEmitted(fileName: string, source: string): Promise<Record<string, HeroConfig>> {
  const file = join(tmp, fileName)
  writeFileSync(file, source, 'utf-8')
  return (await import(/* @vite-ignore */ pathToFileURL(file).href)) as Record<string, HeroConfig>
}

const id = { slug: 'test-hero', season: '2026-27', playerName: 'Test Hero' }

describe('emitted hero module', () => {
  it('compiles and yields a coherent HeroConfig (the registry invariants)', async () => {
    const mod = await importEmitted('new-hero.ts', emitHeroModule(id))
    const hero = mod[heroExportName(id.slug)]!
    expect(hero.slug).toBe('test-hero')
    expect(hero.playerName).toBe('Test Hero')
    expect(hero.thesis).toBe('Is Test Hero taking good shots?')
    // The registry-coherence invariants (registry.test.ts), applied here:
    expect(hero.seasons.length).toBeGreaterThan(0)
    expect(new Set(hero.seasons.map((s) => s.season)).size).toBe(hero.seasons.length)
    expect(hero.seasons.map((s) => s.season)).toContain(hero.canonicalSeason)
    expect(seasonArgumentOf(hero, '2026-27').season).toBe('2026-27')
  })

  it('is exactly what the authoring tripwire rejects: five sentinels and the missing assets', async () => {
    const mod = await importEmitted('tripwire.ts', emitHeroModule(id))
    const hero = mod[heroExportName(id.slug)]!
    const problems = authoringProblems(hero, hero.seasons[0]!)
    // Sentinels: imageAlt, both focal points, kicker, verdict — plus the
    // conventional banner and headshot paths, which cannot exist yet.
    expect(problems).toHaveLength(7)
    for (const field of [
      'hero.imageAlt',
      'hero.imagePosition',
      'hero.imagePositionWide',
      'kicker',
      'verdict',
    ]) {
      expect(problems.some((p) => p.includes(field) && p.includes(SCAFFOLD_SENTINEL))).toBe(true)
    }
    expect(problems.some((p) => p.includes('public/img/test-hero-hero.jpg'))).toBe(true)
    expect(problems.some((p) => p.includes('public/img/test-hero-headshot.png'))).toBe(true)
  })
})

describe('append mode over the real ace module', () => {
  it('compiles with both season arguments and the canonical pointer unmoved', async () => {
    const aceSource = readFileSync('src/heroes/ace-bailey.ts', 'utf-8')
    const appended = appendSeasonEntry(aceSource, {
      slug: 'ace-bailey',
      season: '2026-27',
      playerName: 'Ace Bailey',
    })
    const mod = await importEmitted('ace-appended.ts', appended)
    const hero = mod['aceBailey']!
    expect(hero.seasons.map((s) => s.season)).toEqual(['2025-26', '2026-27'])
    expect(hero.canonicalSeason).toBe('2025-26')
    // The frozen argument survives verbatim; the new one is a scaffold.
    expect(seasonArgumentOf(hero, '2025-26').verdict).not.toContain(SCAFFOLD_SENTINEL)
    expect(seasonArgumentOf(hero, '2026-27').verdict).toContain(SCAFFOLD_SENTINEL)
  })
})
