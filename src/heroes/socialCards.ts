// Per-hero share pages (ADR-0067): the pure derivation behind the build's
// HTML emission step. A static host serves one index.html for every route,
// so per-hero social meta exists only as build-time emitted copies of the
// built page with the meta block swapped — the app itself still resolves
// the hero at runtime (ADR-0022 stands; this layer only changes what a
// non-JS scraper reads).
//
// Deliberately node-safe and DOM-free (string transforms over the built
// HTML), so the emit script, the tests, and any future tooling consume the
// same functions.

import type { HeroConfig, HeroSeasonConfig } from './types'

/** The deployed origin — the value the product-wide card already hardcodes
 * in index.html's og:image. */
export const SITE_ORIGIN = 'https://www.nbagoodshots.com'

/** The committed card asset for a hero, under public/ (no leading slash,
 * the imagePath convention). One card per hero, shared by its seasons: the
 * card names the player; the page meta names the season. */
export function socialCardPath(hero: HeroConfig): string {
  return `social-cards/${hero.slug}.png`
}

export interface HeroPageMeta {
  /** Mirrors the hero page's runtime document.title. */
  title: string
  description: string
  imageUrl: string
  imageAlt: string
  /** The page's own og:url — per-page canonical, the thing the product-wide
   * card deliberately omitted (a root og:url would collapse a shared hero
   * link back to the front page). */
  url: string
  /** The payload paths this page's app boot will fetch, preloaded from the
   * emitted HTML so the downloads start at parse time instead of after
   * React boots (ADR-0067 amendment) — the visible "Loading shot data…"
   * beat was mostly this waterfall. */
  preloadPaths: string[]
}

/** The payloads a season argument's page fetches at boot: the four required
 * siblings (ADRs 0030/0032/0053), plus the prior argued season's SHOT
 * payload when this is the canonical season with a growth coda (ADR-0061 —
 * the coda's exact fetch set). Absolute paths from the site root, the
 * node-safe twin of src/heroes/urls.ts (which owns the runtime BASE_URL
 * derivation and must stay in agreement). */
export function payloadPreloadPaths(hero: HeroConfig, season: HeroSeasonConfig): string[] {
  const base = `/data/${hero.slug}/${season.season}`
  const paths = [
    `${base}.json`,
    `${base}.creation.json`,
    `${base}.context.json`,
    `${base}.freethrow.json`,
  ]
  const canonicalIdx = hero.seasons.findIndex((s) => s.season === hero.canonicalSeason)
  if (season.season === hero.canonicalSeason && canonicalIdx > 0) {
    paths.push(`/data/${hero.slug}/${hero.seasons[canonicalIdx - 1]!.season}.json`)
  }
  return paths
}

export function heroPageMeta(
  hero: HeroConfig,
  season: HeroSeasonConfig,
  { canonicalAlias }: { canonicalAlias: boolean },
): HeroPageMeta {
  return {
    title: `${hero.playerName} · ${season.season} · shot selection`,
    description: `${hero.thesis} An NBA shot-selection argument, verdict first and evidence after.`,
    imageUrl: `${SITE_ORIGIN}/${socialCardPath(hero)}`,
    imageAlt: `${hero.playerName} beside the Good Shots wordmark`,
    url: canonicalAlias
      ? `${SITE_ORIGIN}/${hero.slug}`
      : `${SITE_ORIGIN}/${hero.slug}/${season.season}`,
    preloadPaths: payloadPreloadPaths(hero, season),
  }
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Swap one tag's content, failing loudly when the pattern is absent — an
 * index.html refactor must break the build here, never ship stale meta. */
function swap(html: string, pattern: RegExp, replacement: string, label: string): string {
  if (!pattern.test(html)) {
    throw new Error(`hero page emit: ${label} not found in the built index.html`)
  }
  return html.replace(pattern, replacement)
}

function swapMeta(html: string, attr: 'name' | 'property', key: string, content: string): string {
  return swap(
    html,
    new RegExp(`(<meta[^>]*${attr}="${key}"[^>]*content=")[^"]*(")`),
    `$1${escapeAttr(content)}$2`,
    `meta ${key}`,
  )
}

/** The built index.html with its share meta re-pointed at one hero page.
 * The og:image:width/height stay: every card ships at the same 1200x630. */
export function heroPageHtml(indexHtml: string, meta: HeroPageMeta): string {
  let html = swap(
    indexHtml,
    /<title>[^<]*<\/title>/,
    `<title>${escapeAttr(meta.title)}</title>`,
    'title',
  )
  html = swapMeta(html, 'name', 'description', meta.description)
  html = swapMeta(html, 'property', 'og:title', meta.title)
  html = swapMeta(html, 'property', 'og:description', meta.description)
  html = swapMeta(html, 'property', 'og:image', meta.imageUrl)
  html = swapMeta(html, 'property', 'og:image:alt', meta.imageAlt)
  html = swapMeta(html, 'name', 'twitter:title', meta.title)
  html = swapMeta(html, 'name', 'twitter:description', meta.description)
  html = swapMeta(html, 'name', 'twitter:image', meta.imageUrl)
  // Payload preloads (ADR-0067 amendment): `crossorigin` is required for
  // as="fetch" to match fetch()'s default credentials mode — without it
  // the browser fetches twice and warns the preload went unused.
  const preloads = meta.preloadPaths
    .map((p) => `<link rel="preload" href="${escapeAttr(p)}" as="fetch" crossorigin />`)
    .join('')
  return swap(
    html,
    /<\/head>/,
    `${preloads}<meta property="og:url" content="${escapeAttr(meta.url)}" /></head>`,
    'head close',
  )
}
