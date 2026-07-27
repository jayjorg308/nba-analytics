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
import { canonicalSeasonOf } from './types'
import { heroPageHtml, heroPageMeta, SITE_ORIGIN, socialCardPath } from './socialCards'

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
