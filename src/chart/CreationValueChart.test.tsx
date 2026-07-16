// @vitest-environment jsdom
// The value chart is a presentation mapping over aggregation outputs
// (ADR-0011): these tests pin the mapping — one dumbbell per context on one
// shared PPS axis, no player mark for a zero-attempt context (no data is not
// a value claim), image semantics with the table as the data twin — not the
// pixels.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { aggregateCreationMetrics } from '../domain/aggregateCreation'
import { parseCreationPayload } from '../domain/creationPayload'
import { CreationValueChart } from './CreationValueChart'

const goldenPath = path.resolve(process.cwd(), 'tests/fixtures/creation.golden.json')
const metrics = aggregateCreationMetrics(
  parseCreationPayload(JSON.parse(readFileSync(goldenPath, 'utf-8'))),
)

afterEach(cleanup)

function xs(selector: string): number[] {
  return [...document.querySelectorAll(selector)].map((el) =>
    parseFloat(el.getAttribute('cx')!),
  )
}

describe('CreationValueChart', () => {
  it('draws a league dot per row, a player dot only where a PPS claim exists', () => {
    render(<CreationValueChart metrics={metrics} />)
    // 8 rows (rim + jumper parent, 3 jumper children, 3 clock bands); the
    // golden's zero-attempt 'Other' draws no player dot and no connector.
    expect(document.querySelectorAll('.creation-dot-league')).toHaveLength(8)
    expect(document.querySelectorAll('.creation-dot-player')).toHaveLength(7)
    expect(document.querySelectorAll('.creation-connector')).toHaveLength(7)
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

    // golden row order (player): inside 1.25, jumpers 8/7, C&S 1.5, PU 2/3,
    // [Other skipped], Early 1.0, Average 1.0, Late 2/3.
    // C&S (1.5) is the rightmost player dot; Pull Ups (2/3) among the leftmost.
    expect(Math.max(...player)).toBe(player[2])
    expect(player[3]).toBe(Math.min(...player))

    // shared axis: equal values land at equal x across sides and rows —
    // player Early (1.0) === league Pull Ups (1.0) === league Other (1.0)
    expect(player[4]).toBeCloseTo(league[3]!, 6)
    expect(league[3]).toBeCloseTo(league[4]!, 6)

    // direction is readable: his C&S dot sits right of the league's
    // (1.5 vs 1.1875); his Pull Ups dot sits left of the league's (0.67 vs 1.0)
    expect(player[2]!).toBeGreaterThan(league[2]!)
    expect(player[3]!).toBeLessThan(league[3]!)
  })

  it('labels the two-tier rows, values, flags, and axis ticks', () => {
    render(<CreationValueChart metrics={metrics} />)
    screen.getByText('Inside 10 ft')
    screen.getByText('Jumpers (10 ft and out)')
    screen.getByText('JUMPERS, BY CREATION')
    screen.getByText('Late (7-0s)')
    // his values carry the shared † under 50 attempts (every golden row)
    screen.getByText('1.50†') // Catch and Shoot, 4 attempts
    // axis ticks frame the non-zero baseline honestly (domain 0.60–1.60)
    screen.getByText('0.60')
    screen.getByText('1.60')
  })

  it('shows the his-vs-league legend in PPS terms', () => {
    render(<CreationValueChart metrics={metrics} />)
    expect(screen.getByText(/his PPS/)).toBeTruthy()
    expect(screen.getByText(/lg PPS/)).toBeTruthy()
  })
})
