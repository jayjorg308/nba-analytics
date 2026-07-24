// Unit tests for the authoring tripwire's one implementation (ADR-0063):
// sentinel detection is pure, asset existence takes an injectable exists so
// the missing-file paths are deterministic, and a closing sweep proves every
// registered hero × season passes against the real filesystem — the same
// call each per-season guard makes.

import { describe, expect, it } from 'vitest'
import { assetProblems, authoringProblems, SCAFFOLD_SENTINEL, sentinelProblems } from './authoring'
import { HEROES } from './registry'
import type { HeroConfig } from './types'

const authored: HeroConfig = {
  slug: 'test-hero',
  playerName: 'Test Hero',
  thesis: 'Is Test Hero taking good shots?',
  hero: {
    imagePath: 'img/test-hero-hero.jpg',
    imageAlt: 'Test Hero rises for a jumper',
    imagePosition: '50% 30%',
    imagePositionWide: '50% 20%',
  },
  canonicalSeason: '2025-26',
  seasons: [{ season: '2025-26', kicker: 'Test Hero · 2025-26', verdict: 'No.' }],
}

const season = authored.seasons[0]!

describe('sentinelProblems', () => {
  it('passes fully authored copy', () => {
    expect(sentinelProblems(authored, season)).toEqual([])
  })

  it('names each field still carrying the sentinel', () => {
    const scaffolded: HeroConfig = {
      ...authored,
      hero: { ...authored.hero, imagePosition: SCAFFOLD_SENTINEL },
      seasons: [{ ...season, verdict: `${SCAFFOLD_SENTINEL}: author from hero:report` }],
    }
    const problems = sentinelProblems(scaffolded, scaffolded.seasons[0]!)
    expect(problems).toHaveLength(2)
    expect(problems.some((p) => p.includes('hero.imagePosition'))).toBe(true)
    expect(problems.some((p) => p.includes('seasons[2025-26].verdict'))).toBe(true)
  })

  it('ignores the optional teamLogoPath when absent', () => {
    expect(authored.hero.teamLogoPath).toBeUndefined()
    expect(sentinelProblems(authored, season)).toEqual([])
  })
})

describe('assetProblems', () => {
  it('reports a referenced banner image missing from public/', () => {
    const problems = assetProblems(authored.hero, () => false)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('public/img/test-hero-hero.jpg')
  })

  it('passes when every referenced asset exists', () => {
    expect(assetProblems(authored.hero, () => true)).toEqual([])
  })

  it('checks teamLogoPath only when the config references one', () => {
    const withLogo = { ...authored.hero, teamLogoPath: 'img/test-logo.png' }
    const problems = assetProblems(withLogo, (p) => !p.includes('test-logo'))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('public/img/test-logo.png')
  })

  it('leaves a sentinel-valued path to the sentinel check', () => {
    const scaffolded = { ...authored.hero, imagePath: SCAFFOLD_SENTINEL }
    expect(assetProblems(scaffolded, () => false)).toEqual([])
  })
})

describe('authoringProblems', () => {
  it('concatenates sentinel and asset problems', () => {
    const scaffolded: HeroConfig = {
      ...authored,
      seasons: [{ ...season, kicker: `Test Hero · ${SCAFFOLD_SENTINEL} · 2025-26` }],
    }
    const problems = authoringProblems(scaffolded, scaffolded.seasons[0]!, () => false)
    expect(problems).toHaveLength(2)
    expect(problems.some((p) => p.includes('kicker'))).toBe(true)
    expect(problems.some((p) => p.includes('test-hero-hero.jpg'))).toBe(true)
  })

  // The default-existsSync path, proven against reality: every registered
  // hero × season is authoring-complete — the same call each per-season
  // guard makes (ADR-0063).
  for (const hero of HEROES) {
    for (const seasonArgument of hero.seasons) {
      it(`${hero.slug} ${seasonArgument.season}: authoring-complete`, () => {
        expect(authoringProblems(hero, seasonArgument)).toEqual([])
      })
    }
  }
})
