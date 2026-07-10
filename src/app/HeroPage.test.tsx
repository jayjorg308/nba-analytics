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

    // drift guard: the synced payload and heroConfig must describe the same hero
    const meta = goldenJson._meta as { player: string; season: string }
    expect(meta.player).toBe(heroConfig.playerName)
    expect(meta.season).toBe(heroConfig.season)

    // headline: league diet from the verbatim league frame (1.09124 -> "1.09"),
    // with the comparison class stated beside the numbers (ADR-0002)
    screen.getByText('1.09')
    expect(screen.getAllByText(/vs league average/).length).toBeGreaterThanOrEqual(2)

    // all six golden zones are < 15 attempts -> every row muted, none deleted
    expect(document.querySelectorAll('.zone-row-excluded')).toHaveLength(6)
    screen.getByText(/Zones under 15 attempts are shown muted/)

    // small-sample daggers on making deltas + the footnote
    expect(screen.getAllByText(/†/).length).toBeGreaterThan(1)

    // backcourt reported, never hidden (1 synthetic attempt in the golden)
    screen.getByText(/Backcourt heaves: 1 attempt \(0 made\)/)

    // both hero refinements below their volume gates -> hidden
    expect(screen.queryByText(/8-16 ft/)).toBeNull()
    expect(screen.queryByText(/Corner 3s:/)).toBeNull()

    // chart: 14 dots (the backcourt heave is off-frame and skipped, with caption)
    expect(document.querySelectorAll('.shot-dot')).toHaveLength(14)
    screen.getByText(/1 shot beyond half-court not shown/)
  })

  it('shows a descriptive tooltip on hover and removes it on leave', async () => {
    stubFetch({ ok: true, json: goldenJson })
    render(<HeroPage />)
    await screen.findByText(heroConfig.thesis)

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
