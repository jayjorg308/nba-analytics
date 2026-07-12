// The hero registry: the single source of hero truth (ADR-0022). The index
// page, the router, the sync script, and the per-hero tests all read this
// list — registering a hero here is what makes it exist everywhere.
//
// Adding a hero: a config module (+ colocated verdict guard + web-sized
// banner photo), a synced payload (`npm run hero:sync`), and an entry below.
// The index tile falls out of the registry for free.

import { codyWilliams } from './cody-williams'
import { keyonteGeorge } from './keyonte-george'
import type { HeroConfig } from './types'

/** Ordered: the index page lists heroes in this order. */
export const HEROES: readonly HeroConfig[] = [codyWilliams, keyonteGeorge]

export function heroBySlug(slug: string): HeroConfig | undefined {
  return HEROES.find((h) => h.slug === slug)
}
