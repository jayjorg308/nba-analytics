// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { heroConfig } from '../heroConfig'
import { HeroPage } from './HeroPage'

// under jsdom, import.meta.url is not a file URL — resolve from the vitest
// root (the repo root) instead
const goldenPath = path.resolve(process.cwd(), 'tests/fixtures/derived.golden.json')
const goldenJson = JSON.parse(readFileSync(goldenPath, 'utf-8')) as Record<string, unknown>

function stubFetch(response: { ok: boolean; status?: number; json?: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: response.ok,
      status: response.status ?? 200,
      json: async () => response.json,
    })),
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('HeroPage over the golden fixture', () => {
  it('renders loading, then the full evaluated page', async () => {
    stubFetch({ ok: true, json: goldenJson })
    render(<HeroPage />)

    screen.getByText('Loading shot data…')
    await screen.findByText(heroConfig.thesis) // the H1: the v1 question

    // the verdict leads: the authored answer renders directly under the
    // title (ADR-0017; its truthfulness is the verdict guard's job)
    screen.getByText(heroConfig.verdict)

    // drift guard: the synced payload and heroConfig must describe the same hero
    const meta = goldenJson._meta as { player: string; season: string }
    expect(meta.player).toBe(heroConfig.playerName)
    expect(meta.season).toBe(heroConfig.season)

    // headline: league diet from the verbatim league frame (1.09124 -> "1.09"),
    // with the comparison class stated beside the numbers (ADR-0002)
    screen.getByText('1.09')
    expect(screen.getAllByText(/vs league average/).length).toBeGreaterThanOrEqual(2)

    // making gets equal billing (ADR-0016): golden actual PPS 17/14 -> "1.21",
    // with the combined-threes line carrying its small-sample dagger (6 < 50)
    screen.getByRole('heading', { name: /Shot making/ })
    screen.getByText('1.21')
    screen.getByText(/From three: 50\.0%† on 6 attempts/)

    // all six golden zones are < 15 attempts -> every row muted, none deleted
    expect(document.querySelectorAll('.zone-row-excluded')).toHaveLength(6)
    screen.getByText(/Zones under 15 attempts are shown muted/)

    // small-sample daggers on making deltas + the footnote
    expect(screen.getAllByText(/†/).length).toBeGreaterThan(1)

    // payoff columns lead, reference trails; FGA stays visible (the honesty
    // anchor for †) and there is deliberately no FG% column (ADR-0001: PPS
    // is the unit; Making Δ already encodes FG%-vs-league)
    const headers = [...document.querySelectorAll('.zone-table thead th')].map(
      (th) => th.textContent,
    )
    expect(headers).toEqual(['Zone', 'FGA', 'Share', 'Lg share', 'Making Δ', 'PPS (lg)'])

    // backcourt reported, never hidden (1 synthetic attempt in the golden)
    screen.getByText(/Backcourt heaves: 1 attempt \(0 made\)/)

    // both hero refinements below their volume gates -> hidden
    expect(screen.queryByText(/8-16 ft/)).toBeNull()
    expect(screen.queryByText(/Corner 3s:/)).toBeNull()

    // the court defaults to the Zones view — the argument leads; the raw
    // scatter is the secondary tab
    expect((screen.getByLabelText('Zones') as HTMLInputElement).checked).toBe(true)
    expect(document.querySelectorAll('.zone-fill')).toHaveLength(6)

    // Shots view: 14 dots (the backcourt heave is off-frame and skipped, with caption)
    fireEvent.click(screen.getByLabelText('Shots'))
    expect(document.querySelectorAll('.shot-dot')).toHaveLength(14)
    screen.getByText(/1 shot beyond half-court not shown/)
  })

  it('shades all six zones in the default Zones view despite included=false everywhere', async () => {
    // every golden zone is sub-15 attempts (included: false) — inclusion
    // gates the MIX view only; the making axis is flagged, never suppressed
    // (ADR-0008), so the Zones view shades all six regions
    stubFetch({ ok: true, json: goldenJson })
    render(<HeroPage />)
    await screen.findByText(heroConfig.thesis)

    const fills = document.querySelectorAll('.zone-fill')
    expect(fills).toHaveLength(6)
    expect([...fills].some((f) => f.getAttribute('class')!.includes('nodata'))).toBe(false)
    // all six labels carry the small-sample dagger
    const labels = [...document.querySelectorAll('.zone-label')]
    expect(labels).toHaveLength(6)
    expect(labels.every((l) => l.textContent!.includes('†'))).toBe(true)
    screen.getByText('Shot making vs league average (percentage points)')
  })

  it('shows a descriptive tooltip on hover and removes it on leave', async () => {
    stubFetch({ ok: true, json: goldenJson })
    render(<HeroPage />)
    await screen.findByText(heroConfig.thesis)

    fireEvent.click(screen.getByLabelText('Shots')) // dots live in the secondary view
    // first dot in DOM order = first missed shot in payload order:
    // the Mid-Range 17-footer, Q2 with 7:52 left, Oct 31 2025
    const hit = document.querySelector('.shot-dot .dot-hit')!
    fireEvent.pointerEnter(hit)
    screen.getByText(/Oct 31, 2025 · Q2 · 7:52/)
    screen.getByText(/Mid-Range — 17 ft/)
    expect(document.querySelector('.shot-tooltip-result')!.textContent).toBe('Missed')

    fireEvent.pointerLeave(hit)
    expect(document.querySelector('.shot-tooltip')).toBeNull()
  })
})

describe('HeroPage failure states', () => {
  it('surfaces HTTP failures', async () => {
    stubFetch({ ok: false, status: 404 })
    render(<HeroPage />)
    await screen.findByText(/HTTP 404 loading shot data/)
  })

  it('surfaces payload contract violations from the Zod boundary', async () => {
    const bad = structuredClone(goldenJson)
    bad.surprise = true // strict schema: unknown key = contract violation
    stubFetch({ ok: true, json: bad })
    render(<HeroPage />)
    await screen.findByText(/Payload contract violation/)
  })
})
