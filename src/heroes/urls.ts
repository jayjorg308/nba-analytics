// App-layer URL derivation for registry entries. This is the only place the
// registry meets import.meta.env — the hero modules stay node-safe so
// tooling can import them (see ./types.ts). BASE_URL keeps subpath deploys
// working and always ends with '/' (Vite guarantees it).

import type { HeroConfig } from './types'

export function payloadUrl(hero: HeroConfig): string {
  return `${import.meta.env.BASE_URL}data/${hero.slug}/${hero.season}.json`
}

/** The sibling creation payload (ADR-0030) — deployed beside the shot
 * payload and required for every registered hero. */
export function creationPayloadUrl(hero: HeroConfig): string {
  return `${import.meta.env.BASE_URL}data/${hero.slug}/${hero.season}.creation.json`
}

/** Normalized per-shot play-by-play context (ADR-0032). */
export function shotContextPayloadUrl(hero: HeroConfig): string {
  return `${import.meta.env.BASE_URL}data/${hero.slug}/${hero.season}.context.json`
}

/** Free-throw trips at trip grain (ADR-0053) — the fourth required sibling. */
export function freethrowPayloadUrl(hero: HeroConfig): string {
  return `${import.meta.env.BASE_URL}data/${hero.slug}/${hero.season}.freethrow.json`
}

export function heroImageUrl(hero: HeroConfig): string {
  return `${import.meta.env.BASE_URL}${hero.hero.imagePath}`
}

export function teamLogoUrl(hero: HeroConfig): string | null {
  return hero.hero.teamLogoPath
    ? `${import.meta.env.BASE_URL}${hero.hero.teamLogoPath}`
    : null
}

export function heroPageUrl(hero: HeroConfig): string {
  return `${import.meta.env.BASE_URL}${hero.slug}`
}

export function indexUrl(): string {
  return import.meta.env.BASE_URL
}
