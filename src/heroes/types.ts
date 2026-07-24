// The shape of a hero's authored configuration: the thesis and banner are
// hero COPY, the verdict and kicker are SEASON copy (ADR-0017/0021/0060) —
// one module per hero under src/heroes/, carrying its ordered season
// arguments. Deliberately node-safe — no import.meta here or in the hero
// modules, so tooling (scripts/sync-hero-payload.ts) imports the same
// registry the app renders; app-only URL derivation lives in ./urls.ts.

export interface HeroBannerConfig {
  /** Path under public/, no leading slash — the app layer prepends BASE_URL.
   * The committed image is always a web-sized derivative, never a
   * full-resolution source (ADR-0021). */
  imagePath: string
  /** The hero's standard NBA headshot (transparent-background PNG from
   * cdn.nba.com/headshots, ~200 KB), committed under public/ at the
   * conventional img/<slug>-headshot.png. The DIRECTORY'S asset (ADR-0065):
   * the index shows who is on file (uniform faces, no per-hero art
   * direction); the action poster above stays the hero page's argument. */
  headshotPath: string
  imageAlt: string
  /** Optional normalized `*-logo.png` team mark: a 1024px transparent square
   * with its centered mark at a 58–62% max footprint. Rendered as a faint
   * watermark in the wide layout (decorative and hidden on narrow screens).
   * Path under public/, no leading slash, like imagePath. */
  teamLogoPath?: string
  /** Focal point for the narrow full-bleed poster layout. */
  imagePosition: string
  /** Focal point for the wide right-anchored panel layout. */
  imagePositionWide: string
}

/** One season argument (ADR-0060): the season-owned authored copy behind a
 * complete argument page at its /<slug>/<season> permalink. */
export interface HeroSeasonConfig {
  /** The season string — the public/data/<slug>/<season>* payload key and
   * the permalink segment. */
  season: string
  /** The banner eyebrow — season-owned copy (it embeds the season string). */
  kicker: string
  /** The verdict (ADR-0017): AUTHORED COPY, kept honest by the colocated
   * <slug>.<season>.guard.test.ts (one guard file per season argument,
   * ADR-0063) — when the data moves, rewrite both together. */
  verdict: string
}

export interface HeroConfig {
  /** The hero's URL segment (`/<slug>`) and public/data/<slug>/ key. */
  slug: string
  playerName: string
  /** The v1 question, stated verbatim and nothing more (ADR-0005). */
  thesis: string
  hero: HeroBannerConfig
  /** Ordered season arguments (ADR-0060), oldest first. */
  seasons: readonly HeroSeasonConfig[]
  /** The season the `/<slug>` canonical alias renders — moved only by a
   * flip PR (ADR-0059/0060), never by the season loop. */
  canonicalSeason: string
}

/** The canonical season argument — the one `/<slug>` renders. */
export function canonicalSeasonOf(hero: HeroConfig): HeroSeasonConfig {
  return seasonArgumentOf(hero, hero.canonicalSeason)
}

/** The directory's meta line (ADR-0065): the canonical kicker's segments
 * minus the player's name — the marquee and rail already carry the name at
 * poster scale, so repeating it in the eyebrow reads as noise. Derived from
 * the authored kicker rather than authored twice; kickers follow the
 * "Name · Team · Nº N · Season" shape, and the index test holds every
 * hero's derivation non-empty and name-free so a kicker breaking the shape
 * fails loudly instead of shipping a broken eyebrow. */
export function indexMetaOf(hero: HeroConfig): string {
  return canonicalSeasonOf(hero)
    .kicker.split(' · ')
    .filter((part) => part.toLowerCase() !== hero.playerName.toLowerCase())
    .join(' · ')
}

/** A specific season argument, selected explicitly by season string. Guards
 * select their season with this — a guard keeps guarding its frozen
 * argument after a flip moves the canonical pointer (ADR-0060/0061). Throws
 * on a season the hero never argued (registry coherence is also asserted in
 * registry.test.ts). */
export function seasonArgumentOf(hero: HeroConfig, season: string): HeroSeasonConfig {
  const found = hero.seasons.find((s) => s.season === season)
  if (!found) {
    throw new Error(`${hero.slug} has no season argument for ${season}`)
  }
  return found
}
