// The authoring tripwire's one implementation (ADR-0063): pure functions
// returning problem lists, the lexicon's pattern — guards assert the list is
// empty, and nothing stops tooling from importing it. A season-argument
// scaffold emits every authored field as the sentinel below, and this module
// is what keeps that scaffold unmergeable: any remaining sentinel, or a
// referenced banner asset missing from public/, is a named problem — so an
// unauthored season argument, a forgotten photo, or a mistyped image path is
// a red suite, never a shipped page.
//
// Runs OUTSIDE the guards' payload skipIf on purpose: none of these checks
// need data, so they hold on clean clones and CI alike.

import { existsSync } from 'node:fs'
import path from 'node:path'
import type { HeroBannerConfig, HeroConfig, HeroSeasonConfig } from './types'

/** The scaffold placeholder marker (ADR-0063). Distinctive on purpose: a
 * bare 'TODO' could collide with legitimate prose; this string never can. */
export const SCAFFOLD_SENTINEL = 'TODO(scaffold)'

/** Sentinel problems: authored copy still carrying the scaffold marker.
 * Field-explicit rather than a generic object walk, so a problem names the
 * field a human must go author. Fully pure — no filesystem. */
export function sentinelProblems(hero: HeroConfig, seasonArgument: HeroSeasonConfig): string[] {
  const authored: [field: string, value: string | undefined][] = [
    ['thesis', hero.thesis],
    ['hero.imageAlt', hero.hero.imageAlt],
    ['hero.imagePath', hero.hero.imagePath],
    ['hero.teamLogoPath', hero.hero.teamLogoPath],
    ['hero.imagePosition', hero.hero.imagePosition],
    ['hero.imagePositionWide', hero.hero.imagePositionWide],
    [`seasons[${seasonArgument.season}].kicker`, seasonArgument.kicker],
    [`seasons[${seasonArgument.season}].verdict`, seasonArgument.verdict],
  ]
  return authored
    .filter(([, value]) => value !== undefined && value.includes(SCAFFOLD_SENTINEL))
    .map(([field]) => `${field} still contains ${SCAFFOLD_SENTINEL}`)
}

/** Asset problems: banner files the config references but public/ lacks —
 * the "broken banner, green suite" hole, closed (ADR-0063). Existence is
 * checked from the repo root (process.cwd(), where vitest runs), the same
 * resolution every guard already uses for payload paths. */
export function assetProblems(
  banner: HeroBannerConfig,
  fileExists: (absolutePath: string) => boolean = existsSync,
): string[] {
  const problems: string[] = []
  const referenced: [field: string, publicRelative: string | undefined][] = [
    ['hero.imagePath', banner.imagePath],
    ['hero.teamLogoPath', banner.teamLogoPath],
  ]
  for (const [field, publicRelative] of referenced) {
    if (publicRelative === undefined || publicRelative.includes(SCAFFOLD_SENTINEL)) continue
    const absolute = path.resolve(process.cwd(), 'public', publicRelative)
    if (!fileExists(absolute)) {
      problems.push(`${field} references public/${publicRelative}, which does not exist`)
    }
  }
  return problems
}

/** The full authoring tripwire: every problem keeping this season argument
 * from being complete. Guards assert this equals []. */
export function authoringProblems(
  hero: HeroConfig,
  seasonArgument: HeroSeasonConfig,
  fileExists: (absolutePath: string) => boolean = existsSync,
): string[] {
  return [...sentinelProblems(hero, seasonArgument), ...assetProblems(hero.hero, fileExists)]
}
