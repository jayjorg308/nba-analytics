// Per-game share cards and pages (docs/plans/jazz-first-site.md, "Share
// cards"; ADR-0067's pattern at game grain): the meta a scraper reads, the
// preloads agreeing with the runtime fetches, a card's content equal to its
// page's numbers, and the committed-card guard — every published game has a
// 1200x630 card, so the build's emission step never fails on deploy. The
// season homes' pages and cards (ADR-0087) ride the same rules: a season
// card per registered season, the meta pointing at it, the root's page
// without an og:url. The player season pages (ADR-0095) show their season's
// card under their own title and og:url, one page per shooter, each landing
// on the route that renders him.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTeamRoute } from '../app/teamRoute'
import { aggregateShotMetrics } from '../domain/aggregate'
import { parseGamePayload } from '../domain/gamePayload'
import { seasonShooters } from '../domain/playerSeason'
import { parseTeamSeasonIndex } from '../domain/teamSeasonIndex'
import { parseTeamShotPayload } from '../domain/teamShotPayload'
import { formatSignedGap } from '../format'
import { heroPageHtml, rootPageHtml, SITE_ORIGIN } from '../heroes/socialCards'
import { publishedSeasons, TEAMS_ROOT } from './published'
import { utahJazz, TEAMS } from './registry'
import {
  gameCardPath,
  gameCardSpec,
  gamePageMeta,
  gamePreloadPaths,
  playerPageMeta,
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

describe('playerPageMeta (ADR-0095)', () => {
  // Pinned to fixed seasons, like the season pages above.
  const jazz = { ...utahJazz, seasons: ['2025-26', '2026-27'], canonicalSeason: '2026-27' }
  const keyonte = { name: 'Keyonte George', slug: 'keyonte-george' }

  it('gives the canonical season his alias and every other season his permalink', () => {
    const canonical = playerPageMeta(jazz, '2026-27', keyonte)
    expect(canonical.url).toBe(`${SITE_ORIGIN}/jazz/keyonte-george`)
    expect(canonical.title).toBe('Keyonte George · 2026-27 · Utah Jazz')
    expect(canonical.description).toBe(
      'Keyonte George, Utah Jazz 2026-27, game by game. Each game’s priced shots against the league as it stood that day, and his season zone by zone.',
    )
    expect(playerPageMeta(jazz, '2025-26', keyonte).url).toBe(`${SITE_ORIGIN}/jazz/2025-26/keyonte-george`)
  })

  it('shows his season’s card, so a debut needs no new art', () => {
    for (const season of jazz.seasons) {
      const meta = playerPageMeta(jazz, season, keyonte)
      expect(meta.imageUrl).toBe(`${SITE_ORIGIN}/${seasonCardPath(jazz, season)}`)
      expect(meta.imageAlt).toBe(seasonPageMeta(jazz, season).imageAlt)
    }
  })

  it('preloads exactly what the player page fetches at boot, the prior season included', () => {
    // PlayerSeasonPage's four fetches: the season's index and payload, then
    // the prior season's when that season is registered.
    const fetches = (season: string, prior?: string) =>
      [
        teamSeasonIndexUrl(jazz, season),
        teamShotPayloadUrl(jazz, season),
        ...(prior === undefined ? [] : [teamSeasonIndexUrl(jazz, prior), teamShotPayloadUrl(jazz, prior)]),
      ].sort()
    expect([...playerPageMeta(jazz, '2026-27', keyonte).preloadPaths].sort()).toEqual(fetches('2026-27', '2025-26'))
    expect([...playerPageMeta(jazz, '2025-26', keyonte).preloadPaths].sort()).toEqual(fetches('2025-26'))
  })

  it('emits into the real index.html with its own og:url', () => {
    const meta = playerPageMeta(jazz, '2025-26', keyonte)
    const html = heroPageHtml(readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8'), meta)
    expect(html).toContain('<title>Keyonte George · 2025-26 · Utah Jazz</title>')
    expect(html).toContain(`<meta property="og:url" content="${SITE_ORIGIN}/jazz/2025-26/keyonte-george" />`)
    expect(html).toContain(`content="${SITE_ORIGIN}/social-cards/jazz/2025-26.png"`)
  })
})

// Every shooter of every registered season, read from the deployed payloads
// the build's emission step reads. Skips on clean clones.
const shooters = TEAMS.flatMap((team) =>
  team.seasons.flatMap((season) => {
    const file = path.join(TEAMS_ROOT, team.tricode.toLowerCase(), `${season}.json`)
    if (!existsSync(file)) return []
    const payload = parseTeamShotPayload(JSON.parse(readFileSync(file, 'utf-8')))
    return seasonShooters(payload).map((player) => ({ team, season, player }))
  }),
)

describe.skipIf(shooters.length === 0)('player share pages (one per shooter of every registered season)', () => {
  it('each lands on the route that renders his season', () => {
    for (const { team, season, player } of shooters) {
      const [teamSegment, segment, third] = new URL(playerPageMeta(team, season, player).url).pathname
        .split('/')
        .filter((s) => s !== '')
      expect(teamSegment).toBe(team.slug)
      expect(parseTeamRoute(segment, third), `${season} ${player.slug}`).toEqual(
        season === team.canonicalSeason
          ? { kind: 'player', slug: player.slug }
          : { kind: 'seasonPlayer', season, slug: player.slug },
      )
    }
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
