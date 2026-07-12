// The shape of a hero's authored configuration: the thesis, the verdict, and
// the banner are hero COPY (ADR-0017/0021), one module per hero under
// src/heroes/. Deliberately node-safe — no import.meta here or in the hero
// modules, so tooling (scripts/sync-hero-payload.ts) imports the same
// registry the app renders; app-only URL derivation lives in ./urls.ts.

export interface HeroBannerConfig {
  /** Path under public/, no leading slash — the app layer prepends BASE_URL.
   * The committed image is always a web-sized derivative, never a
   * full-resolution source (ADR-0021). */
  imagePath: string
  imageAlt: string
  /** Focal point for the narrow full-bleed poster layout. */
  imagePosition: string
  /** Focal point for the wide right-anchored panel layout. */
  imagePositionWide: string
  kicker: string
}

export interface HeroConfig {
  /** The hero's URL segment (`/<slug>`) and public/data/<slug>/ key. */
  slug: string
  playerName: string
  season: string
  /** The v1 question, stated verbatim and nothing more (ADR-0005). */
  thesis: string
  hero: HeroBannerConfig
  /** The verdict (ADR-0017): AUTHORED COPY, kept honest by the colocated
   * <slug>.guard.test.ts — when the data moves, rewrite both together. */
  verdict: string
}
