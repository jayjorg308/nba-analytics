// @vitest-environment jsdom
// The diet chart is a presentation mapping over aggregation outputs
// (ADR-0011): these tests pin the mapping — one bar pair per context, widths
// proportional to shares on one shared scale, image semantics with the table
// as the data twin (ADR-0027 stance) — not the pixels.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { aggregateCreationMetrics } from '../domain/aggregateCreation'
import { parseCreationPayload } from '../domain/creationPayload'
import { CreationDietChart } from './CreationDietChart'

const goldenPath = path.resolve(process.cwd(), 'tests/fixtures/creation.golden.json')
const metrics = aggregateCreationMetrics(
  parseCreationPayload(JSON.parse(readFileSync(goldenPath, 'utf-8'))),
)

afterEach(cleanup)

function widths(selector: string): number[] {
  return [...document.querySelectorAll(selector)].map((r) =>
    parseFloat(r.getAttribute('width')!),
  )
}

describe('CreationDietChart', () => {
  it('renders one bar pair per context — 4 General + 3 product clock bands', () => {
    render(<CreationDietChart metrics={metrics} />)
    expect(document.querySelectorAll('.creation-bar-player')).toHaveLength(7)
    expect(document.querySelectorAll('.creation-bar-league')).toHaveLength(7)
  })

  it('keeps image semantics and points at the data twin', () => {
    render(<CreationDietChart metrics={metrics} />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('aria-label')).toMatch(/shot creation table/)
  })

  it('maps shares to widths on one shared linear scale', () => {
    render(<CreationDietChart metrics={metrics} />)
    const player = widths('.creation-bar-player')
    const league = widths('.creation-bar-league')

    // golden General shares: 4/15, 3/15, 8/15, 0 — 'Less than 10 ft' is the
    // widest player bar and 'Other' renders at zero width, never dropped
    // (the partition stays whole).
    expect(Math.max(...player)).toBe(player[2])
    expect(player[3]).toBe(0)

    // one scale across rows AND sides: player 8/15 vs league 90/250 must be
    // proportional (0.5333 / 0.36 ≈ 1.4815)
    expect(player[2]! / league[2]!).toBeCloseTo(8 / 15 / (90 / 250), 6)
  })

  it('labels rows with product copy and values with exact shares', () => {
    render(<CreationDietChart metrics={metrics} />)
    // display labels, not NBA literals
    screen.getByText('Pull-ups')
    screen.getByText('Catch and shoot')
    screen.getByText('Late (7-0s)')
    // direct value labels carry the exact numbers the lengths approximate
    screen.getByText('53.3%') // player Less than 10 ft, 8/15
    screen.getByText('36.0%') // league Less than 10 ft, 90/250
  })

  it('shows the his-vs-league legend', () => {
    render(<CreationDietChart metrics={metrics} />)
    expect(screen.getByText(/his share/)).toBeTruthy()
    expect(screen.getByText(/lg share/)).toBeTruthy()
  })
})
