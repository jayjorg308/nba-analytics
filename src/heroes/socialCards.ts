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
  return swap(
    html,
    /<\/head>/,
    `<meta property="og:url" content="${escapeAttr(meta.url)}" /></head>`,
    'head close',
  )
}
