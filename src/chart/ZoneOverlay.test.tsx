// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aggregateShotMetrics } from '../domain/aggregate'
import type { ZoneMetricsRow } from '../domain/aggregate'
import { parseDerivedPayload } from '../domain/payload'
import { ZoneOverlay } from './ZoneOverlay'

const goldenPath = path.resolve(process.cwd(), 'tests/fixtures/derived.golden.json')
const golden = parseDerivedPayload(JSON.parse(readFileSync(goldenPath, 'utf-8')))
// test-side aggregation is fine — the single PRODUCTION call site stays in HeroReady
const metrics = aggregateShotMetrics(golden.shots, golden.zoneBaseline)

afterEach(cleanup)

describe('ZoneOverlay', () => {
  it('renders six fills in painter order, lines after fills, labels last', () => {
    const { container } = render(<ZoneOverlay zones={metrics.zones} ariaLabel="zones" />)
    const fills = container.querySelectorAll('.zone-fill')
    expect(fills).toHaveLength(6)

    const svgChildren = [...container.querySelector('svg')!.children].map((c) =>
      c.getAttribute('class'),
    )
    expect(svgChildren).toEqual(['zone-fills', 'court-lines', 'zone-labels'])

    // painter order: outermost (ATB3) first, RA disc last
    const order = [...fills].map((f) => f.querySelector('rect, circle, path')!.tagName)
    expect(order[0]).toBe('rect') // ATB3 boundary rect
    expect(order[5]).toBe('circle') // RA disc on top
  })

  it('assigns the golden bin classes per zone', () => {
    const { container } = render(<ZoneOverlay zones={metrics.zones} ariaLabel="zones" />)
    const classes = new Map(
      [...container.querySelectorAll('.zone-fill')].map((f, i) => [
        metrics.zones.find((z) => z.zone === zoneOfIndex(i))?.zone,
        f.getAttribute('class'),
      ]),
    )
    // golden deltas: RA -17.1, ITP +5.4, MR +8.3, LC3 +11.3, RC3 +11.4, ATB3 +15.0
    expect(classes.get('Above the Break 3')).toContain('zone-fill-warm-2')
    expect(classes.get('Left Corner 3')).toContain('zone-fill-warm-2')
    expect(classes.get('Right Corner 3')).toContain('zone-fill-warm-2')
    expect(classes.get('Mid-Range')).toContain('zone-fill-warm-1')
    expect(classes.get('In The Paint (Non-RA)')).toContain('zone-fill-warm-1')
    expect(classes.get('Restricted Area')).toContain('zone-fill-cold-2')

    function zoneOfIndex(i: number) {
      // painter order fixed by zoneRegions()
      return [
        'Above the Break 3',
        'Left Corner 3',
        'Right Corner 3',
        'Mid-Range',
        'In The Paint (Non-RA)',
        'Restricted Area',
      ][i]
    }
  })

  it('labels every zone with its short name and flagged delta', () => {
    const { container } = render(<ZoneOverlay zones={metrics.zones} ariaLabel="zones" />)
    const labels = [...container.querySelectorAll('.zone-label')].map((l) => l.textContent)
    // all six golden zones are sub-50 -> every delta carries †
    expect(labels).toContain('RA−17.1†')
    expect(labels).toContain('Above Break 3+15.0†')
    expect(labels.every((l) => l!.includes('†'))).toBe(true)
  })

  it('renders a null-delta zone as nodata with an em-dash label', () => {
    const zeroAttempt: ZoneMetricsRow = {
      ...metrics.zones.find((z) => z.zone === 'Mid-Range')!,
      attempts: 0,
      makes: 0,
      fgPct: null,
      pps: null,
      makingDelta: null,
      smallSampleMaking: true,
    }
    const zones = metrics.zones.map((z) => (z.zone === 'Mid-Range' ? zeroAttempt : z))
    const { container } = render(<ZoneOverlay zones={zones} ariaLabel="zones" />)
    const midFill = [...container.querySelectorAll('.zone-fill')].find((f) =>
      f.getAttribute('class')!.includes('nodata'),
    )
    expect(midFill).toBeDefined()
    const labels = [...container.querySelectorAll('.zone-label')].map((l) => l.textContent)
    expect(labels.some((l) => l!.includes('—'))).toBe(true)
  })

  it('is a labeled group of zone buttons with hidden label internals', () => {
    const { container } = render(<ZoneOverlay zones={metrics.zones} ariaLabel="zone chart" />)
    const svg = container.querySelector('svg')!
    // Interactive children are invalid inside role="img" — the svg is a
    // labeled GROUP of six zone buttons (ADR-0027).
    expect(svg.getAttribute('role')).toBe('group')
    expect(svg.getAttribute('aria-label')).toBe('zone chart')
    const fills = [...container.querySelectorAll('.zone-fill')]
    for (const fill of fills) {
      expect(fill.getAttribute('role')).toBe('button')
      expect(fill.getAttribute('tabindex')).toBe('0')
      expect(fill.getAttribute('aria-haspopup')).toBe('dialog')
      expect(fill.getAttribute('aria-label')).toBe(fill.getAttribute('data-zone'))
    }
    expect(container.querySelector('.zone-labels')!.getAttribute('aria-hidden')).toBe('true')
  })

  it('reports zone selection on click with the row and the trigger element', () => {
    const onZoneSelect = vi.fn()
    const { container } = render(
      <ZoneOverlay zones={metrics.zones} ariaLabel="zones" onZoneSelect={onZoneSelect} />,
    )
    const raFill = [...container.querySelectorAll('.zone-fill')].at(-1)! // RA is topmost
    fireEvent.click(raFill)
    expect(onZoneSelect).toHaveBeenCalledTimes(1)
    expect(onZoneSelect.mock.calls[0]![0]).toMatchObject({ zone: 'Restricted Area' })
    expect(onZoneSelect.mock.calls[0]![1]).toBe(raFill)
  })

  it('activates a zone from the keyboard with Enter and Space, and no other key', () => {
    const onZoneSelect = vi.fn()
    const { container } = render(
      <ZoneOverlay zones={metrics.zones} ariaLabel="zones" onZoneSelect={onZoneSelect} />,
    )
    const raFill = [...container.querySelectorAll('.zone-fill')].at(-1)!
    fireEvent.keyDown(raFill, { key: 'Enter' })
    fireEvent.keyDown(raFill, { key: ' ' })
    expect(onZoneSelect).toHaveBeenCalledTimes(2)
    expect(onZoneSelect.mock.calls[1]![0]).toMatchObject({ zone: 'Restricted Area' })
    fireEvent.keyDown(raFill, { key: 'a' })
    fireEvent.keyDown(raFill, { key: 'Tab' })
    expect(onZoneSelect).toHaveBeenCalledTimes(2)
  })
})
