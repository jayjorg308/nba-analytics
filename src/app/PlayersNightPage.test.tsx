// @vitest-environment jsdom
// The player's night's component contract (ADR-0096; the layout chosen
// 2026-10-31, B, Composite): his headshot banner and byline, the links up to
// his season page and across to the report card, the two answers with their
// player-grain anchors, the chips, the receipt behind its drill-in down to
// his box points, his season's quadrant with this game ringed and its dots
// opening nights, the ruler; a free-throw-only night with no season behind
// it; and the plain notes for a player not in the box or a season not on
// file. Over the game and index goldens (the fixture game 0022500492).

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseGamePayload } from '../domain/gamePayload'
import { teamPayloadFromGame } from '../domain/teamPayloadFromGame.testutil'
import { utahJazz } from '../teams/registry'
import type { TeamConfig } from '../teams/registry'
import { PlayersNightPage } from './PlayersNightPage'
import { parseTeamRoute } from './teamRoute'

// Pinned to the fixture's season, as the report card's test pins it.
const jazz: TeamConfig = { ...utahJazz, seasons: ['2025-26'], canonicalSeason: '2025-26' }

// under jsdom, import.meta.url is not a file URL — resolve from the repo root
const read = (rel: string) => JSON.parse(readFileSync(path.resolve(process.cwd(), rel), 'utf-8')) as unknown
const gameJson = read('tests/fixtures/game.golden.json')
const indexJson = read('tests/fixtures/team-index.golden.json')
const game = parseGamePayload(gameJson)

const READY = {
  '/data/_teams/uta/2025-26/index.json': { ok: true, json: indexJson },
  '/data/_teams/uta/2025-26.json': { ok: true, json: teamPayloadFromGame(game) },
  '/data/_teams/uta/2025-26/games/0022500492.json': { ok: true, json: gameJson },
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

const routeOf = (game: string, slug: string) => {
  const route = parseTeamRoute(game, slug)
  if (route.kind !== 'night') throw new Error(`not a night route: ${game}/${slug}`)
  return route
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('PlayersNightPage', () => {
  it('renders his night, every number from the game file', async () => {
    stubFetch(READY)
    render(<PlayersNightPage team={jazz} route={routeOf('2026-01-03-gsw', 'keyonte-george')} />)
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Keyonte George')
    expect(screen.getByText('Utah Jazz · Jan 3, 2026 · @ GSW')).toBeTruthy()
    expect(screen.getByText(/^L 30–39 · 22 pts · /)).toBeTruthy()
    expect(screen.getByRole('link', { name: '← His 2025-26 season' }).getAttribute('href')).toBe('/jazz/keyonte-george')
    expect(screen.getByRole('link', { name: 'The game’s report card →' }).getAttribute('href')).toBe('/jazz/2026-01-03-gsw')
    // The two answers at player grain, with the conflict outside both.
    expect(screen.getByRole('heading', { name: 'Good shots?' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Did they fall?' })).toBeTruthy()
    expect(screen.getAllByText(/17 priced shots/)).toHaveLength(2)
    expect(screen.getByText(/his diet at league rates/)).toBeTruthy()
    expect(screen.getByText('1 zone-point conflict not priced.')).toBeTruthy()
    // The chips: counts, never priced.
    expect(screen.getByText(/2 shooting fouls, 1 and-1/)).toBeTruthy()
    expect(screen.getByRole('img', { name: /17 shots by Keyonte George/ })).toBeTruthy()
    // His season: one dot, this one, opening his night.
    const quadrant = screen.getByRole('group', { name: /Keyonte George took a priced shot in through this one/ })
    expect(within(quadrant).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/jazz/2026-01-03-gsw/keyonte-george'])
    expect(screen.getByText('Hover a game to read it. Click to open his night.')).toBeTruthy()
    expect(screen.getByText(/as it stood entering the day, 2 games through Jan 2, 2026\. Each dot/)).toBeTruthy()
    await waitFor(() => expect(document.title).toBe('Keyonte George · Jan 3, 2026 · Utah Jazz'))
  })

  it('opens the receipt in game order down to his box points', async () => {
    stubFetch(READY)
    render(<PlayersNightPage team={jazz} route={routeOf('2026-01-03-gsw', 'keyonte-george')} />)
    const drill = await screen.findByRole('button', { name: 'The night in game order, 21 lines' })
    expect(screen.queryByRole('table')).toBeNull()
    fireEvent.click(drill)
    const receipt = screen.getByRole('table', { name: /Every attempt and trip in game order/ })
    const body = within(receipt).getAllByRole('row').slice(1)
    expect(body).toHaveLength(21 + 2)
    expect(within(receipt).getByText(/zone-point conflict/).closest('tr')!.className).toBe('night-unpriced')
    const total = within(receipt).getByText('Game total').closest('tr')!
    expect(within(total).getByText('22')).toBeTruthy()
    expect(within(receipt).getByText('17 priced attempts')).toBeTruthy()
  })

  it('gives a free-throw-only appearance a night with no numbers and no season behind it', async () => {
    stubFetch(READY)
    render(<PlayersNightPage team={jazz} route={routeOf('2026-01-03-gsw', 'taylor-hendricks')} />)
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Taylor Hendricks')
    expect(screen.getByText('No priced shot this game, so neither question has a number.')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Good shots?' })).toBeNull()
    expect(screen.queryByRole('img', { name: /shots by/ })).toBeNull()
    expect(screen.getByText(/1 pts on 1/)).toBeTruthy()
    expect(screen.getByText('No shot on file for him this season, so no season page and no chart.')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /His 2025-26 season/ })).toBeNull()
    expect(screen.queryByText(/Priced against/)).toBeNull()
  })

  it('names a player not in the box plainly, and a season not on file without fetching', async () => {
    stubFetch(READY)
    render(<PlayersNightPage team={jazz} route={routeOf('2026-01-03-gsw', 'nobody-here')} />)
    expect(await screen.findByText('No Utah Jazz player nobody-here in the box score for 2026-01-03-gsw.')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /season/ })).toBeNull()
    cleanup()
    const fetch = stubFetch({})
    render(<PlayersNightPage team={jazz} route={routeOf('2024-11-01-lac', 'keyonte-george')} />)
    expect(screen.getByText('No Utah Jazz season on file for 2024-11-01-lac.')).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })
})
