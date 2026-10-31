// @vitest-environment jsdom
// The report card's component contract (docs/plans/jazz-first-site.md, the
// team report card): the index fetched first, then the game file; the
// header with the night's title; the quadrant with its four corners and one
// link per game; the two answers with their anchors and no rank below the
// game count; both sides on the same terms; the players; the ruler line with
// its game count; the prior season's dots when that season is published;
// and the plain notes for a game or season not on file. Over the game and
// index goldens (the fixture game 0022500492).

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseGamePayload } from '../domain/gamePayload'
import { relabelIndex, teamPayloadFromGame } from '../domain/teamPayloadFromGame.testutil'
import { parseTeamSeasonIndex } from '../domain/teamSeasonIndex'
import { AUTHORED } from '../teams/computedCopy'
import { utahJazz } from '../teams/registry'
import type { TeamConfig } from '../teams/registry'
import { ReportCardPage } from './ReportCardPage'
import { parseTeamRoute } from './teamRoute'

// The fixture game is a 2025-26 game, so the team is pinned to the season it
// was cut from: the registry's canonical season moves every year, and a
// fixture's back link and its on-file seasons must not move with it.
const jazz: TeamConfig = { ...utahJazz, seasons: ['2025-26'], canonicalSeason: '2025-26' }

// under jsdom, import.meta.url is not a file URL — resolve from the repo root
const read = (rel: string) => JSON.parse(readFileSync(path.resolve(process.cwd(), rel), 'utf-8')) as unknown
const gameJson = read('tests/fixtures/game.golden.json')
const indexJson = read('tests/fixtures/team-index.golden.json')
const game = parseGamePayload(gameJson)
const payloadJson = teamPayloadFromGame(game)

const URLS = {
  index: '/data/_teams/uta/2025-26/index.json',
  payload: '/data/_teams/uta/2025-26.json',
  game: '/data/_teams/uta/2025-26/games/0022500492.json',
}
const READY = {
  [URLS.index]: { ok: true, json: indexJson },
  [URLS.payload]: { ok: true, json: payloadJson },
  [URLS.game]: { ok: true, json: gameJson },
}

function stubFetch(routes: Record<string, { ok: boolean; status?: number; json?: unknown }>) {
  const fetch = vi.fn((url: unknown) => {
    const r = routes[String(url)]
    if (r === undefined) return Promise.reject(new Error(`unexpected fetch ${String(url)}`))
    return Promise.resolve({ ok: r.ok, status: r.status ?? 200, json: async () => r.json })
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

const routeOf = (segment: string) => {
  const route = parseTeamRoute(segment)
  if (route.kind !== 'game' && route.kind !== 'gameId') throw new Error(`not a game route: ${segment}`)
  return route
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ReportCardPage', () => {
  it('renders the card in the chosen order, every number from the files', async () => {
    stubFetch(READY)
    render(<ReportCardPage team={jazz} route={routeOf('2026-01-03-gsw')} />)
    const h1 = await screen.findByRole('heading', { level: 1 })
    expect(h1.textContent).toMatch(/^L 30–39 · /)
    expect(screen.getByText('Utah Jazz · Jan 3, 2026 · @ GSW')).toBeTruthy()
    expect(screen.getByRole('link', { name: '← 2025-26 season' }).getAttribute('href')).toBe('/jazz')
    // The quadrant: four corners, one link per game, this game's link to itself.
    for (const corner of ['costly shots that fell', 'good shots that fell', 'costly shots that didn’t fall', 'good shots that didn’t fall']) {
      expect(screen.getByText(corner)).toBeTruthy()
    }
    const quadrant = screen.getByRole('group', { name: /Every Utah Jazz game so far/ })
    const dots = within(quadrant).getAllByRole('link')
    expect(dots).toHaveLength(1)
    expect(dots[0]!.getAttribute('href')).toBe('/jazz/2026-01-03-gsw')
    // The two answers, with anchors and no rank at one game.
    expect(screen.getByRole('heading', { name: 'Good shots?' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Did they fall?' })).toBeTruthy()
    expect(screen.getAllByText(/20 priced shots/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/of \d+ games so far/)).toBeNull()
    expect(screen.getByText('1 zone-point conflict not priced.')).toBeTruthy()
    // Both sides, one table, the same rows.
    const sides = screen.getByRole('table', { name: 'Both teams on the same terms' })
    expect(within(sides).getByText('Conversion vs expected')).toBeTruthy()
    expect(within(sides).getByText(/1 technical/)).toBeTruthy()
    // Players: the shotless free-throw trip shows no expected value, and
    // every name opens that player's night (ADR-0096), his included.
    const players = screen.getByRole('table', { name: 'Each player’s night' })
    const hendricks = within(players).getByText('Taylor Hendricks').closest('tr')!
    expect(within(hendricks).getAllByText('—')).toHaveLength(3)
    expect(within(players).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/jazz/2026-01-03-gsw/keyonte-george',
      '/jazz/2026-01-03-gsw/kyle-filipowski',
      '/jazz/2026-01-03-gsw/taylor-hendricks',
    ])
    // The ruler line states its game count.
    expect(screen.getByText(/as it stood entering the day, 2 games through Jan 2, 2026\./)).toBeTruthy()
    expect(screen.queryAllByText('draft copy').length > 0).toBe(!AUTHORED)
    // The title waits on the score, so it is set by an effect of the commit
    // the fetch resolves, outside act: the heading can be found before that
    // effect runs (1 in 20 locally, two main pushes in CI, 2026-10-29).
    await waitFor(() => expect(document.title).toBe('Utah Jazz L 30–39 @ GSW · Jan 3, 2026'))
  })

  it('opens on the poster and numbers its acts, both teams on the floors (ADR-0094)', async () => {
    stubFetch(READY)
    const { container } = render(<ReportCardPage team={jazz} route={routeOf('2026-01-03-gsw')} />)
    await screen.findByRole('heading', { level: 1 })
    // No photograph on file for the fixture game: the typographic poster,
    // with no photo and no credit line, never another game's photograph.
    const banner = container.querySelector('header.hero-banner')!
    expect(banner.classList.contains('poster-type')).toBe(true)
    expect(container.querySelector('.hero-banner-photo')).toBeNull()
    expect(container.querySelector('.poster-credit')).toBeNull()
    // The acts in order, each kicker over its title.
    const kickers = [...container.querySelectorAll('.section-kicker')].map((k) => k.textContent)
    expect(kickers).toEqual(['01 · THE NIGHT', '02 · THE FLOORS', '03 · THE TERMS', '04 · THE PLAYERS'])
    // Both teams' courts, and one zone table with a column per side.
    expect(screen.getByRole('img', { name: /Utah Jazz shots/ })).toBeTruthy()
    expect(screen.getByRole('img', { name: /Golden State Warriors shots/ })).toBeTruthy()
    const zones = screen.getByRole('table', { name: 'Makes and attempts per zone, both teams' })
    const header = within(zones).getAllByRole('columnheader').map((h) => h.textContent)
    expect(header).toEqual(['Zone', 'UTAFGM–FGA', 'GSWFGM–FGA'])
  })

  it('opens the same card from the first team page’s game-id link', async () => {
    stubFetch(READY)
    render(<ReportCardPage team={jazz} route={routeOf('0022500492')} />)
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toMatch(/^L 30–39/)
  })

  it('draws the prior season behind when that season is published', async () => {
    const team = { ...jazz, seasons: ['2024-25', '2025-26'] as const }
    stubFetch({
      ...READY,
      '/data/_teams/uta/2024-25/index.json': {
        ok: true,
        json: relabelIndex(parseTeamSeasonIndex(indexJson), '2024-25'),
      },
      '/data/_teams/uta/2024-25.json': { ok: true, json: teamPayloadFromGame(game, '2024-25') },
    })
    render(<ReportCardPage team={team} route={routeOf('2026-01-03-gsw')} />)
    const quadrant = await screen.findByRole('group', { name: /Every Utah Jazz game so far/ })
    expect(within(quadrant).getAllByRole('link')).toHaveLength(2)
    expect(screen.getByText('2024-25 games')).toBeTruthy()
  })

  it('names a game not on file plainly, and a season not on file without fetching', async () => {
    stubFetch(READY)
    render(<ReportCardPage team={jazz} route={routeOf('2026-01-04-gsw')} />)
    expect(await screen.findByText('No Utah Jazz game on file for 2026-01-04-gsw.')).toBeTruthy()
    cleanup()
    const fetch = stubFetch({})
    render(<ReportCardPage team={jazz} route={routeOf('2024-11-01-lac')} />)
    expect(screen.getByText('No Utah Jazz season on file for 2024-11-01-lac.')).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('surfaces a broken game file plainly, never a partial card', async () => {
    const broken = structuredClone(gameJson) as { sides: { box: { points: number } }[] }
    broken.sides[0]!.box.points += 1
    stubFetch({ ...READY, [URLS.game]: { ok: true, json: broken } })
    render(<ReportCardPage team={jazz} route={routeOf('2026-01-03-gsw')} />)
    expect(await screen.findByText(/Payload contract violation/)).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
  })
})
