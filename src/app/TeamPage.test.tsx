// @vitest-environment jsdom
// The team surface's component contract (ADR-0081/0084): the three team
// files fetched (shot payload, ledger, season index), the tool header and
// byline, the headline pair in the team's voice, the ledger newest-first
// with a report card link, and the plain error contract. What renders, over
// the team goldens (the report card has its own file).

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { indexFromLedger } from '../domain/indexFromLedger.testutil'
import { parseLedgerFacts } from '../domain/ledgerFacts'
import { parseTeamShotPayload } from '../domain/teamShotPayload'
import { utahJazz } from '../teams/registry'
import { TeamPage } from './TeamPage'

// under jsdom, import.meta.url is not a file URL — resolve from the repo root
const read = (rel: string) =>
  JSON.parse(readFileSync(path.resolve(process.cwd(), rel), 'utf-8')) as unknown
const teamGolden = read('tests/fixtures/team-shot.golden.json')
const ledgerGolden = read('tests/fixtures/team-ledger.golden.json')
const indexGolden = indexFromLedger(parseTeamShotPayload(teamGolden), parseLedgerFacts(ledgerGolden))

const PAYLOAD_URL = '/data/_teams/uta/2025-26.json'
const LEDGER_URL = '/data/_teams/uta/2025-26.ledger.json'
const INDEX_URL = '/data/_teams/uta/2025-26/index.json'
const INDEX = { [INDEX_URL]: { ok: true, json: indexGolden } }

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

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('TeamPage', () => {
  it('renders the tool header, the frontier byline, the headline pair, and the ledger', async () => {
    stubFetch({ [PAYLOAD_URL]: { ok: true, json: teamGolden }, [LEDGER_URL]: { ok: true, json: ledgerGolden }, ...INDEX })
    render(<TeamPage team={utahJazz} season="2025-26" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Utah Jazz shot profile' })).toBeTruthy()
    expect(screen.getByText(/through .*Oct 31.*1 game.*81 shots.*vs 2025-26 league average/)).toBeTruthy()
    // The headline pair speaks in the team's voice, not a player's.
    expect(screen.getAllByText('expected from their diet').length).toBe(2)
    expect(screen.getByText('they scored')).toBeTruthy()
    expect(screen.queryByText(/expected from his diet/)).toBeNull()
    // No verdict, no thesis question, no banner cue.
    expect(screen.queryByText(/The verdict/)).toBeNull()
    expect(screen.queryByText(/taking good shots/)).toBeNull()
    // A team season's Shots view has no per-shot tooltips, so no hover cue
    // (player pages keep both; ChartPanel.test covers the mechanics).
    expect(screen.queryByText(/Hover over any shot/)).toBeNull()
    const ledger = screen.getByRole('table', { name: 'Game ledger, newest first' })
    const rows = within(ledger).getAllByRole('row')
    expect(rows).toHaveLength(2) // header + one game
    expect(within(ledger).getByText('@ PHX')).toBeTruthy()
    expect(within(ledger).getByText('L 96–118')).toBeTruthy()
    expect(within(ledger).getByRole('link', { name: /Oct 31/ }).getAttribute('href')).toBe(
      '/jazz/2025-10-31-phx',
    )
    expect(document.title).toBe('Utah Jazz · 2025-26 · shot profile')
  })

  it('surfaces a ledger contract violation plainly, never a partial page', async () => {
    const broken = structuredClone(ledgerGolden) as { _meta: Record<string, unknown> }
    broken._meta.gamesIncluded = 7
    stubFetch({ [PAYLOAD_URL]: { ok: true, json: teamGolden }, [LEDGER_URL]: { ok: true, json: broken }, ...INDEX })
    render(<TeamPage team={utahJazz} season="2025-26" />)
    expect(await screen.findByText(/Payload contract violation/)).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
  })

  it('surfaces a missing team payload as a plain HTTP error', async () => {
    stubFetch({ [PAYLOAD_URL]: { ok: false, status: 404 }, [LEDGER_URL]: { ok: true, json: ledgerGolden }, ...INDEX })
    render(<TeamPage team={utahJazz} season="2025-26" />)
    expect(await screen.findByText('HTTP 404 loading team shot data')).toBeTruthy()
  })
})
