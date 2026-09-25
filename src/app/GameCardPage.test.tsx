// @vitest-environment jsdom
// The game card and landing components (ADR-0086): the poster's three
// numbers and chips from a fetched game-log payload, the receipt drill-in
// (technical line included), the unknown-date and plain error contracts,
// and the landing's roster list.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameCardPage } from './GameCardPage'
import { GameLandingPage } from './GameLandingPage'

const goldenJson = JSON.parse(
  readFileSync(path.resolve(process.cwd(), 'tests/fixtures/gamelog.golden.json'), 'utf-8'),
) as { games: { date: string; shots: unknown[]; trips: unknown[] }[] }

function stubFetch(routes: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: unknown) => {
      const r = routes[String(url)]
      if (r === undefined) return Promise.reject(new Error(`unexpected fetch ${String(url)}`))
      return Promise.resolve({ ok: true, status: 200, json: async () => r })
    }),
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const GOLDEN_DATE = goldenJson.games[0]!.date

describe('GameCardPage', () => {
  it('renders the poster, chips, and stance from the payload', async () => {
    stubFetch({ '/data/games/cody-williams/2025-26.json': goldenJson })
    render(<GameCardPage slug="cody-williams" date={GOLDEN_DATE} />)
    await screen.findByRole('heading', { name: 'Cody Williams' })
    screen.getByText('scored on those attempts')
    screen.getByText('conversion vs his diet')
    screen.getByText(/THE LINE/)
    screen.getByText(/THE CREDIT/)
    screen.getByText(/not an ability estimate/)
  })

  it('drills into the receipt, technical free throws itemized, count exact', async () => {
    stubFetch({ '/data/games/cody-williams/2025-26.json': goldenJson })
    render(<GameCardPage slug="cody-williams" date={GOLDEN_DATE} />)
    const game = goldenJson.games[0]!
    // The label counts exactly the lines the receipt renders: shots, trips,
    // and the technical line when present.
    const lines = game.shots.length + game.trips.length + 1 // fixture has a technical
    const drill = await screen.findByRole('button', {
      name: `the night in game order (${lines} lines)`,
    })
    fireEvent.click(drill)
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(lines + 2) // + header and total rows
    screen.getByText('game total')
    // The fixture game carries the missed technical (freethrow golden's
    // scenario): the receipt line keeps the box reconciling visibly.
    screen.getByText(/technical free throws/)
    screen.getByRole('button', { name: 'close the receipt' })
  })

  it('handles a date with no game as a plain error with ways out', async () => {
    stubFetch({ '/data/games/cody-williams/2025-26.json': goldenJson })
    render(<GameCardPage slug="cody-williams" date="2026-01-01" />)
    await screen.findByText(/No Cody Williams game on/)
    screen.getByRole('link', { name: 'His latest game card' })
    screen.getByRole('link', { name: 'all game cards' })
  })

  it('surfaces a missing file as the plain page error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 404, json: async () => ({}) })),
    )
    render(<GameCardPage slug="nobody" date="2026-01-01" />)
    await screen.findByText(/HTTP 404/)
  })
})

describe('GameLandingPage', () => {
  it('lists the roster with latest-card links', async () => {
    stubFetch({
      '/data/games/index.json': {
        rosters: [
          {
            slug: 'cody-williams',
            player: 'Cody Williams',
            season: '2025-26',
            totalGames: 62,
            dataThrough: '2026-04-12',
          },
        ],
      },
    })
    render(<GameLandingPage />)
    const link = await screen.findByRole('link', { name: 'Cody Williams' })
    expect(link.getAttribute('href')).toBe('/game/cody-williams/2026-04-12')
    screen.getByText(/62 games/)
  })
})
