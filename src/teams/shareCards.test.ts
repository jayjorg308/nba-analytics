// Per-game share cards and pages (docs/plans/jazz-first-site.md, "Share
// cards"; ADR-0067's pattern at game grain): the meta a scraper reads, the
// preloads agreeing with the runtime fetches, a card's content equal to its
// page's numbers, and the committed-card guard — every published game has a
// 1200x630 card, so the build's emission step never fails on deploy. The
// season homes' pages and cards (ADR-0087) ride the same rules: a season
// card per registered season, the meta pointing at it, the root's page
// without an og:url.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { aggregateShotMetrics } from '../domain/aggregate'
import { parseGamePayload } from '../domain/gamePayload'
import { parseTeamSeasonIndex } from '../domain/teamSeasonIndex'
import { formatSignedGap } from '../format'
import { heroPageHtml, rootPageHtml, SITE_ORIGIN } from '../heroes/socialCards'
import { publishedSeasons, TEAMS_ROOT } from './published'
import { utahJazz, TEAMS } from './registry'
import {
  gameCardPath,
  gameCardSpec,
  gamePageMeta,
  gamePreloadPaths,
  seasonCardPath,
  seasonCardSpec,
  seasonPageMeta,
} from './shareCards'
import { gamePayloadUrl, teamSeasonIndexUrl, teamShotPayloadUrl } from './urls'

const read = (rel: string) => JSON.parse(readFileSync(path.resolve(process.cwd(), rel), 'utf-8')) as unknown
const game = parseGamePayload(read('tests/fixtures/game.golden.json'))
const index = parseTeamSeasonIndex(read('tests/fixtures/team-index.golden.json'))
const row = index.games[0]!

describe('gamePageMeta', () => {
  const meta = gamePageMeta(utahJazz, '2025-26', row)

  it('points a shared link at its own card and its own url', () => {
    expect(meta.url).toBe(`${SITE_ORIGIN}/jazz/2026-01-03-gsw`)
    expect(meta.imageUrl).toBe(`${SITE_ORIGIN}/social-cards/jazz/2026-01-03-gsw.png`)
    expect(meta.title).toBe('Utah Jazz L 30–39 @ GSW · Jan 3, 2026')
    expect(meta.description).not.toContain('—')
  })

  it('preloads exactly what the card page fetches at boot', () => {
    expect(gamePreloadPaths(utahJazz, '2025-26', row.gameId)).toEqual([
      teamSeasonIndexUrl(utahJazz, '2025-26'),
      teamShotPayloadUrl(utahJazz, '2025-26'),
      gamePayloadUrl(utahJazz, '2025-26', row.gameId),
    ])
    const withPrior = { ...utahJazz, seasons: ['2025-26', '2026-27'] }
    expect(gamePreloadPaths(withPrior, '2026-27', '0022600001')).toContain('/data/_teams/uta/2025-26/index.json')
  })

  it('emits into the real index.html with its own og:url', () => {
    const html = heroPageHtml(readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8'), meta)
    expect(html).toContain(`<meta property="og:url" content="${meta.url}" />`)
    expect(html).toContain(meta.imageUrl)
  })
})

describe('seasonPageMeta (ADR-0087)', () => {
  // Pinned to fixed seasons: the registry's canonical season moves every year.
  const jazz = { ...utahJazz, seasons: ['2025-26', '2026-27'], canonicalSeason: '2026-27' }

  it('gives the bare team route the canonical season and a season page every other one', () => {
    const canonical = seasonPageMeta(jazz, '2026-27')
    expect(canonical.url).toBe(`${SITE_ORIGIN}/jazz`)
    expect(canonical.title).toBe('Utah Jazz · 2026-27 · Good Shots')
    expect(canonical.imageUrl).toBe(`${SITE_ORIGIN}/social-cards/jazz/2026-27.png`)
    expect(canonical.description).not.toContain('—')
    expect(seasonPageMeta(jazz, '2025-26').url).toBe(`${SITE_ORIGIN}/jazz/2025-26`)
  })

  it('preloads exactly what the season home fetches at boot, the prior season included', () => {
    expect(seasonPageMeta(jazz, '2026-27').preloadPaths).toEqual([
      teamShotPayloadUrl(jazz, '2026-27'),
      teamSeasonIndexUrl(jazz, '2026-27'),
      teamSeasonIndexUrl(jazz, '2025-26'),
      teamShotPayloadUrl(jazz, '2025-26'),
    ])
    expect(seasonPageMeta(jazz, '2025-26').preloadPaths).toEqual([
      teamShotPayloadUrl(jazz, '2025-26'),
      teamSeasonIndexUrl(jazz, '2025-26'),
    ])
  })

  it('makes the root page with the season’s card and no og:url', () => {
    const html = rootPageHtml(readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8'), seasonPageMeta(jazz, '2026-27'))
    expect(html).toContain('<title>Utah Jazz · 2026-27 · Good Shots</title>')
    expect(html).toContain(`content="${SITE_ORIGIN}/social-cards/jazz/2026-27.png"`)
    expect(html).not.toContain('property="og:url"')
    expect(html).toContain('<link rel="preload" href="/data/_teams/uta/2026-27/index.json" as="fetch" crossorigin />')
  })

  it('draws the season card from the team mark, the season as its eyebrow', () => {
    expect(seasonCardSpec(jazz, '2026-27')).toEqual({
      slug: 'jazz/2026-27',
      playerName: 'Utah Jazz',
      meta: '2026-27',
      logoPath: 'img/utah-logo.png',
      cue: 'The latest game →',
    })
    expect(seasonCardPath(jazz, '2026-27')).toBe('social-cards/jazz/2026-27.png')
  })
})

describe('committed season cards (one per registered team season, 1200x630)', () => {
  it('exist for every registered season at og:image size', () => {
    for (const team of TEAMS) {
      for (const season of team.seasons) {
        const card = path.resolve(process.cwd(), 'public', seasonCardPath(team, season))
        expect(existsSync(card), `run npm run cards:generate — missing ${card}`).toBe(true)
        const png = readFileSync(card)
        expect(png.readUInt32BE(16), season).toBe(1200)
        expect(png.readUInt32BE(20), season).toBe(630)
      }
    }
  })
})

describe('gameCardSpec', () => {
  it('carries the page’s own numbers and every shot', () => {
    const spec = gameCardSpec(utahJazz, game, row.slug)
    const m = aggregateShotMetrics(game.sides[0].shots, game.zoneBaseline)
    expect(spec.out).toBe(gameCardPath(utahJazz, '2026-01-03-gsw'))
    expect(spec.score).toBe('L 30–39')
    expect(spec.answers.map((a) => a.number)).toEqual([
      formatSignedGap(m.selection.playerDietExpectedPps, m.selection.leagueDietExpectedPps, 2),
      formatSignedGap(m.making.actualPps, m.selection.playerDietExpectedPps, 2),
    ])
    expect(spec.shots).toHaveLength(game.sides[0].shots.length)
  })
})

// Every published season on disk, registered or not: the season loop draws
// a living season's cards in the session that publishes its games (ADR-0091).
const published = TEAMS.flatMap((team) =>
  publishedSeasons(team).flatMap((season) => {
    const file = path.join(TEAMS_ROOT, team.tricode.toLowerCase(), season, 'index.json')
    return parseTeamSeasonIndex(JSON.parse(readFileSync(file, 'utf-8'))).games.map((g) => ({ team, slug: g.slug }))
  }),
)

describe.skipIf(published.length === 0)('committed game cards (one per published game, 1200x630)', () => {
  it('exist for every published game at og:image size', () => {
    for (const { team, slug } of published) {
      const card = path.resolve(process.cwd(), 'public', gameCardPath(team, slug))
      expect(existsSync(card), `run npm run cards:games — missing ${card}`).toBe(true)
      const png = readFileSync(card)
      expect(png.readUInt32BE(16), slug).toBe(1200)
      expect(png.readUInt32BE(20), slug).toBe(630)
    }
  })
})
