// The hero registry: the single source of hero truth (ADR-0022). The index
// page, the router, the sync script, and the per-hero tests all read this
// list — registering a hero here is what makes it exist everywhere.
//
// Adding a hero: a config module (+ colocated verdict guard + web-sized
// banner photo), a synced payload (`npm run hero:sync`), and an entry below.
// The index tile falls out of the registry for free.

// Ace Bailey is v3 Phase 1's fourth hero — the selection-problem quadrant,
// and the designated live hero for 2026-27 (ADR-0059: his page flips to the
// living season the day its gates pass).
import { aceBailey } from './ace-bailey'
import { codyWilliams } from './cody-williams'
import { keyonteGeorge } from './keyonte-george'
// Shai is v2.5's positive control: a max-volume MVP profile held to the same
// contracts and guards as the two young-player arguments.
import { shaiGilgeousAlexander } from './shai-gilgeous-alexander'
import type { HeroConfig } from './types'

/** Ordered: the index page lists heroes in this order. */
export const HEROES: readonly HeroConfig[] = [
  codyWilliams,
  keyonteGeorge,
  shaiGilgeousAlexander,
  aceBailey,
]

export function heroBySlug(slug: string): HeroConfig | undefined {
  return HEROES.find((h) => h.slug === slug)
}
