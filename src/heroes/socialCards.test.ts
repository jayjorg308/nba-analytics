// Per-hero share pages (ADR-0067): the transform is tested against the REAL
// index.html — the same source vite builds — so a meta-block refactor that
// would break the emission step fails here first. The committed-card guard
// runs registry-wide: a registered hero without a 1200x630 card is a red
// suite, never a broken share preview (the authoring-tripwire stance,
// applied to a mechanical asset).

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { HEROES } from './registry'
import { canonicalSeasonOf, type HeroConfig } from './types'
import {
  FONT_PRELOAD_FAMILIES,
  fontPreloadLinks,
  heroPageHtml,
  heroPageMeta,
  payloadPreloadPaths,
  SITE_ORIGIN,
  socialCardPath,
  withFontPreloads,
} from './socialCards'

const indexHtml = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8')
const hero = HEROES[0]!
const season = canonicalSeasonOf(hero)

describe('heroPageMeta', () => {
  it('derives per-page canonical urls: alias for the canonical, permalink per season', () => {
    expect(heroPageMeta(hero, season, { canonicalAlias: true }).url).toBe(
      `${SITE_ORIGIN}/${hero.slug}`,
    )
    expect(heroPageMeta(hero, season, { canonicalAlias: false }).url).toBe(
      `${SITE_ORIGIN}/${hero.slug}/${season.season}`,
    )
  })

  it('mirrors the hero page title convention and points at the hero card', () => {
    const meta = heroPageMeta(hero, season, { canonicalAlias: true })
    expect(meta.title).toBe(`${hero.playerName} · ${season.season} · shot selection`)
    expect(meta.imageUrl).toBe(`${SITE_ORIGIN}/social-cards/${hero.slug}.png`)
  })
})

describe('payloadPreloadPaths (the boot fetch set, ADR-0067 amendment)', () => {
  it('preloads the four required siblings for a single-season hero', () => {
    expect(payloadPreloadPaths(hero, season)).toEqual([
      `/data/${hero.slug}/${season.season}.json`,
      `/data/${hero.slug}/${season.season}.creation.json`,
      `/data/${hero.slug}/${season.season}.context.json`,
      `/data/${hero.slug}/${season.season}.freethrow.json`,
    ])
  })

  it('adds the prior SHOT payload exactly where the growth coda fetches it (ADR-0061)', () => {
    // Synthetic two-season hero: no registered hero argues two seasons yet,
    // but the flip PR will (the Ace activation), and the emitted page must
    // preload what the canonical page actually fetches — five payloads on
    // the canonical season, four on the frozen prior's own permalink.
    const twoSeasons: HeroConfig = {
      ...hero,
      slug: 'two-season-hero',
      canonicalSeason: '2026-27',
      seasons: [
        { season: '2025-26', kicker: 'k', verdict: 'v' },
        { season: '2026-27', kicker: 'k', verdict: 'v' },
      ],
    }
    const canonical = payloadPreloadPaths(twoSeasons, twoSeasons.seasons[1]!)
    expect(canonical).toHaveLength(5)
    expect(canonical[4]).toBe('/data/two-season-hero/2025-26.json')
    // The frozen prior season's page has no coda: four payloads only.
    expect(payloadPreloadPaths(twoSeasons, twoSeasons.seasons[0]!)).toHaveLength(4)
  })
})

describe('font preloads (the first-paint jump fix)', () => {
  // Synthetic built-asset listing: the four critical families plus files
  // the filter must ignore (mono, non-latin subsets, non-woff2).
  const assets = [
    'big-shoulders-display-latin-900-normal-CW8trzgu.woff2',
    'big-shoulders-display-latin-900-normal-DMT-1gsg.woff',
    'big-shoulders-display-vietnamese-900-normal-B_uE6zXf.woff2',
    'public-sans-latin-400-normal-8Rpg0ruU.woff2',
    'public-sans-latin-500-normal-NlrCPXnF.woff2',
    'public-sans-latin-600-normal-Fru-LXNs.woff2',
    'public-sans-latin-ext-400-normal-mk90oQqJ.woff2',
    'ibm-plex-mono-latin-400-normal-DMJ8VG8y.woff2',
    'index-9N3Bwz62.js',
  ]

  it('preloads exactly the critical families, woff2 only, crossorigin set', () => {
    const links = fontPreloadLinks(assets)
    expect(links.match(/<link /g)).toHaveLength(FONT_PRELOAD_FAMILIES.length)
    expect(links).toContain(
      '/assets/big-shoulders-display-latin-900-normal-CW8trzgu.woff2',
    )
    // woff2 only (never the woff fallback), lazy families stay lazy.
    expect(links).not.toContain('DMT-1gsg.woff')
    expect(links).not.toContain('vietnamese')
    expect(links).not.toContain('latin-ext')
    expect(links).not.toContain('ibm-plex-mono')
    // Load-bearing attributes: as=font + crossorigin, or the browser
    // downloads every font twice.
    expect(links.match(/as="font" type="font\/woff2" crossorigin/g)).toHaveLength(
      FONT_PRELOAD_FAMILIES.length,
    )
  })

  it('fails loudly when a critical family is missing from the build', () => {
    const missingDisplay = assets.filter((f) => !f.startsWith('big-shoulders'))
    expect(() => fontPreloadLinks(missingDisplay)).toThrow(/no built \.woff2 asset/)
  })

  it('injects into the head of the real index.html', () => {
    const html = withFontPreloads(indexHtml, assets)
    expect(html).toContain('as="font"')
    expect(html.indexOf('as="font"')).toBeLessThan(html.indexOf('</head>'))
  })
})

describe('heroPageHtml over the real index.html', () => {
  const meta = heroPageMeta(hero, season, { canonicalAlias: true })
  const html = heroPageHtml(indexHtml, meta)

  it('swaps the title and every share meta to the hero', () => {
    expect(html).toContain(`<title>${meta.title}</title>`)
    expect(html).not.toContain('<title>Good Shots</title>')
    for (const key of ['og:title', 'twitter:title']) {
      expect(html).toContain(`${key}"`)
    }
    expect(html).toContain(`content="${meta.imageUrl}"`)
    expect(html).not.toContain('social-card.png')
    expect(html).toContain(meta.description)
  })

  it('adds the per-page og:url the product-wide card deliberately omits', () => {
    // The source mentions og:url in a comment; what must be absent is the TAG.
    expect(indexHtml).not.toContain('property="og:url"')
    expect(html).toContain(`<meta property="og:url" content="${meta.url}" />`)
  })

  it('preloads every payload the page will fetch, as-fetch with crossorigin', () => {
    for (const p of meta.preloadPaths) {
      expect(html).toContain(`<link rel="preload" href="${p}" as="fetch" crossorigin />`)
    }
    // The root index.html carries none: the directory fetches no payloads.
    expect(indexHtml).not.toContain('as="fetch"')
  })

  it('escapes swapped content into attribute-safe form', () => {
    const hostile = { ...meta, title: 'A "B" & <C>' }
    const escaped = heroPageHtml(indexHtml, hostile)
    expect(escaped).toContain('content="A &quot;B&quot; &amp; &lt;C&gt;"')
    expect(escaped).not.toContain('content="A "B"')
  })

  it('fails loudly when the meta block is missing, never ships stale meta', () => {
    expect(() => heroPageHtml('<html><head></head></html>', meta)).toThrow(
      /not found in the built index\.html/,
    )
  })
})

describe('committed cards (one per registered hero, 1200x630)', () => {
  for (const h of HEROES) {
    it(`${h.slug} has a committed card at og:image size`, () => {
      const cardPath = path.resolve(process.cwd(), 'public', socialCardPath(h))
      expect(existsSync(cardPath), `run npm run cards:generate — missing ${cardPath}`).toBe(true)
      const png = readFileSync(cardPath)
      // PNG magic, then the IHDR width/height at fixed offsets.
      expect(png.subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )
      expect(png.readUInt32BE(16)).toBe(1200)
      expect(png.readUInt32BE(20)).toBe(630)
    })
  }
})
