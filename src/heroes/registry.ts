// The hero registry: the single source of hero truth (ADR-0022). The index
// page, the router, the sync script, and the per-hero tests all read this
// list — registering a hero here is what makes it exist everywhere.
//
// Adding a hero: a config module (+ colocated verdict guard + web-sized
// banner photo), a synced payload (`npm run hero:sync`), and an entry below.
// The index tile falls out of the registry for free.

import { codyWilliams } from './cody-williams'
// Keyonte George is REGISTERED deliberately (confirmed 2026-07-16): his page
// is live at /keyonte-george with the full two-act argument and guards, and
// argless hero:sync covers him. Only the hero INDEX stays hidden for now —
// the root serves Cody directly; the TEMPORARY(single-hero) markers for that
// live in src/App.tsx and src/app/HeroPage.tsx (ROADMAP status note).
import { keyonteGeorge } from './keyonte-george'
// THROWAWAY(experiment): disposable star profile — see the note in its
// module. Remove this import and entry (plus the module, placeholder image,
// and synced payload copies) when the experiment ends.
import { shaiGilgeousAlexander } from './shai-gilgeous-alexander'
import type { HeroConfig } from './types'

/** Ordered: the index page lists heroes in this order. */
export const HEROES: readonly HeroConfig[] = [
    codyWilliams,
    keyonteGeorge,
    shaiGilgeousAlexander,
]

export function heroBySlug(slug: string): HeroConfig | undefined {
    return HEROES.find((h) => h.slug === slug)
}
