// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { aggregateShotMetrics } from '../domain/aggregate'
import { parseDerivedPayload } from '../domain/payload'
import { ChartPanel } from './ChartPanel'

const goldenPath = path.resolve(process.cwd(), 'tests/fixtures/derived.golden.json')
const golden = parseDerivedPayload(JSON.parse(readFileSync(goldenPath, 'utf-8')))
const metrics = aggregateShotMetrics(golden.shots, golden.zoneBaseline)

afterEach(cleanup)

function renderPanel() {
  return render(
    <ChartPanel shots={golden.shots} zones={metrics.zones} ariaLabel="test chart" />,
  )
}

describe('ChartPanel view toggle', () => {
  it('defaults to the Shots view', () => {
    const { container } = renderPanel()
    expect((screen.getByLabelText('Shots') as HTMLInputElement).checked).toBe(true)
    expect(container.querySelectorAll('.shot-dot')).toHaveLength(14)
    expect(container.querySelectorAll('.zone-fill')).toHaveLength(0)
    screen.getByText('Made')
    screen.getByText('Missed')
  })

  it('switches to Zones: fills replace dots and the legend swaps', () => {
    const { container } = renderPanel()
    fireEvent.click(screen.getByLabelText('Zones'))
    expect(container.querySelectorAll('.shot-dot')).toHaveLength(0)
    expect(container.querySelectorAll('.zone-fill')).toHaveLength(6)
    screen.getByText('Shot making vs league average (percentage points)')
    expect(screen.queryByText('Made')).toBeNull()
    expect(container.querySelectorAll('.zones-legend-swatch')).toHaveLength(7)
  })

  it('shows a zone tooltip on hover with the flagged uncertainty sentence', () => {
    const { container } = renderPanel()
    fireEvent.click(screen.getByLabelText('Zones'))
    const raFill = [...container.querySelectorAll('.zone-fill')].at(-1)! // RA topmost
    fireEvent.pointerEnter(raFill)
    screen.getByText('Restricted Area')
    screen.getByText('2 FGA')
    screen.getByText(/FG% 50\.0%/)
    screen.getByText(/PPS 1\.00/)
    screen.getByText(/Making Δ −17\.1† pp/)
    screen.getByText(/† Under 50 attempts — treat as uncertain\./)
    fireEvent.pointerLeave(raFill)
    expect(container.querySelector('.shot-tooltip')).toBeNull()
  })

  it('restores the Shots view cleanly, clearing hover state', () => {
    const { container } = renderPanel()
    fireEvent.click(screen.getByLabelText('Zones'))
    const fill = container.querySelector('.zone-fill')!
    fireEvent.pointerEnter(fill)
    expect(container.querySelector('.shot-tooltip')).not.toBeNull()
    fireEvent.click(screen.getByLabelText('Shots'))
    expect(container.querySelectorAll('.shot-dot')).toHaveLength(14)
    expect(container.querySelectorAll('.zone-fill')).toHaveLength(0)
    expect(container.querySelector('.shot-tooltip')).toBeNull()
    expect(screen.queryByText(/percentage points/)).toBeNull()
    screen.getByText('Made')
  })
})
