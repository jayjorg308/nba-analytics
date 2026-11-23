// Structural tests for the emit core (ADR-0063): the invariants that matter
// (sentinels present, season pinned, anchors respected, never-overwrite
// throws) — deliberately no byte-golden of generated code; the repo gate
// verifies every real scaffold when it lands.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SCAFFOLD_SENTINEL } from '../heroes/authoring'
import {
  appendSeasonEntry,
  emitGuardFile,
  emitHeroModule,
  heroExportName,
  registerHero,
} from './emit'

const id = { slug: 'test-hero', season: '2026-27', playerName: 'Test Hero' }

describe('heroExportName', () => {
  it('camel-cases kebab slugs', () => {
    expect(heroExportName('cody-williams')).toBe('codyWilliams')
    expect(heroExportName('shai-gilgeous-alexander')).toBe('shaiGilgeousAlexander')
    expect(heroExportName('ace')).toBe('ace')
  })
})

describe('emitHeroModule', () => {
  const source = emitHeroModule(id)

  it('fills every mechanical field with its real value', () => {
    expect(source).toContain(`export const testHero: HeroConfig = {`)
    expect(source).toContain(`slug: 'test-hero',`)
    expect(source).toContain(`playerName: 'Test Hero',`)
    expect(source).toContain(`thesis: 'Is Test Hero taking good shots?',`)
    expect(source).toContain(`imagePath: 'img/test-hero-hero.jpg',`)
    expect(source).toContain(`headshotPath: 'img/test-hero-headshot.png',`)
    expect(source).toContain(`canonicalSeason: '2026-27',`)
    expect(source).toContain(`season: '2026-27',`)
  })

  it('sentinels every authored field: alt, both focal points, kicker (team + jersey), verdict', () => {
    const uncommented = source
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//'))
      .join('\n')
    const count = uncommented.split(SCAFFOLD_SENTINEL).length - 1
    expect(count).toBe(6)
  })

  it('leaves the optional team logo as a commented affordance, never a live field', () => {
    expect(source).toContain(`// teamLogoPath:`)
    expect(source).not.toMatch(/^\s*teamLogoPath:/m)
  })

  it('leaves the optional image credit commented, so an unknown credit stays pending', () => {
    // Emitting a live sentinel here would red the tripwire over a credit
    // that may be genuinely unrecoverable; absent renders the honest
    // "photograph credit pending" line instead (ADR-0071).
    expect(source).toContain(`// imageCredit:`)
    expect(source).not.toMatch(/^\s*imageCredit:/m)
  })

  it('escapes player names with apostrophes into valid string literals', () => {
    const escaped = emitHeroModule({ ...id, playerName: "De'Aaron Test" })
    expect(escaped).toContain("playerName: 'De\\'Aaron Test',")
    expect(escaped).toContain("thesis: 'Is De\\'Aaron Test taking good shots?',")
  })
})

describe('emitGuardFile', () => {
  const source = emitGuardFile(id)

  it('pins the guarded season explicitly and imports the hero module', () => {
    expect(source).toContain(`const seasonConfig = seasonArgumentOf(hero, '2026-27')`)
    expect(source).toContain(`import { testHero as hero } from './test-hero'`)
  })

  it('declares empty claim arrays for every shipped claim family', () => {
    expect(source).toContain('const shotClaims: ShotClaim[] = []')
    expect(source).toContain('const creationClaims: CreationClaim[] = []')
    expect(source).toContain('const freethrowClaims: FreethrowClaim[] = []')
  })

  it('carries the universal lexicon tripwire verbatim', () => {
    expect(source).toContain('unshippedTermsIn(seasonConfig.verdict)')
    expect(source).toContain('unbackedCreationTerms(seasonConfig.verdict, creationClaims.length)')
    expect(source).toContain('unbackedFreethrowTerms(seasonConfig.verdict, freethrowClaims.length)')
    // Growth graduated off the unshipped list (ADR-0061, 2026-11-23): a new
    // guard holds growth vocabulary at zero until it declares growth claims.
    expect(source).toContain('unbackedGrowthTerms(seasonConfig.verdict, 0)')
    expect(source).toContain('unbackedAssistTerms(seasonConfig.verdict, 0)')
    expect(source).toContain('invalidAssistInterpretationsIn(seasonConfig.verdict)')
  })

  it('runs the authoring tripwire outside the payload skipIf', () => {
    const skipIfAt = source.indexOf('describe.skipIf(')
    const tripwireAt = source.indexOf("describe('authoring completeness (ADR-0063)'")
    expect(skipIfAt).toBeGreaterThan(-1)
    expect(tripwireAt).toBeGreaterThan(skipIfAt)
    expect(source).toContain('expect(authoringProblems(hero, seasonConfig)).toEqual([])')
  })

  it('contains no directional assertions, only the scaffold TODOs', () => {
    expect(source).toContain(SCAFFOLD_SENTINEL)
    expect(source).not.toContain('toBeGreaterThanOrEqual')
    expect(source).not.toContain('toBeLessThanOrEqual')
  })
})

describe('appendSeasonEntry (against the real ace module)', () => {
  const aceSource = readFileSync('src/heroes/ace-bailey.ts', 'utf-8')
  // The real module moves with every flip (2026-27 appended and made
  // canonical 2026-11-23), so the fixture reads its own state: the season
  // appended is the one after the module's latest, and the pointer is
  // whatever the module says now.
  const argued = [...aceSource.matchAll(/^\s*season: '(\d{4})-\d{2}',/gm)].map((m) => Number(m[1]))
  const last = Math.max(...argued)
  const lastSeason = `${last}-${String((last + 1) % 100).padStart(2, '0')}`
  const next = `${last + 1}-${String((last + 2) % 100).padStart(2, '0')}`
  const canonical = /canonicalSeason: '([^']+)'/.exec(aceSource)![1]
  const aceId = { slug: 'ace-bailey', season: next, playerName: 'Ace Bailey' }

  it('inserts the new entry inside seasons[], leaving the frozen argument and pointer alone', () => {
    const appended = appendSeasonEntry(aceSource, aceId)
    expect(appended).toContain(`season: '${lastSeason}',`)
    expect(appended).toContain(`season: '${next}',`)
    // The new entry lands before the seasons[] close, after the latest one.
    expect(appended.indexOf(`season: '${next}',`)).toBeGreaterThan(
      appended.indexOf(`season: '${lastSeason}',`),
    )
    // The flip's human step stays human: canonicalSeason is untouched.
    expect(appended).toContain(`canonicalSeason: '${canonical}',`)
    expect(appended).not.toContain(`canonicalSeason: '${next}'`)
  })

  it('refuses a season the hero already argues', () => {
    expect(() => appendSeasonEntry(aceSource, { ...aceId, season: '2025-26' })).toThrow(
      /already argues 2025-26/,
    )
  })

  it('fails loudly on an unrecognizable module shape', () => {
    expect(() => appendSeasonEntry('export const nope = 1\n', aceId)).toThrow(/anchor/)
  })
})

describe('registerHero (against the real registry)', () => {
  const registrySource = readFileSync('src/heroes/registry.ts', 'utf-8')

  it('adds the import before the types import and appends the HEROES entry', () => {
    const rewritten = registerHero(registrySource, id)
    const importAt = rewritten.indexOf("import { testHero } from './test-hero'")
    const typesAt = rewritten.indexOf("import type { HeroConfig } from './types'")
    expect(importAt).toBeGreaterThan(-1)
    expect(importAt).toBeLessThan(typesAt)
    // Appended at the end: after the last existing hero, before the close.
    expect(rewritten).toMatch(/ {2}testHero,\r?\n\]/)
    expect(rewritten.indexOf('  testHero,')).toBeGreaterThan(rewritten.indexOf('aceBailey,'))
  })

  it('refuses a slug that is already registered', () => {
    expect(() =>
      registerHero(registrySource, { ...id, slug: 'cody-williams' }),
    ).toThrow(/already registered/)
  })
})
