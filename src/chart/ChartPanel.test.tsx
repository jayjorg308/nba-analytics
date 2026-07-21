// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { aggregateShotMetrics } from '../domain/aggregate'
import { parseDerivedPayload } from '../domain/payload'
import {
  formatPercent1,
  formatPps2,
  formatSignedGap,
  withSmallSampleMark,
} from '../format'
import { ChartPanel } from './ChartPanel'

const goldenPath = path.resolve(process.cwd(), 'tests/fixtures/derived.golden.json')
const golden = parseDerivedPayload(JSON.parse(readFileSync(goldenPath, 'utf-8')))
const metrics = aggregateShotMetrics(golden.shots, golden.zoneBaseline)

afterEach(cleanup)

function renderPanel() {
  return render(
    <ChartPanel
      shots={golden.shots}
      zones={metrics.zones}
      ariaLabel="test chart"
      assistStatusByShotKey={new Map()}
    />,
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
    expect(panelChildren.map((c) => c.className)).toEqual([
      'chart-controls',
      'chart-wrapper',
      'chart-hint-slot',
    ])
    expect(panelChildren[0]!.querySelector('.zones-legend')).not.toBeNull()
  })

  it('shows one interaction cue per view, both mounted so the toggle never shifts layout', () => {
    const { container } = renderPanel()
    const hints = () => [...container.querySelectorAll('.chart-hint')]
    // Zones (default): the click-a-zone cue is the visible layer. Layer DOM
    // order is fixed: [zones, shots], like the legend slot.
    expect(hints()[0]!.className).not.toContain('hint-inactive')
    expect(hints()[0]!.textContent).toContain('any zone for its full numbers')
    expect(hints()[1]!.className).toContain('hint-inactive')
    fireEvent.click(screen.getByLabelText('Shots'))
    expect(hints()[0]!.className).toContain('hint-inactive')
    expect(hints()[1]!.className).not.toContain('hint-inactive')
    expect(hints()[1]!.textContent).toBe('Hover over any shot for its date, distance, and result')
    // A pointer affordance, not data — hidden from AT (the zone fills are
    // real buttons and the table carries every number).
    expect(container.querySelector('.chart-hint-slot')!.getAttribute('aria-hidden')).toBe('true')
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

  it('hovering a zone renders no tooltip — zone details are click-opened (ADR-0027)', () => {
    const { container } = renderPanel()
    const raFill = [...container.querySelectorAll('.zone-fill')].at(-1)! // RA topmost
    fireEvent.pointerEnter(raFill, { pointerType: 'mouse' })
    expect(container.querySelector('.shot-tooltip')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the zone detail card on click, re-presenting the full zone row', () => {
    const { container } = renderPanel()
    const ra = metrics.zones.find((z) => z.zone === 'Restricted Area')!
    const raFill = [...container.querySelectorAll('.zone-fill')].at(-1)! // RA topmost
    fireEvent.click(raFill)

    const dialog = screen.getByRole('dialog', { name: 'Restricted Area details' })
    screen.getByText(`${ra.makes} of ${ra.attempts} made`) // "1 of 2 made"
    // Every line is the row AS FORMATTED by src/format.ts — the card
    // re-presents, never computes (ADR-0011). Making Δ sits beside its two
    // FG% anchors, so it is their displayed gap (ADR-0023).
    const rows = [...dialog.querySelectorAll('.zone-detail-row')].map((r) => r.textContent)
    expect(rows).toEqual([
      `FG%${formatPercent1(ra.fgPct)} (lg ${formatPercent1(ra.leagueFgPct)})`,
      `PPS${formatPps2(ra.pps)} (lg ${formatPps2(ra.leaguePps)})`,
      `Share of his shots${formatPercent1(ra.attemptShare)} (lg ${formatPercent1(ra.leagueAttemptShare)})`,
      `Making Δ${withSmallSampleMark(
        formatSignedGap(ra.fgPct! * 100, ra.leagueFgPct * 100, 1),
        ra.smallSampleMaking,
      )} pp`,
    ])
    expect(rows[3]).toContain('−17.1† pp')
    screen.getByText('† Under 50 attempts: treat as uncertain.')

    // The mini scale: seven fixed-bin swatches with the marker on RA's bin
    // (−17.1 pp -> cold-2, the second swatch).
    const swatches = [...dialog.querySelectorAll('.zone-detail-swatch')]
    expect(swatches).toHaveLength(7)
    expect(swatches.findIndex((s) => s.className.includes('zone-detail-swatch-active'))).toBe(1)
    expect(dialog.querySelector('.zone-detail-scale-marker')).not.toBeNull()
  })

  it('moves focus into the card on open and back to the zone on close', () => {
    const { container } = renderPanel()
    const raFill = [...container.querySelectorAll('.zone-fill')].at(-1)!
    fireEvent.click(raFill)
    const dialog = screen.getByRole('dialog', { name: 'Restricted Area details' })
    expect(document.activeElement).toBe(dialog)
    fireEvent.click(screen.getByRole('button', { name: 'Close zone details' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(raFill)
  })

  it('closes on Escape', () => {
    const { container } = renderPanel()
    fireEvent.click([...container.querySelectorAll('.zone-fill')].at(-1)!)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('dismisses on an outside press WITHOUT stealing focus back (the Term contract)', () => {
    const { container } = renderPanel()
    const raFill = [...container.querySelectorAll('.zone-fill')].at(-1)!
    fireEvent.click(raFill)
    const dialog = screen.getByRole('dialog', { name: 'Restricted Area details' })
    // a press inside the card is not outside
    fireEvent.pointerDown(dialog)
    expect(screen.queryByRole('dialog')).not.toBeNull()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
    // the reader pressed elsewhere on purpose — focus stays where they put it
    expect(document.activeElement).not.toBe(raFill)
  })

  it('pressing the open zone keeps its card; pressing another zone switches cards', () => {
    const { container } = renderPanel()
    const fills = [...container.querySelectorAll('.zone-fill')]
    const raFill = fills.at(-1)! // RA topmost
    fireEvent.click(raFill)
    screen.getByRole('dialog', { name: 'Restricted Area details' })
    // the open zone is excluded from the outside-press close, so a real tap
    // on it (pointerdown, then click) re-selects instead of blinking the card
    fireEvent.pointerDown(raFill)
    fireEvent.click(raFill)
    screen.getByRole('dialog', { name: 'Restricted Area details' })
    // a tap on a different zone: its pointerdown is an outside press (card
    // dismissed), then its click opens that zone's own card
    const otherFill = fills[0]!
    const otherZone = otherFill.getAttribute('aria-label')!
    fireEvent.pointerDown(otherFill)
    fireEvent.click(otherFill)
    expect(screen.queryByRole('dialog', { name: 'Restricted Area details' })).toBeNull()
    screen.getByRole('dialog', { name: `${otherZone} details` })
  })

  it('switching views dismisses the zone card and clears shot hover', () => {
    const { container } = renderPanel()
    const layers = () => [...container.querySelectorAll('.chart-legend-layer')]
    fireEvent.click(container.querySelector('.zone-fill')!)
    expect(screen.queryByRole('dialog')).not.toBeNull()
    fireEvent.click(screen.getByLabelText('Shots'))
    expect(container.querySelectorAll('.shot-dot')).toHaveLength(14)
    expect(container.querySelectorAll('.zone-fill')).toHaveLength(0)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(layers()[0]!.className).toContain('legend-inactive')
    screen.getByText('Made')
    fireEvent.pointerEnter(container.querySelector('.dot-hit')!, { pointerType: 'mouse' })
    expect(container.querySelector('.shot-tooltip')).not.toBeNull()
    fireEvent.click(screen.getByLabelText('Zones'))
    expect(container.querySelectorAll('.zone-fill')).toHaveLength(6)
    expect(container.querySelector('.shot-tooltip')).toBeNull()
    expect(layers()[0]!.className).not.toContain('legend-inactive')
    expect(layers()[1]!.className).toContain('legend-inactive')
  })
})
