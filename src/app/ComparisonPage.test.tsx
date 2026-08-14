// @vitest-environment jsdom
// The comparison page's component contract (comparison plan, increment 2):
// the setup state's real labeled controls and examples, URL-derived results
// over one or two fetched payloads, the plain page-error contract, and
// distinct per-mode titles. The URL/domain seams have their own tests; this
// file covers what renders.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComparisonPage, ComparisonSetup } from './ComparisonPage'

// under jsdom, import.meta.url is not a file URL — resolve from the vitest
// root (the repo root) instead
const goldenPath = path.resolve(process.cwd(), 'tests/fixtures/derived.golden.json')
const goldenJson = JSON.parse(readFileSync(goldenPath, 'utf-8')) as {
  _meta: Record<string, unknown>
  shots: { gameDate: string; gameId: string }[]
}

/** The golden re-badged per side: the fixture is hero-independent, and the
 * payload's own _meta.player is what the header renders. */
function goldenAs(player: string): unknown {
  const clone = structuredClone(goldenJson) as { _meta: Record<string, unknown> }
  clone._meta.player = player
  return clone
}

interface StubResponse {
  ok: boolean
  status?: number
  json?: unknown
}

function stubFetch(routes: Record<string, StubResponse>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: unknown) => {
      const key = String(url)
      const r = routes[key]
      if (r === undefined) return Promise.reject(new Error(`unexpected fetch ${key}`))
      return Promise.resolve({ ok: r.ok, status: r.status ?? 200, json: async () => r.json })
    }),
  )
}

function setUrl(pathAndQuery: string) {
  window.history.replaceState({}, '', pathAndQuery)
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  setUrl('/')
})

describe('ComparisonPage setup state', () => {
  it('renders labeled controls and the two example links on bare /compare', () => {
    stubFetch({})
    setUrl('/compare')
    render(<ComparisonPage />)

    // Real labels, native controls (plan §1).
    screen.getByLabelText('Players')
    screen.getByLabelText('Before & since')
    screen.getByLabelText('Season')
    screen.getByLabelText('Left player')
    screen.getByLabelText('Right player')
    screen.getByRole('button', { name: 'Swap' })
    screen.getByRole('button', { name: 'Compare' })

    // Bare setup carries the two motivating examples as canonical URLs.
    expect(
      screen
        .getByRole('link', { name: 'Donovan Mitchell vs Jalen Brunson, 2025-26' })
        .getAttribute('href'),
    ).toBe('/compare?mode=players&season=2025-26&left=donovan-mitchell&right=jalen-brunson')
    expect(
      screen
        .getByRole('link', { name: 'Donovan Mitchell, before & since Feb 7, 2026' })
        .getAttribute('href'),
    ).toBe('/compare?mode=split&season=2025-26&player=donovan-mitchell&split=2026-02-07')

    // No metrics and no fetch: the setup state never partially renders.
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    expect(document.title).toBe('Compare · Good Shots')
  })

  it('keeps an invalid URL in setup with its specific message, fetching nothing', () => {
    stubFetch({})
    setUrl('/compare?mode=split&season=2025-26&player=donovan-mitchell&split=2026-02-30')
    render(<ComparisonPage />)

    screen.getByText('"2026-02-30" is not a real date. The split date takes YYYY-MM-DD form.')
    expect(screen.queryByRole('table')).toBeNull()
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })
})

describe('ComparisonPage over the golden fixture', () => {
  it('players mode: loads both payloads and renders the compact header', async () => {
    stubFetch({
      '/data/donovan-mitchell/2025-26.json': { ok: true, json: goldenAs('Left Golden') },
      '/data/jalen-brunson/2025-26.json': { ok: true, json: goldenAs('Right Golden') },
    })
    setUrl('/compare?mode=players&season=2025-26&left=donovan-mitchell&right=jalen-brunson')
    render(<ComparisonPage />)

    screen.getByText('Loading shot data…')
    await screen.findByRole('heading', { name: 'Left Golden vs Right Golden' })

    // Results lead with the comparison itself. Editing stays available in a
    // collapsed disclosure directly below instead of owning the first row.
    const heading = screen.getByRole('heading', { name: 'Left Golden vs Right Golden' })
    const change = screen.getByText('Change comparison')
    expect(heading.compareDocumentPosition(change) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(change.closest('details')?.hasAttribute('open')).toBe(false)
    expect(document.querySelector('main')?.classList.contains('comparison-page-results')).toBe(true)

    // Two payloads fetched, one per side.
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)

    // The ruler is named beside the season (ADR-0074).
    screen.getByText('2025-26 · vs 2025-26 league average')
    // Each side disclosed: label, games, shots, and window boundary — the
    // golden is 15 shots over 6 games through Mar 4, on both sides here.
    expect(screen.getAllByText('6 games · 15 shots')).toHaveLength(2)
    expect(screen.getAllByText('Oct 31, 2025 through Mar 4, 2026')).toHaveLength(2)
    // One small headshot per side (plan §2); the header carries no banner.
    expect(document.querySelectorAll('.comparison-header .comparison-headshot')).toHaveLength(2)

    // The title names the players from the registry, distinctly per mode.
    expect(document.title).toBe('Donovan Mitchell vs Jalen Brunson · 2025-26 · comparison')

    // The integrated two-axis headline (plan §3): both axes present, gap
    // direction named with the side labels. Identical payloads on both
    // sides make every named gap exactly +0.00.
    screen.getByRole('region', { name: 'Shot selection comparison' })
    screen.getByRole('region', { name: 'Shot making comparison' })
    expect(screen.getAllByText('Right Golden minus Left Golden')).toHaveLength(2)
    const gapValues = [...document.querySelectorAll('.comparison-headline .headline-stat')]
      .filter((stat) => stat.textContent!.includes('minus'))
      .map((stat) => stat.querySelector('.stat-value')!.textContent)
    expect(gapValues).toEqual(['+0.00', '+0.00'])
  })

  it('split mode: loads one payload, partitions it, and shows one headshot', async () => {
    stubFetch({
      '/data/donovan-mitchell/2025-26.json': { ok: true, json: goldenAs('Split Golden') },
    })
    setUrl('/compare?mode=split&season=2025-26&player=donovan-mitchell&split=2025-12-07')
    render(<ComparisonPage />)

    await screen.findByRole('heading', { name: 'Split Golden, before & since Dec 7' })
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)

    const before = goldenJson.shots.filter((s) => s.gameDate < '2025-12-07')
    const since = goldenJson.shots.filter((s) => s.gameDate >= '2025-12-07')
    const games = (shots: { gameId: string }[]) => new Set(shots.map((s) => s.gameId)).size
    expect(
      [...document.querySelectorAll('.comparison-side-label')].map((el) => el.textContent),
    ).toEqual(['Before', 'Since'])
    screen.getByText(`${games(before)} games · ${before.length} shots`)
    screen.getByText(`${games(since)} games · ${since.length} shots`)
    // Split mode carries ONE identity: a single headshot beside the h1.
    expect(document.querySelectorAll('.comparison-header .comparison-headshot')).toHaveLength(1)

    expect(document.title).toBe(
      'Donovan Mitchell · 2025-26 · before & since Dec 7, 2025',
    )
  })

  it('headline residuals and named gaps subtract exactly as displayed (ADR-0023)', async () => {
    stubFetch({
      '/data/donovan-mitchell/2025-26.json': { ok: true, json: goldenAs('Split Golden') },
    })
    setUrl('/compare?mode=split&season=2025-26&player=donovan-mitchell&split=2025-12-07')
    render(<ComparisonPage />)
    await screen.findByRole('region', { name: 'Shot selection comparison' })

    // Six visible numbers per the surface: [left, right, gap] per axis. The
    // gap must subtract the two DISPLAYED residuals, in display units.
    const values = [...document.querySelectorAll('.comparison-headline .stat-value')].map((el) =>
      Number(el.textContent!.replace('−', '-')),
    )
    expect(values).toHaveLength(6)
    expect(values.every(Number.isFinite)).toBe(true)
    const cents = (x: number) => Math.round(x * 100)
    const [selLeft, selRight, selGap, mkLeft, mkRight, mkGap] = values as [
      number,
      number,
      number,
      number,
      number,
      number,
    ]
    expect(cents(selRight) - cents(selLeft)).toBe(cents(selGap))
    expect(cents(mkRight) - cents(mkLeft)).toBe(cents(mkGap))

    // The direction is named with the side labels, on both axes.
    expect(screen.getAllByText('Since minus Before')).toHaveLength(2)
    // Supporting anchors: expected-from-diet and actual PPS, per side.
    screen.getByText(/Expected from diet: Before/)
    screen.getByText(/Actual vs expected: Before/)
    // Neutral language: the tool never grades, ranks, or declares a winner
    // (scoped to main — the shared footer tagline says "verdict" by design).
    const mainText = document.querySelector('main')!.textContent!.toLowerCase()
    for (const word of ['verdict', 'winner', 'better', 'worse', 'clutch']) {
      expect(mainText).not.toContain(word)
    }
  })

  it('zone evidence: both panels present, every thin zone in the table, gaps subtract as displayed', async () => {
    stubFetch({
      '/data/donovan-mitchell/2025-26.json': { ok: true, json: goldenAs('Split Golden') },
    })
    setUrl('/compare?mode=split&season=2025-26&player=donovan-mitchell&split=2025-12-07')
    render(<ComparisonPage />)

    // Both axes simultaneously (plan §4).
    await screen.findByRole('img', { name: /Shot diet comparison/ })
    screen.getByRole('img', { name: /Shot making comparison/ })
    screen.getByRole('heading', { name: 'ZONE BY ZONE' })

    // The accessible twin keeps all six zones — the golden's windows are
    // uniformly thin, and a flag never deletes a zone (ADR-0075).
    const table = screen.getByRole('table', { name: /Zone comparison/ })
    const rows = [...table.querySelectorAll('tbody tr')]
    expect(rows).toHaveLength(6)
    for (const zone of [
      'Restricted Area',
      'In The Paint (Non-RA)',
      'Mid-Range',
      'Left Corner 3',
      'Right Corner 3',
      'Above the Break 3',
    ]) {
      within(table).getByRole('rowheader', { name: zone })
    }

    // Every explicit Δ subtracts its two displayed anchors exactly
    // (ADR-0023): share gap vs the displayed shares, making gap vs the
    // displayed making deltas, in tenths of a point.
    const parse = (s: string) => Number(s.replace('†', '').replace('%', '').replace('−', '-'))
    const tenths = (x: number) => Math.round(x * 10)
    for (const tr of rows) {
      const cells = [...tr.querySelectorAll('td')].map((td) => td.textContent!)
      expect(cells).toHaveLength(11)
      const [, , shareL, shareR, , shareGap, , , mkL, mkR, mkGap] = cells as [
        string, string, string, string, string, string,
        string, string, string, string, string,
      ]
      expect(tenths(parse(shareR)) - tenths(parse(shareL))).toBe(tenths(parse(shareGap)))
      if (![mkL, mkR, mkGap].some((c) => c.includes('—'))) {
        expect(tenths(parse(mkR)) - tenths(parse(mkL))).toBe(tenths(parse(mkGap)))
      }
    }

    // A Δ can never read cleaner than its inputs: the golden's windows are
    // all under both bars, so every Δ cell inherits the flag.
    for (const tr of rows) {
      const cells = [...tr.querySelectorAll('td')].map((td) => td.textContent!)
      expect(cells[5], 'share Δ').toMatch(/†$/)
      expect(cells[10], 'making Δ').toMatch(/†$/)
    }

    // The gaps' direction is named with the side labels and both units are
    // named; the flags' meanings are defined where they appear.
    screen.getByText(/Δ columns: Since minus Before, in share points for Share/)
    screen.getByText(/A Δ carries † whenever either of its windows does/)
    screen.getByText(/fewer than 15 attempts in that window/)
    screen.getByText(/fewer than 50 attempts in that window/)
    // The split header states the completeness invariant (ADR-0077): page 2
    // alone proves no game fell between the windows.
    screen.getByText(/Complete windows: every game through/)
    // The golden's one backcourt heave stays reported, never hidden.
    screen.getByText(/Backcourt heaves, excluded from evaluation/)
    expect(screen.getByText(/Swipe horizontally to see every column/).getAttribute('aria-hidden')).toBe(
      'true',
    )
  })

  it('a fetch failure uses the plain page-error contract', async () => {
    stubFetch({
      '/data/donovan-mitchell/2025-26.json': { ok: false, status: 404 },
      '/data/jalen-brunson/2025-26.json': { ok: true, json: goldenAs('Right Golden') },
    })
    setUrl('/compare?mode=players&season=2025-26&left=donovan-mitchell&right=jalen-brunson')
    render(<ComparisonPage />)

    const message = await screen.findByText('HTTP 404 loading comparison shot data')
    expect(message.className).toContain('page-error')
    // No partial metrics beside an error.
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('ComparisonSetup', () => {
  it('a valid submit navigates to the canonical serialized URL', () => {
    const navigate = vi.fn()
    render(<ComparisonSetup initial={{ mode: 'players' }} urlMessage={null} navigate={navigate} />)

    // The shared season defaults to the latest season two heroes carry.
    expect((screen.getByLabelText('Season') as HTMLSelectElement).value).toBe('2025-26')
    expect(document.querySelector('.comparison-fields-players')).not.toBeNull()
    fireEvent.change(screen.getByLabelText('Left player'), {
      target: { value: 'donovan-mitchell' },
    })
    fireEvent.change(screen.getByLabelText('Right player'), {
      target: { value: 'jalen-brunson' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }))
    expect(navigate).toHaveBeenCalledExactlyOnceWith(
      '/compare?mode=players&season=2025-26&left=donovan-mitchell&right=jalen-brunson',
    )
  })

  it('an invalid submit stays put and states the problem', () => {
    const navigate = vi.fn()
    render(<ComparisonSetup initial={{ mode: 'players' }} urlMessage={null} navigate={navigate} />)

    fireEvent.change(screen.getByLabelText('Left player'), {
      target: { value: 'donovan-mitchell' },
    })
    fireEvent.change(screen.getByLabelText('Right player'), {
      target: { value: 'donovan-mitchell' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }))
    expect(navigate).not.toHaveBeenCalled()
    screen.getByText('Pick two different players to compare.')
  })

  it('swap reverses the two sides', () => {
    render(<ComparisonSetup initial={{ mode: 'players' }} urlMessage={null} navigate={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Left player'), {
      target: { value: 'donovan-mitchell' },
    })
    fireEvent.change(screen.getByLabelText('Right player'), {
      target: { value: 'jalen-brunson' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Swap' }))
    expect((screen.getByLabelText('Left player') as HTMLSelectElement).value).toBe('jalen-brunson')
    expect((screen.getByLabelText('Right player') as HTMLSelectElement).value).toBe(
      'donovan-mitchell',
    )
  })

  it('before-and-since mode offers the chosen player’s seasons and submits canonically', () => {
    const navigate = vi.fn()
    render(<ComparisonSetup initial={{ mode: 'players' }} urlMessage={null} navigate={navigate} />)

    fireEvent.click(screen.getByLabelText('Before & since'))
    expect(document.querySelector('.comparison-fields-split')).not.toBeNull()
    // Season waits on the player (never a configuration without registry
    // support, plan §1).
    expect((screen.getByLabelText('Season') as HTMLSelectElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Player'), {
      target: { value: 'donovan-mitchell' },
    })
    const season = screen.getByLabelText('Season') as HTMLSelectElement
    expect(season.disabled).toBe(false)
    expect(season.value).toBe('2025-26')
    fireEvent.change(screen.getByLabelText('Split date'), { target: { value: '2026-02-07' } })
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }))
    expect(navigate).toHaveBeenCalledExactlyOnceWith(
      '/compare?mode=split&season=2025-26&player=donovan-mitchell&split=2026-02-07',
    )
  })

  it('a prefilled HeroPage link preselects its player and season', () => {
    render(
      <ComparisonSetup
        initial={{ mode: 'players', season: '2025-26', left: 'donovan-mitchell' }}
        urlMessage="Pick a right player to compare."
        navigate={vi.fn()}
      />,
    )
    expect((screen.getByLabelText('Left player') as HTMLSelectElement).value).toBe(
      'donovan-mitchell',
    )
    expect((screen.getByLabelText('Right player') as HTMLSelectElement).value).toBe('')
    screen.getByText('Pick a right player to compare.')
  })
})
