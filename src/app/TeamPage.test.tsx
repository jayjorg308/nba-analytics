// @vitest-environment jsdom
// A team season's home (ADR-0087): the two team files fetched (the shot
// payload and the season index; the ledger file is retired), the name-led
// season banner, the latest game's tile with its card's words, the featured
// cards (a priced player's numbers and flag, a player with no shot yet named
// but unlinked, each with his argument's status line), the rail, the season
// pair and the ledger read from the index, the arguments section, and the
// plain error contract. Over the game and index goldens (the fixture game
// 0022500492, a 2025-26 game).

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseGamePayload } from '../domain/gamePayload'
import { teamPayloadFromGame } from '../domain/teamPayloadFromGame.testutil'
import { utahJazz } from '../teams/registry'
import type { TeamConfig } from '../teams/registry'
import { TeamPage } from './TeamPage'

// Pinned to the season the fixture was cut from: the registry's canonical
// season and featured lists move every year.
const jazz: TeamConfig = {
  ...utahJazz,
  seasons: ['2025-26'],
  canonicalSeason: '2025-26',
  homes: {
    '2025-26': {
      featured: [
        { slug: 'keyonte-george', playerName: 'Keyonte George' },
        { slug: 'darryn-peterson', playerName: 'Darryn Peterson' },
      ],
    },
  },
}

// under jsdom, import.meta.url is not a file URL — resolve from the repo root
const read = (rel: string) => JSON.parse(readFileSync(path.resolve(process.cwd(), rel), 'utf-8')) as unknown
const indexJson = read('tests/fixtures/team-index.golden.json')
const payloadJson = teamPayloadFromGame(parseGamePayload(read('tests/fixtures/game.golden.json')))

const PAYLOAD_URL = '/data/_teams/uta/2025-26.json'
const INDEX_URL = '/data/_teams/uta/2025-26/index.json'

function stubFetch(routes: Record<string, { ok: boolean; status?: number; json?: unknown }>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: unknown) => {
      const r = routes[String(url)]
      if (r === undefined) return Promise.reject(new Error(`unexpected fetch ${String(url)}`))
      return Promise.resolve({ ok: r.ok, status: r.status ?? 200, json: async () => r.json })
    }),
  )
}

const READY = {
  [PAYLOAD_URL]: { ok: true, json: payloadJson },
  [INDEX_URL]: { ok: true, json: indexJson },
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('TeamPage (a team season’s home)', () => {
  it('opens on the name-led season banner, true every day', async () => {
    stubFetch(READY)
    render(<TeamPage team={jazz} season="2025-26" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Utah Jazz' })).toBeTruthy()
    expect(screen.getByText('2025-26 · through Jan 3 · 1 game')).toBeTruthy()
    expect(screen.getByText('↓ The latest game')).toBeTruthy()
    expect(document.title).toBe('Utah Jazz · 2025-26 · Good Shots')
    // No verdict and no thesis question on a tool page.
    expect(screen.queryByText(/The verdict/)).toBeNull()
    expect(screen.queryByText(/taking good shots/)).toBeNull()
  })

  it('features the latest game as a tile carrying its card’s score, title, and two answers', async () => {
    stubFetch(READY)
    render(<TeamPage team={jazz} season="2025-26" />)
    const tile = (await screen.findByText('L 30–39', { selector: '.home-feature-score' })).closest('a')!
    expect(tile.getAttribute('href')).toBe('/jazz/2026-01-03-gsw')
    expect(within(tile).getByText('Good shots?')).toBeTruthy()
    expect(within(tile).getByText('Did they fall?')).toBeTruthy()
    expect(within(tile).getByText(/priced shots$/)).toBeTruthy()
    // One game: nothing before it.
    expect(screen.queryByText(/before$/)).toBeNull()
  })

  it('features each player: a priced card links his page, a player with no shot is named, unlinked', async () => {
    stubFetch(READY)
    render(<TeamPage team={jazz} season="2025-26" />)
    expect(await screen.findByRole('heading', { level: 2, name: 'THE TWO' })).toBeTruthy()
    const george = screen.getByText('Keyonte George', { selector: '.home-card-name' }).closest('a')!
    expect(george.getAttribute('href')).toBe('/jazz/keyonte-george')
    expect(within(george).getByText(/1 game · \d+ priced shots/)).toBeTruthy()
    // His conversion carries the flag below the bar, explained once.
    expect(within(george).getByText(/†$/)).toBeTruthy()
    expect(screen.getByText(/† conversion on fewer than 50 priced shots/)).toBeTruthy()
    expect(within(george).getByText('2025-26 argument published')).toBeTruthy()
    const peterson = screen.getByText('Darryn Peterson', { selector: '.home-card-name' }).closest('.home-card')!
    expect(peterson.tagName).toBe('DIV')
    expect(within(peterson as HTMLElement).getByText('No shots yet')).toBeTruthy()
    expect(within(peterson as HTMLElement).getByText('No 2025-26 argument yet')).toBeTruthy()
    // Everyone else with a shot is in the rail; a player with free throws
    // alone has no page, so no name.
    expect(screen.getByRole('link', { name: 'Kyle Filipowski' }).getAttribute('href')).toBe('/jazz/kyle-filipowski')
    expect(screen.queryByRole('link', { name: 'Taylor Hendricks' })).toBeNull()
  })

  it('carries the season pair in the team’s voice and the ledger read from the index', async () => {
    stubFetch(READY)
    render(<TeamPage team={jazz} season="2025-26" />)
    const ledger = await screen.findByRole('table', { name: 'Game ledger, newest first' })
    expect(screen.getAllByText('expected from their diet').length).toBe(2)
    expect(screen.queryByText(/expected from his diet/)).toBeNull()
    const rows = within(ledger).getAllByRole('row')
    expect(rows).toHaveLength(2) // header + one game
    expect(within(ledger).getByText('@ GSW')).toBeTruthy()
    expect(within(ledger).getByText('L 30–39')).toBeTruthy()
    expect(within(ledger).getByText('10–21')).toBeTruthy() // the index row's box FG
    expect(within(ledger).getByRole('link', { name: /Jan 3/ }).getAttribute('href')).toBe('/jazz/2026-01-03-gsw')
  })

  it('closes on the arguments, the home team’s first, and links the directory', async () => {
    stubFetch(READY)
    render(<TeamPage team={jazz} season="2025-26" />)
    const section = (await screen.findByRole('heading', { level: 2, name: 'ARGUMENTS' })).closest('section')!
    const links = within(section).getAllByRole('link')
    expect(links[0]!.getAttribute('href')).toBe('/cody-williams')
    expect(within(section).getByRole('link', { name: 'All arguments →' }).getAttribute('href')).toBe('/arguments')
    // The footer carries both utilities: the home is not the directory.
    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByRole('link', { name: 'Arguments' }).getAttribute('href')).toBe('/arguments')
    expect(within(footer).getByRole('link', { name: 'Methodology' })).toBeTruthy()
  })

  it('surfaces an index contract violation plainly, never a partial page', async () => {
    const broken = structuredClone(indexJson) as { _meta: Record<string, unknown> }
    broken._meta.gamesIncluded = 7
    stubFetch({ ...READY, [INDEX_URL]: { ok: true, json: broken } })
    render(<TeamPage team={jazz} season="2025-26" />)
    expect(await screen.findByText(/Payload contract violation/)).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
  })

  it('surfaces a missing team payload as a plain HTTP error', async () => {
    stubFetch({ ...READY, [PAYLOAD_URL]: { ok: false, status: 404 } })
    render(<TeamPage team={jazz} season="2025-26" />)
    expect(await screen.findByText('HTTP 404 loading team shot data')).toBeTruthy()
  })
})
