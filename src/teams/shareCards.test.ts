// Per-game share cards and pages (docs/plans/jazz-first-site.md, "Share
// cards"; ADR-0067's pattern at game grain): the meta a scraper reads, the
// preloads agreeing with the runtime fetches, a card's content equal to its
// page's numbers, and the committed-card guard — every published game has a
// 1200x630 card, so the build's emission step never fails on deploy.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { aggregateShotMetrics } from '../domain/aggregate'
import { parseGamePayload } from '../domain/gamePayload'
import { parseTeamSeasonIndex } from '../domain/teamSeasonIndex'
import { formatSignedGap } from '../format'
import { heroPageHtml, SITE_ORIGIN } from '../heroes/socialCards'
import { publishedSeasons, TEAMS_ROOT } from './published'
import { utahJazz, TEAMS } from './registry'
import { gameCardPath, gameCardSpec, gamePageMeta, gamePreloadPaths, teamPageMeta } from './shareCards'
import { gamePayloadUrl, ledgerFactsUrl, teamSeasonIndexUrl, teamShotPayloadUrl } from './urls'

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

describe('teamPageMeta', () => {
  it('gives the bare team route its own page, preloading what the season page fetches', () => {
    // Pinned to a fixed canonical season: the registry's moves every year.
    const meta = teamPageMeta({ ...utahJazz, seasons: ['2025-26'], canonicalSeason: '2025-26' })
    expect(meta.url).toBe(`${SITE_ORIGIN}/jazz`)
    expect(meta.title).toBe('Utah Jazz · 2025-26 · shot profile')
    expect(meta.preloadPaths).toEqual([
      teamShotPayloadUrl(utahJazz, '2025-26'),
      ledgerFactsUrl(utahJazz, '2025-26'),
      teamSeasonIndexUrl(utahJazz, '2025-26'),
    ])
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
