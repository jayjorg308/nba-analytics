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
  it('defaults to the Zones view — the argument, not the commodity scatter', () => {
    const { container } = renderPanel()
    expect((screen.getByLabelText('Zones') as HTMLInputElement).checked).toBe(true)
    expect(container.querySelectorAll('.zone-fill')).toHaveLength(6)
    expect(container.querySelectorAll('.shot-dot')).toHaveLength(0)
    // the legend (the key to the hero visual) renders in the controls row
    // ABOVE the court, not below it
    screen.getByText('Shot making vs league average (percentage points)')
    expect(container.querySelectorAll('.zones-legend-swatch')).toHaveLength(7)
    const panelChildren = [...container.querySelector('.chart-panel')!.children]
    expect(panelChildren.map((c) => c.className)).toEqual(['chart-controls', 'chart-wrapper'])
    expect(panelChildren[0]!.querySelector('.zones-legend')).not.toBeNull()
  })

  it('switches to Shots: dots replace fills and the shots legend becomes the visible layer', () => {
    const { container } = renderPanel()
    fireEvent.click(screen.getByLabelText('Shots'))
    expect(container.querySelectorAll('.shot-dot')).toHaveLength(14)
    expect(container.querySelectorAll('.zone-fill')).toHaveLength(0)
    screen.getByText('Made')
    screen.getByText('Missed')
    // BOTH legends stay mounted — the inactive one is visibility-hidden,
    // never removed, so the controls row keeps one height across the toggle
    // and the court/table never shift (see .chart-legend-slot). Layer DOM
    // order is fixed: [zones, shots].
    const [zonesLayer, shotsLayer] = [...container.querySelectorAll('.chart-legend-layer')]
    expect(zonesLayer!.className).toContain('legend-inactive')
    expect(shotsLayer!.className).not.toContain('legend-inactive')
  })

  it('shows a zone tooltip on hover with the flagged uncertainty sentence', () => {
    const { container } = renderPanel()
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

  it('switches views cleanly, clearing hover state', () => {
    const { container } = renderPanel()
    const layers = () => [...container.querySelectorAll('.chart-legend-layer')]
    const fill = container.querySelector('.zone-fill')!
    fireEvent.pointerEnter(fill)
    expect(container.querySelector('.shot-tooltip')).not.toBeNull()
    fireEvent.click(screen.getByLabelText('Shots'))
    expect(container.querySelectorAll('.shot-dot')).toHaveLength(14)
    expect(container.querySelectorAll('.zone-fill')).toHaveLength(0)
    expect(container.querySelector('.shot-tooltip')).toBeNull()
    expect(layers()[0]!.className).toContain('legend-inactive')
    screen.getByText('Made')
    fireEvent.click(screen.getByLabelText('Zones'))
    expect(container.querySelectorAll('.zone-fill')).toHaveLength(6)
    expect(layers()[0]!.className).not.toContain('legend-inactive')
    expect(layers()[1]!.className).toContain('legend-inactive')
  })
})
