// Planner tests (ADR-0063): mode selection, the never-overwrite refusals,
// and the file sets each mode emits — over fake state plus the real
// registry source where realism is free.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { emitHeroModule, registerHero } from './emit'
import { planScaffold } from './plan'

const id = { slug: 'test-hero', season: '2026-27', playerName: 'Test Hero' }
const registrySource = readFileSync('src/heroes/registry.ts', 'utf-8')

const cleanState = {
  moduleSource: null,
  registrySource,
  guardFileExists: false,
}

describe('planScaffold validation', () => {
  it('rejects a non-kebab slug', () => {
    expect(() => planScaffold({ ...id, slug: 'Test_Hero' }, cleanState)).toThrow(/invalid slug/)
  })

  it('rejects a malformed season', () => {
    expect(() => planScaffold({ ...id, season: '2026' }, cleanState)).toThrow(/invalid season/)
  })

  it('refuses to overwrite an existing guard file', () => {
    expect(() => planScaffold(id, { ...cleanState, guardFileExists: true })).toThrow(
      /never overwrites/,
    )
  })
})

describe('new-hero mode', () => {
  const plan = planScaffold(id, cleanState)

  it('creates the module and guard, and rewrites the registry', () => {
    expect(plan.mode).toBe('new-hero')
    expect(plan.files.map((f) => [f.path, f.action])).toEqual([
      ['src/heroes/test-hero.ts', 'create'],
      ['src/heroes/test-hero.2026-27.guard.test.ts', 'create'],
      ['src/heroes/registry.ts', 'rewrite'],
    ])
  })

  it('registers eagerly: the rewritten registry carries the new hero', () => {
    const registry = plan.files.find((f) => f.path === 'src/heroes/registry.ts')!
    expect(registry.content).toContain("import { testHero } from './test-hero'")
    expect(registry.content).toMatch(/ {2}testHero,\r?\n\]/)
  })
})

describe('append-season mode', () => {
  const existingModule = emitHeroModule({ ...id, season: '2025-26' })
  const registeredSource = registerHero(registrySource, id)

  it('rewrites the module with both seasons and creates only the new guard', () => {
    const plan = planScaffold(id, {
      moduleSource: existingModule,
      registrySource: registeredSource,
      guardFileExists: false,
    })
    expect(plan.mode).toBe('append-season')
    expect(plan.files.map((f) => [f.path, f.action])).toEqual([
      ['src/heroes/test-hero.ts', 'rewrite'],
      ['src/heroes/test-hero.2026-27.guard.test.ts', 'create'],
    ])
    const rewritten = plan.files[0]!.content
    expect(rewritten).toContain("season: '2025-26',")
    expect(rewritten).toContain("season: '2026-27',")
  })

  it('heals a dead module: an unregistered existing hero gets registered too', () => {
    const plan = planScaffold(id, {
      moduleSource: existingModule,
      registrySource,
      guardFileExists: false,
    })
    expect(plan.files.some((f) => f.path === 'src/heroes/registry.ts')).toBe(true)
  })

  it('propagates the already-argued refusal', () => {
    expect(() =>
      planScaffold(
        { ...id, season: '2025-26' },
        { moduleSource: existingModule, registrySource: registeredSource, guardFileExists: false },
      ),
    ).toThrow(/already argues/)
  })
})
