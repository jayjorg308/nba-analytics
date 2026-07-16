// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { codyWilliams as hero } from '../heroes/cody-williams'
import { HeroPage } from './HeroPage'

// under jsdom, import.meta.url is not a file URL — resolve from the vitest
// root (the repo root) instead
const goldenPath = path.resolve(process.cwd(), 'tests/fixtures/derived.golden.json')
const goldenJson = JSON.parse(readFileSync(goldenPath, 'utf-8')) as Record<string, unknown>
// the sibling creation golden — the fixtures reconcile with each other by
// construction (tests/fixtures/README.md), so they stub one coherent hero
const creationGoldenPath = path.resolve(process.cwd(), 'tests/fixtures/creation.golden.json')
const creationGoldenJson = JSON.parse(readFileSync(creationGoldenPath, 'utf-8')) as Record<
  string,
  unknown
>

interface StubResponse {
  ok: boolean
  status?: number
  json?: unknown
}

/** Routes by URL: the page now fetches both payloads (ADR-0030). */
function stubFetch(
  shot: StubResponse,
  creation: StubResponse = { ok: true, json: creationGoldenJson },
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown) => {
      const r = String(url).endsWith('.creation.json') ? creation : shot
      return {
        ok: r.ok,
        status: r.status ?? 200,
        json: async () => r.json,
      }
    }),
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('HeroPage over the golden fixture', () => {
  it('renders loading, then the full evaluated page', async () => {
    stubFetch({ ok: true, json: goldenJson })
    render(<HeroPage hero={hero} />)

    screen.getByText('Loading shot data…')
    await screen.findByText(hero.thesis) // the H1: the v1 question

    // the verdict leads: the authored answer renders directly under the
    // title (ADR-0017; its truthfulness is the verdict guard's job)
    screen.getByText(hero.verdict)

    // drift guard: the DEPLOYED payload and the hero's config module must
    // describe the same hero. Deliberately NOT checked against the golden —
    // that is the hero-independent cross-language contract fixture and stays
    // Cody-derived regardless of which heroes are registered.
    const deployedPath = path.resolve(
      process.cwd(),
      'public',
      'data',
      hero.slug,
      `${hero.season}.json`,
    )
    const deployedMeta = (
      JSON.parse(readFileSync(deployedPath, 'utf-8')) as {
        _meta: { player: string; season: string }
      }
    )._meta
    expect(deployedMeta.player).toBe(hero.playerName)
    expect(deployedMeta.season).toBe(hero.season)

    // headline: league diet from the verbatim league frame (1.09124 -> "1.09"),
    // with the comparison class stated beside the numbers (ADR-0002).
    // Scoped to the stat cells — the creation value chart legitimately
    // prints overlapping figures elsewhere on the page.
    const statValues = [...document.querySelectorAll('.headline-numbers .stat-value')].map(
      (el) => el.textContent,
    )
    expect(statValues).toContain('1.09')
    expect(screen.getAllByText(/vs league average/).length).toBeGreaterThanOrEqual(2)

    // making gets equal billing (ADR-0016): golden actual PPS 17/14 -> "1.21"
    screen.getByRole('heading', { name: /Shot making/i })
    expect(statValues).toContain('1.21')

    // all six golden zones are < 15 attempts -> every row muted, none deleted
    expect(document.querySelectorAll('.zone-row-excluded')).toHaveLength(6)
    screen.getByText(/Zones under 15 attempts are shown muted/)

    // the Restricted Area annotation mirrors the long-two note (both are
    // league value-hierarchy facts; the RA one is guard-asserted)
    screen.getByText(/highest-value shot/)

    // small-sample daggers on making deltas + the footnote
    expect(screen.getAllByText(/†/).length).toBeGreaterThan(1)

    // payoff columns lead, reference trails; FGA stays visible (the honesty
    // anchor for †) and there is deliberately no FG% column (ADR-0001: PPS
    // is the unit; Making Δ already encodes FG%-vs-league)
    const headers = [...document.querySelectorAll('.zone-panel .zone-table thead th')].map(
      (th) => th.textContent,
    )
    expect(headers).toEqual(['Zone', 'FGA', 'Share', 'Lg share', 'Making Δ', 'PPS (lg)'])

    // the verdict-grain parent row (ADR-0016): '3 Pointers' sits between the
    // two-point rows and its three child zone rows
    const rowHeads = [...document.querySelectorAll('.zone-table tbody th')].map(
      (th) => th.textContent,
    )
    expect(rowHeads.indexOf('3 Pointers')).toBeGreaterThan(rowHeads.indexOf('Mid-Range'))
    // child rows drop the "3" — the 3 Pointers parent already carries it
    expect(rowHeads.indexOf('3 Pointers')).toBeLessThan(rowHeads.indexOf('Left Corner'))
    expect(document.querySelectorAll('.zone-panel .zone-row-child')).toHaveLength(3)

    // backcourt reported, never hidden (1 synthetic attempt in the golden)
    screen.getByText(/Backcourt heaves: 1 attempt \(0 made\)/)

    // no zone-point conflicts in the golden -> the ADR-0019 note stays silent
    expect(screen.queryByText(/dropped at derive/)).toBeNull()

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

    // the second act (ADR-0031): creation renders AFTER the court + table,
    // in the section-title recipe, framed as the WHY behind the conversion
    // verdict, comparison class stated plainly
    screen.getByRole('heading', { name: 'SHOT CREATION' })
    screen.getByText(/points per shot by creation context, vs\s+league average/)

    // the value chart: a dumbbell per row (rim + jumper parent, 3 jumper
    // children, 3 clock bands); the golden's zero-attempt 'Other' makes no
    // PPS claim, so it draws a league dot but no player dot
    expect(document.querySelectorAll('.creation-dot-league')).toHaveLength(8)
    expect(document.querySelectorAll('.creation-dot-player')).toHaveLength(7)

    // the creation table: FGA anchors, PPS (lg) — the section's payoff —
    // leads, the diet pair trails as context; no eFG% (ADR-0001)
    const creationTable = screen.getByRole('table', {
      name: /Shot creation by context/,
    })
    const creationHeaders = [...creationTable.querySelectorAll('thead th')].map(
      (th) => th.textContent,
    )
    expect(creationHeaders).toEqual(['Context', 'FGA', 'PPS (lg)', 'Share', 'Lg share'])

    // product display labels over NBA literals ("Pull Ups" / "Less than
    // 10 ft" never render); each label appears twice — chart row and table
    // row, the data twin. The General family is two-tier: rim vs the jumper
    // parent, with catch-vs-dribble refining the jumpers (the intruder-row
    // incoherence of the flat NBA taxonomy, fixed).
    expect(screen.getAllByText('Inside 10 ft')).toHaveLength(2)
    expect(screen.getAllByText('Jumpers (10 ft and out)')).toHaveLength(2)
    expect(screen.getAllByText('Pull-ups')).toHaveLength(2)
    expect(screen.getAllByText('Early (24-15s)')).toHaveLength(2)
    expect(screen.queryByText('Pull Ups')).toBeNull()
    expect(screen.queryByText('Less than 10 ft')).toBeNull()
    screen.getByText(/tracking doesn't classify creation/)

    // the golden's coverage story: 1 unattributed shot-clock attempt is
    // reported (never guessed into a band), and the zero-attempt 'Other'
    // context still renders — a partition is never punctured
    screen.getByText(/1 attempt without shot-clock tracking/)
    expect(screen.getAllByText('Other')).toHaveLength(2)
  })

  it('shades all six zones in the default Zones view despite included=false everywhere', async () => {
    // every golden zone is sub-15 attempts (included: false) — inclusion
    // gates the MIX view only; the making axis is flagged, never suppressed
    // (ADR-0008), so the Zones view shades all six regions
    stubFetch({ ok: true, json: goldenJson })
    render(<HeroPage hero={hero} />)
    await screen.findByText(hero.thesis)

    const fills = document.querySelectorAll('.zone-fill')
    expect(fills).toHaveLength(6)
    expect([...fills].some((f) => f.getAttribute('class')!.includes('nodata'))).toBe(false)
    // all six labels carry the small-sample dagger
    const labels = [...document.querySelectorAll('.zone-label')]
    expect(labels).toHaveLength(6)
    expect(labels.every((l) => l.textContent!.includes('†'))).toBe(true)
    screen.getByText('Shot making vs league average (percentage points)')
  })

  it('shows a descriptive shot tooltip on mouse hover and removes it on leave', async () => {
    stubFetch({ ok: true, json: goldenJson })
    render(<HeroPage hero={hero} />)
    await screen.findByText(hero.thesis)

    fireEvent.click(screen.getByLabelText('Shots')) // dots live in the secondary view
    // first dot in DOM order = first missed shot in payload order:
    // the Mid-Range 17-footer, at Phoenix, Q2 with 7:52 left, Oct 31 2025
    const hit = document.querySelector('.shot-dot .dot-hit')!
    fireEvent.pointerEnter(hit, { pointerType: 'mouse' })
    screen.getByText(/Oct 31, 2025 · @ PHX · Q2 · 7:52/)
    screen.getByText(/Mid-Range — 17 ft/)
    expect(document.querySelector('.shot-tooltip-result')!.textContent).toBe('Missed')

    fireEvent.pointerLeave(hit, { pointerType: 'mouse' })
    expect(document.querySelector('.shot-tooltip')).toBeNull()
  })

  it('opens the zone detail card from the default view and closes on Escape (ADR-0027)', async () => {
    stubFetch({ ok: true, json: goldenJson })
    render(<HeroPage hero={hero} />)
    await screen.findByText(hero.thesis)

    // RA is the topmost fill (painter order); clicking opens its card
    const raFill = [...document.querySelectorAll('.zone-fill')].at(-1)!
    fireEvent.click(raFill)
    const dialog = screen.getByRole('dialog', { name: 'Restricted Area details' })
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('zone-point conflicts (ADR-0019)', () => {
  it('reports dropped rows whenever the payload carries a nonzero count', async () => {
    const withConflict = structuredClone(goldenJson)
    ;(withConflict._meta as { zoneConflictsDropped: number }).zoneConflictsDropped = 1
    stubFetch({ ok: true, json: withConflict })
    render(<HeroPage hero={hero} />)
    await screen.findByText(hero.thesis)
    screen.getByText(/1 shot dropped at derive/)
  })
})

describe('HeroPage failure states', () => {
  it('surfaces HTTP failures', async () => {
    stubFetch({ ok: false, status: 404 })
    render(<HeroPage hero={hero} />)
    await screen.findByText(/HTTP 404 loading shot data/)
  })

  it('surfaces payload contract violations from the Zod boundary', async () => {
    const bad = structuredClone(goldenJson)
    bad.surprise = true // strict schema: unknown key = contract violation
    stubFetch({ ok: true, json: bad })
    render(<HeroPage hero={hero} />)
    await screen.findByText(/Payload contract violation/)
  })

  it('surfaces a missing creation payload — required per hero, no lesser page (ADR-0030)', async () => {
    stubFetch({ ok: true, json: goldenJson }, { ok: false, status: 404 })
    render(<HeroPage hero={hero} />)
    await screen.findByText(/HTTP 404 loading creation data/)
  })

  it('surfaces creation contract violations from the Zod boundary', async () => {
    const bad = structuredClone(creationGoldenJson)
    ;(bad._meta as { seasonFga: number }).seasonFga = 16 // breaks the partition identity
    stubFetch({ ok: true, json: goldenJson }, { ok: true, json: bad })
    render(<HeroPage hero={hero} />)
    await screen.findByText(/Payload contract violation/)
  })
})
