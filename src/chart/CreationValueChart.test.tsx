// @vitest-environment jsdom
// The value chart is a presentation mapping over aggregation outputs
// (ADR-0011): these tests pin the mapping — one dumbbell per context on one
// shared PPS axis, a player dot only where the context clears the shared
// zone-inclusion bar (no data — and 1-attempt data — is not a value claim;
// the dot floor is the ADR-0031 amendment), image semantics with the table
// as the data twin — not the pixels.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aggregateCreationMetrics } from '../domain/aggregateCreation'
import { parseCreationPayload } from '../domain/creationPayload'
import { CreationValueChart } from './CreationValueChart'

const goldenPath = path.resolve(process.cwd(), 'tests/fixtures/creation.golden.json')
const goldenJson = JSON.parse(readFileSync(goldenPath, 'utf-8'))

/**
 * The golden's counts are deliberately tiny — every context sits under the
 * dot floor, making it the all-unplaced case. The chartable fixture scales
 * every count ×6 (rates untouched, so the partition identities and PPS
 * values survive) and hands the 'Other' residual a single made two — a
 * 2.00-PPS, 1-attempt outlier, the exact shape the residual exclusion and
 * the dot floor exist for.
 */
function scaledFixture(): unknown {
  const p = structuredClone(goldenJson)
  const counts = ['fga', 'fgm', 'fg2a', 'fg2m', 'fg3a', 'fg3m'] as const
  for (const family of ['general', 'shotClock', 'closestDefender'] as const) {
    for (const side of ['player', 'league'] as const) {
      for (const entry of p[family][side]) for (const k of counts) entry[k] *= 6
    }
  }
  for (const k of [
    'seasonFga',
    'shotClockUnattributed',
    'defenderUnattributed',
    'leagueFga',
    'leagueShotClockUnattributed',
    'leagueDefenderUnattributed',
  ] as const) {
    p._meta[k] *= 6
  }
  const other = p.general.player.find((e: { context: string }) => e.context === 'Other')
  Object.assign(other, { fga: 1, fgm: 1, fg2a: 1, fg2m: 1, fg3a: 0, fg3m: 0 })
  // the extra attempt keeps the persisted partition identities exact
  p._meta.seasonFga += 1
  p._meta.shotClockUnattributed += 1
  p._meta.defenderUnattributed += 1
  return p
}

const metrics = aggregateCreationMetrics(parseCreationPayload(scaledFixture()))
const thinMetrics = aggregateCreationMetrics(parseCreationPayload(goldenJson))

afterEach(cleanup)

function xs(selector: string): number[] {
  return [...document.querySelectorAll(selector)].map((el) =>
    parseFloat(el.getAttribute('cx')!),
  )
}

describe('CreationValueChart', () => {
  it('draws a league dot per row, a player dot only above the dot floor', () => {
    render(<CreationValueChart metrics={metrics} />)
    // 10 rows (rim + jumper parent, the 2 real jumper children, 3 clock
    // bands, 3 defender bands) — the Other residual has no chart row at all.
    expect(document.querySelectorAll('.creation-dot-league')).toHaveLength(10)
    expect(document.querySelectorAll('.creation-dot-player')).toHaveLength(10)
    expect(document.querySelectorAll('.creation-connector')).toHaveLength(10)
  })

  it('keeps the Other residual off the chart entirely', () => {
    render(<CreationValueChart metrics={metrics} />)
    // no row label, and no 2.00-PPS claim from its 1-of-1: the shared axis
    // tops out at 1.60 instead of stretching past 2.00 for a single attempt
    expect(screen.queryByText('Other')).toBeNull()
    expect(screen.queryByText(/2\.00/)).toBeNull()
    screen.getByText('1.60')
    expect(screen.queryByText('1.80')).toBeNull()
  })

  it('draws league dots only when every context is under the floor (the golden)', () => {
    render(<CreationValueChart metrics={thinMetrics} />)
    expect(document.querySelectorAll('.creation-dot-league')).toHaveLength(10)
    expect(document.querySelectorAll('.creation-dot-player')).toHaveLength(0)
    expect(document.querySelectorAll('.creation-connector')).toHaveLength(0)
    expect(screen.queryByText('Other')).toBeNull()
  })

  it('keeps image semantics and points at the data twin', () => {
    render(<CreationValueChart metrics={metrics} />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('aria-label')).toMatch(/shot creation table/)
    expect(img.getAttribute('aria-label')).toMatch(/points per shot/)
  })

  it('positions both sides on one shared PPS axis', () => {
    render(<CreationValueChart metrics={metrics} />)
    const player = xs('.creation-dot-player')
    const league = xs('.creation-dot-league')

    // scaled row order (both sides, Other rowless): inside, jumpers, C&S,
    // PU, Early, Average, Late, then the defender bands. Player values:
    // inside 1.25, jumpers 50/43, C&S 1.5, PU 2/3, Early 1.0, …
    // C&S (1.5) is the rightmost player dot; Pull Ups (2/3) among the leftmost.
    expect(Math.max(...player)).toBe(player[2])
    expect(player[3]).toBe(Math.min(...player))

    // shared axis: equal values land at equal x across sides and rows —
    // player Early (1.0) === league Pull Ups (1.0) === league Inside (1.0)
    expect(player[4]).toBeCloseTo(league[3]!, 6)
    expect(league[3]).toBeCloseTo(league[0]!, 6)

    // direction is readable: his C&S dot sits right of the league's
    // (1.5 vs 1.1875); his Pull Ups dot sits left of the league's (2/3 vs 1.0)
    expect(player[2]!).toBeGreaterThan(league[2]!)
    expect(player[3]!).toBeLessThan(league[3]!)
  })

  it('labels the two-tier rows, values, flags, and axis ticks', () => {
    render(<CreationValueChart metrics={metrics} />)
    screen.getByText('Inside 10 ft')
    screen.getByText('Jumpers (10 ft and out)')
    screen.getByText('JUMPERS, BY CREATION')
    screen.getByText('Late (7-0s)')
    screen.getByText('CLOSEST DEFENDER')
    screen.getByText('Wide open (6+ ft)')
    // his values carry the shared † under 50 attempts (every scaled row
    // sits between the dot floor and the flag bar)
    screen.getByText('1.50†') // Catch and Shoot, 24 attempts
    // axis ticks frame the non-zero baseline honestly (domain 0.60–1.60)
    screen.getByText('0.60')
    screen.getByText('1.60')
  })

  it('shows the his-vs-league legend in PPS terms', () => {
    render(<CreationValueChart metrics={metrics} />)
    expect(screen.getByText(/his PPS/)).toBeTruthy()
    expect(screen.getByText(/lg PPS/)).toBeTruthy()
  })

  it('extends the PPS axis to a wider container, never shrinking below design width', () => {
    // jsdom has no ResizeObserver (the other tests render at the 520 design
    // geometry); stub one to drive the responsive viewBox directly.
    const callbacks: ResizeObserverCallback[] = []
    class StubResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        callbacks.push(cb)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', StubResizeObserver)
    try {
      render(<CreationValueChart metrics={metrics} />)
      const svg = document.querySelector('svg')!
      const fire = (width: number) =>
        act(() => {
          callbacks[0]!(
            [{ contentRect: { width } }] as unknown as ResizeObserverEntry[],
            {} as ResizeObserver,
          )
        })
      const maxTickX = () =>
        Math.max(
          ...[...document.querySelectorAll('.creation-grid-label')].map((el) =>
            parseFloat(el.getAttribute('x')!),
          ),
        )

      expect(svg.getAttribute('viewBox')).toMatch(/^0 0 520 /)

      // a wider stacked column: the viewBox tracks it 1:1 and the top tick
      // (the axis end) moves out to the new right padding — the extra width
      // becomes axis, not scaled-up type
      fire(900)
      expect(svg.getAttribute('viewBox')).toMatch(/^0 0 900 /)
      expect(maxTickX()).toBeCloseTo(870, 3)

      // a phone-width container: the viewBox floors at the design width and
      // the box scales down instead (the ≤480px font bump's regime)
      fire(320)
      expect(svg.getAttribute('viewBox')).toMatch(/^0 0 520 /)
      expect(maxTickX()).toBeCloseTo(490, 3)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
