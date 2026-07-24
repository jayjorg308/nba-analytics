// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { codyWilliams as hero } from '../heroes/cody-williams'
import { canonicalSeasonOf, type HeroConfig } from '../heroes/types'
import { HeroPage } from './HeroPage'

// The season argument under test: the canonical one (ADR-0060) — the page
// /cody-williams renders.
const seasonConfig = canonicalSeasonOf(hero)

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
const contextGoldenPath = path.resolve(process.cwd(), 'tests/fixtures/shot-context.golden.json')
const contextGoldenJson = JSON.parse(readFileSync(contextGoldenPath, 'utf-8')) as Record<
  string,
  unknown
>
const freethrowGoldenPath = path.resolve(process.cwd(), 'tests/fixtures/freethrow.golden.json')
const freethrowGoldenJson = JSON.parse(readFileSync(freethrowGoldenPath, 'utf-8')) as Record<
  string,
  unknown
>

interface StubResponse {
  ok: boolean
  status?: number
  json?: unknown
}

/** Routes by URL: the page fetches all four payloads (ADRs 0030/0032/0053). */
function stubFetch(
  shot: StubResponse,
  creation: StubResponse = { ok: true, json: creationGoldenJson },
  context: StubResponse = { ok: true, json: contextGoldenJson },
  freethrow: StubResponse = { ok: true, json: freethrowGoldenJson },
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown) => {
      const value = String(url)
      const r = value.endsWith('.creation.json')
        ? creation
        : value.endsWith('.context.json')
          ? context
          : value.endsWith('.freethrow.json')
            ? freethrow
            : shot
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
    render(<HeroPage hero={hero} seasonConfig={seasonConfig} />)

    screen.getByText('Loading shot data…')
    await screen.findByText(hero.thesis) // the H1: the v1 question

    // the verdict leads: the authored answer renders directly under the
    // title (ADR-0017; its truthfulness is the verdict guard's job)
    screen.getByText(seasonConfig.verdict)

    // drift guard: the DEPLOYED payload and the hero's config module must
    // describe the same hero. Deliberately NOT checked against the golden —
    // that is the hero-independent cross-language contract fixture and stays
    // Cody-derived regardless of which heroes are registered.
    const deployedPath = path.resolve(
      process.cwd(),
      'public',
      'data',
      hero.slug,
      `${seasonConfig.season}.json`,
    )
    const deployedMeta = (
      JSON.parse(readFileSync(deployedPath, 'utf-8')) as {
        _meta: { player: string; season: string }
      }
    )._meta
    expect(deployedMeta.player).toBe(hero.playerName)
    expect(deployedMeta.season).toBe(seasonConfig.season)

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

    // the first act opens in the shared section recipe (ADR-0051) and the
    // table names itself — the h2 stopped being the table's caption
    screen.getByRole('heading', { name: 'ZONE BY ZONE' })

    // the act kickers name the argument's beats in reading order (ADR-0051
    // amendment; 03 is the full third beat per the ADR-0042 amendment) —
    // structural copy, identical for every hero
    const kickers = [...document.querySelectorAll('.section-kicker')].map(
      (el) => el.textContent,
    )
    expect(kickers).toEqual([
      '01 · THE WHERE',
      '02 · THE HOW',
      '03 · THE CREDIT',
      '04 · THE LINE',
    ])
    const zoneTable = screen.getByRole('table', {
      name: /Zone by zone shot diet and shot making/,
    })

    // payoff columns lead, reference trails; FGA stays visible (the honesty
    // anchor for †) and there is deliberately no FG% column (ADR-0001: PPS
    // is the unit; Making Δ already encodes FG%-vs-league)
    const headers = [...zoneTable.querySelectorAll('thead th')].map((th) => th.textContent)
    expect(headers).toEqual(['Zone', 'FGA', 'Share', 'Lg share', 'Making Δ', 'PPS (lg)'])

    // the verdict-grain parent row (ADR-0016): '3 Pointers' sits between the
    // two-point rows and its three child zone rows
    const rowHeads = [...zoneTable.querySelectorAll('tbody th')].map((th) => th.textContent)
    expect(rowHeads.indexOf('3 Pointers')).toBeGreaterThan(rowHeads.indexOf('Mid-Range'))
    // child rows drop the "3" — the 3 Pointers parent already carries it
    expect(rowHeads.indexOf('3 Pointers')).toBeLessThan(rowHeads.indexOf('Left Corner'))
    expect(zoneTable.querySelectorAll('.zone-row-child')).toHaveLength(3)

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
    // whole-sentence check via textContent: the dictionary term inside the
    // sentence (ADR-0052) splits the text nodes getByText matches on
    const captionDescs = [...document.querySelectorAll('.section-caption-desc')].map((el) =>
      el.textContent!.replace(/\s+/g, ' ').trim(),
    )
    expect(captionDescs).toContain(
      'why his conversion lands where it does: points per shot by creation context, vs league average',
    )

    // the value chart: a row per charted context (rim + jumper parent, the
    // 2 real jumper children, 3 clock bands, 3 defender bands — the Other
    // residual is table-only, ADR-0031 amendment); every golden context sits
    // under the dot floor, so each row draws its league dot and no player
    // dot — the table carries the numbers, and the notes disclose both.
    // Scoped to the creation section: THE LINE act reuses the shared
    // dumbbell classes for its own dots (ADR-0056).
    expect(document.querySelectorAll('.creation-section .creation-dot-league')).toHaveLength(10)
    expect(document.querySelectorAll('.creation-section .creation-dot-player')).toHaveLength(0)
    screen.getByText(/draw no PPS dot in the chart/)
    screen.getByText(/the jumper parent includes its attempts/)

    // the defender family (v2.1): third group in chart and table
    expect(screen.getAllByText('Wide open (6+ ft)')).toHaveLength(2)

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

    // the three-arrival bridge annotates BOTH jumper-kind rows (the
    // band-note pattern): which KIND of three the verdict is about, with the
    // split verifiable from both ends
    screen.getByText('3 of his 4 threes')
    screen.getByText('1 of his 4 threes')

    // the golden's coverage story: 1 unattributed shot-clock attempt and 2
    // unattributed defender attempts are reported (never guessed into a
    // band), and the 'Other' context still renders in the TABLE — the
    // partition display is never punctured; only the chart declines its row
    screen.getByText(/1 attempt without shot-clock tracking/)
    screen.getByText(/2 attempts without defender tracking/)
    expect(screen.getAllByText('Other')).toHaveLength(1)

    // Case 3 follows the creation evidence: bounded assist shares plus the
    // existing zone hierarchy, with unknown makes explicit.
    screen.getByRole('heading', { name: 'ASSISTED MAKES' })
    screen.getByRole('img', { name: /Assisted-share bounds/i })
    screen.getByRole('table', { name: /Assisted makes by shooting area/i })
    screen.getByText(/not necessarily self-created/i)
  })

  it('shades all six zones in the default Zones view despite included=false everywhere', async () => {
    // every golden zone is sub-15 attempts (included: false) — inclusion
    // gates the MIX view only; the making axis is flagged, never suppressed
    // (ADR-0008), so the Zones view shades all six regions
    stubFetch({ ok: true, json: goldenJson })
    render(<HeroPage hero={hero} seasonConfig={seasonConfig} />)
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
    render(<HeroPage hero={hero} seasonConfig={seasonConfig} />)
    await screen.findByText(hero.thesis)

    fireEvent.click(screen.getByLabelText('Shots')) // dots live in the secondary view
    // first dot in DOM order = first missed shot in payload order:
    // the Mid-Range 17-footer, at Phoenix, Q2 with 7:52 left, Oct 31 2025
    const hit = document.querySelector('.shot-dot .dot-hit')!
    fireEvent.pointerEnter(hit, { pointerType: 'mouse' })
    screen.getByText(/Oct 31, 2025 · @ PHX · Q2 · 7:52/)
    screen.getByText(/Mid-Range · 17 ft/)
    expect(document.querySelector('.shot-tooltip-result')!.textContent).toBe('Missed')
    expect(document.querySelector('.shot-tooltip-assist')).toBeNull()

    fireEvent.pointerLeave(hit, { pointerType: 'mouse' })
    expect(document.querySelector('.shot-tooltip')).toBeNull()

    // Misses sort first; the first made dot is Cody's assisted action 480.
    const firstMade = document.querySelectorAll('.shot-dot .dot-hit')[7]!
    fireEvent.pointerEnter(firstMade, { pointerType: 'mouse' })
    expect(document.querySelector('.shot-tooltip-assist')!.textContent).toBe('Assisted')
  })

  it('defines jargon in place: dictionary terms open a popover (ADR-0052)', async () => {
    stubFetch({ ok: true, json: goldenJson })
    render(<HeroPage hero={hero} seasonConfig={seasonConfig} />)
    await screen.findByText(hero.thesis)

    // prose defines a term ONCE, at its first reading-order mention (the
    // headline subtitle) — the zone act's description leaves it plain
    const trigger = screen.getByRole('button', { name: 'shot diet' })
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Shot diet definition' })
    expect(dialog.textContent).toContain('The raw material of shot selection')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()

    // the tables' stat headers are terms too, without changing the header text
    const zoneTable = screen.getByRole('table', {
      name: /Zone by zone shot diet and shot making/,
    })
    const headers = [...zoneTable.querySelectorAll('thead th')].map((th) => th.textContent)
    expect(headers).toEqual(['Zone', 'FGA', 'Share', 'Lg share', 'Making Δ', 'PPS (lg)'])
    fireEvent.click(screen.getAllByRole('button', { name: 'Making Δ' })[0]!)
    screen.getByRole('dialog', { name: 'Making Δ definition' })
    fireEvent.click(screen.getByRole('button', { name: 'Close definition' }))

    // the creation contexts a general reader won't know are terms in the table
    fireEvent.click(screen.getByRole('button', { name: 'Catch and shoot' }))
    screen.getByRole('dialog', { name: 'Catch and shoot definition' })
  })

  it('opens the zone detail card from the default view and closes on Escape (ADR-0027)', async () => {
    stubFetch({ ok: true, json: goldenJson })
    render(<HeroPage hero={hero} seasonConfig={seasonConfig} />)
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
    render(<HeroPage hero={hero} seasonConfig={seasonConfig} />)
    await screen.findByText(hero.thesis)
    screen.getByText(/1 shot dropped at derive/)
  })
})

describe('HeroPage failure states', () => {
  it('surfaces HTTP failures', async () => {
    stubFetch({ ok: false, status: 404 })
    render(<HeroPage hero={hero} seasonConfig={seasonConfig} />)
    await screen.findByText(/HTTP 404 loading shot data/)
  })

  it('surfaces payload contract violations from the Zod boundary', async () => {
    const bad = structuredClone(goldenJson)
    bad.surprise = true // strict schema: unknown key = contract violation
    stubFetch({ ok: true, json: bad })
    render(<HeroPage hero={hero} seasonConfig={seasonConfig} />)
    await screen.findByText(/Payload contract violation/)
  })

  it('surfaces a missing creation payload — required per hero, no lesser page (ADR-0030)', async () => {
    stubFetch({ ok: true, json: goldenJson }, { ok: false, status: 404 })
    render(<HeroPage hero={hero} seasonConfig={seasonConfig} />)
    await screen.findByText(/HTTP 404 loading creation data/)
  })

  it('surfaces creation contract violations from the Zod boundary', async () => {
    const bad = structuredClone(creationGoldenJson)
    ;(bad._meta as { seasonFga: number }).seasonFga = 16 // breaks the partition identity
    stubFetch({ ok: true, json: goldenJson }, { ok: true, json: bad })
    render(<HeroPage hero={hero} seasonConfig={seasonConfig} />)
    await screen.findByText(/Payload contract violation/)
  })

  it('surfaces a missing shot-context payload — required per hero', async () => {
    stubFetch(
      { ok: true, json: goldenJson },
      { ok: true, json: creationGoldenJson },
      { ok: false, status: 404 },
    )
    render(<HeroPage hero={hero} seasonConfig={seasonConfig} />)
    await screen.findByText(/HTTP 404 loading shot context data/)
  })

  it('surfaces cross-sibling identity contradictions plainly', async () => {
    const badContext = structuredClone(contextGoldenJson)
    ;(badContext._meta as { player: string }).player = 'Different Player'
    stubFetch(
      { ok: true, json: goldenJson },
      { ok: true, json: creationGoldenJson },
      { ok: true, json: badContext },
    )
    render(<HeroPage hero={hero} seasonConfig={seasonConfig} />)
    await screen.findByText(/Payloads contradict: shot-context sibling player\/season identity/i)
  })

  it('surfaces a missing free-throw payload — required per hero (ADR-0053)', async () => {
    stubFetch(
      { ok: true, json: goldenJson },
      { ok: true, json: creationGoldenJson },
      { ok: true, json: contextGoldenJson },
      { ok: false, status: 404 },
    )
    render(<HeroPage hero={hero} seasonConfig={seasonConfig} />)
    await screen.findByText(/HTTP 404 loading free throw data/)
  })

  it('surfaces free-throw contract violations from the Zod boundary', async () => {
    const bad = structuredClone(freethrowGoldenJson)
    ;(bad._meta as { seasonFta: number }).seasonFta = 7 // breaks the sum identity
    stubFetch(
      { ok: true, json: goldenJson },
      { ok: true, json: creationGoldenJson },
      { ok: true, json: contextGoldenJson },
      { ok: true, json: bad },
    )
    render(<HeroPage hero={hero} seasonConfig={seasonConfig} />)
    await screen.findByText(/Payload contract violation/)
  })
})

describe('season arguments (ADR-0060)', () => {
  // A two-season fixture hero: the golden-backed copy behind both seasons,
  // canonical on the later one — the shape Ace's flip PR will create. The
  // config is fixture COPY; the payloads behind both seasons' fetches stay
  // the real goldens.
  const priorSeason = {
    ...seasonConfig,
    season: '2024-25',
    kicker: 'Cody Williams · fixture prior season · 2024-25',
  }
  const twoSeasonHero: HeroConfig = {
    ...hero,
    seasons: [priorSeason, seasonConfig],
  }

  it('a prior season argument carries the structural forward link', async () => {
    stubFetch({ ok: true, json: goldenJson })
    render(<HeroPage hero={twoSeasonHero} seasonConfig={priorSeason} />)
    await screen.findByText(hero.thesis)

    // Season-owned copy renders from the season argument (ADR-0060) …
    screen.getByText(priorSeason.kicker)
    expect(document.title).toBe(`${hero.playerName} · 2024-25 · shot selection`)
    // … and the frozen page points forward at the canonical alias — quiet
    // navigation under the byline, never a hedge on the verdict.
    const forward = screen.getByRole('link', { name: `His ${hero.canonicalSeason} season →` })
    expect(forward.getAttribute('href')).toBe(`/${hero.slug}`)
  })

  it('the canonical season renders without a forward link', async () => {
    stubFetch({ ok: true, json: goldenJson })
    render(<HeroPage hero={twoSeasonHero} seasonConfig={seasonConfig} />)
    await screen.findByText(hero.thesis)
    expect(screen.queryByText(/season →/)).toBeNull()
  })
})

describe('THE LINE act (ADR-0056)', () => {
  it('renders the fourth act: kicker, season line, chart, and table twin', async () => {
    stubFetch({ ok: true, json: goldenJson })
    render(<HeroPage hero={hero} seasonConfig={seasonConfig} />)
    await screen.findByText(hero.thesis)

    screen.getByText('04 · THE LINE')
    screen.getByRole('heading', { name: 'FREE THROWS' })
    // The season line, formatted from the aggregation (4/6 FT over 15 FGA,
    // 21 points; league 14/18 over 45 and 61 — the golden's numbers).
    const season = screen.getByLabelText('Season free-throw line, vs league average')
    expect(season.textContent).toContain('40.0% (lg 40.0%)') // FTA rate
    expect(season.textContent).toContain('19.0% (lg 23.0%)') // FT share
    expect(season.textContent).toContain('66.7%† (lg 77.8%)') // conversion, flagged
    // The chart prices trips against the floor: image semantics, league
    // zone references on the same axis. Both golden trip classes sit under
    // the 15-FTA dot floor, so each row draws its league dot only.
    screen.getByRole('img', { name: /The line vs the floor/ })
    expect(document.querySelectorAll('.freethrow-section .creation-dot-league')).toHaveLength(2)
    expect(document.querySelectorAll('.freethrow-section .creation-dot-player')).toHaveLength(0)
    expect(document.querySelectorAll('.freethrow-section .floor-ref-label')).toHaveLength(3)
    // The table twin: tier group rows and the golden's three trips.
    const table = screen.getByRole('table', { name: 'Free-throw trips by class' })
    expect(table.textContent).toContain('Attempt-equivalent')
    expect(table.textContent).toContain('Shooting foul (2 FT)')
    expect(table.textContent).toContain('And-1')
    expect(table.textContent).toContain('Bonus')
    // Zero-trip classes are omitted until data arrives (ADR-0043 pattern)…
    expect(table.textContent).not.toContain('Flagrant')
    // …and the charted class he never drew is disclosed, not hidden.
    screen.getByText(/He drew no three-shot shooting fouls this season/)
    // Technicals: counted and reported, never a trip.
    screen.getByText(/1 technical free throw \(0 made\)/)
  })
})
