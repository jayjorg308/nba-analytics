// App-layer URL derivation for registry entries. This is the only place the
// registry meets import.meta.env — the hero modules stay node-safe so
// tooling can import them (see ./types.ts). BASE_URL keeps subpath deploys
// working and always ends with '/' (Vite guarantees it).

import type { HeroConfig } from './types'

export function payloadUrl(hero: HeroConfig): string {
  return `${import.meta.env.BASE_URL}data/${hero.slug}/${hero.season}.json`
}

export function heroImageUrl(hero: HeroConfig): string {
  return `${import.meta.env.BASE_URL}${hero.hero.imagePath}`
}

export function heroPageUrl(hero: HeroConfig): string {
  return `${import.meta.env.BASE_URL}${hero.slug}`
}

export function indexUrl(): string {
  return import.meta.env.BASE_URL
}
