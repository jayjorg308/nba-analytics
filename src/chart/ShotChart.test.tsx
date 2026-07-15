// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseDerivedPayload } from '../domain/payload'
import { ShotChart } from './ShotChart'

// under jsdom, import.meta.url is not a file URL — resolve from the vitest
// root (the repo root) instead
const goldenPath = path.resolve(process.cwd(), 'tests/fixtures/derived.golden.json')
const golden = parseDerivedPayload(JSON.parse(readFileSync(goldenPath, 'utf-8')))

// RTL auto-cleanup needs vitest globals, which we don't enable — clean up
// explicitly so renders don't accumulate across tests.
afterEach(cleanup)

describe('ShotChart', () => {
  it('renders one dot per on-court shot and skips the backcourt heave', () => {
    const { container, getByText } = render(
      <ShotChart shots={golden.shots} ariaLabel="test chart" />,
    )
    // golden: 15 shots, 1 synthetic backcourt at locY 550 (off-frame)
    expect(container.querySelectorAll('.shot-dot')).toHaveLength(14)
    getByText(/1 shot beyond half-court not shown/)
  })

  it('encodes made and missed distinctly, missed under made', () => {
    const { container } = render(<ShotChart shots={golden.shots} ariaLabel="test chart" />)
    // visible golden shots: 7 made, 7 missed (the skipped heave was a miss)
    expect(container.querySelectorAll('.dot-made')).toHaveLength(7)
    expect(container.querySelectorAll('.dot-missed')).toHaveLength(7)
    const dots = [...container.querySelectorAll('.shot-dot')]
    const firstMadeIndex = dots.findIndex((d) => d.querySelector('.dot-made'))
    const lastMissedIndex = dots.findLastIndex((d) => d.querySelector('.dot-missed'))
    expect(lastMissedIndex).toBeLessThan(firstMadeIndex)
  })

  it('is a labeled image with no skip caption when everything fits', () => {
    const onCourt = golden.shots.filter((s) => s.zoneBasic !== 'Backcourt')
    const { container, queryByText } = render(
      <ShotChart shots={onCourt} ariaLabel="Half-court shot chart" />,
    )
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('Half-court shot chart')
    expect(queryByText(/not shown/)).toBeNull()
  })

  it('reports mouse hover enter/leave through the callbacks', () => {
    const onShotEnter = vi.fn()
    const onShotLeave = vi.fn()
    const { container } = render(
      <ShotChart
        shots={golden.shots}
        ariaLabel="test chart"
        onShotEnter={onShotEnter}
        onShotLeave={onShotLeave}
      />,
    )
    const firstHit = container.querySelector('.shot-dot .dot-hit')!
    fireEvent.pointerEnter(firstHit, { pointerType: 'mouse' })
    expect(onShotEnter).toHaveBeenCalledTimes(1)
    // dots render missed-first in payload order; golden shots[0] is a missed
    // Mid-Range two, so it is the first dot in the DOM
    expect(onShotEnter.mock.calls[0]![0]).toMatchObject({
      zoneBasic: 'Mid-Range',
      made: false,
      distanceFt: 17,
    })
    fireEvent.pointerLeave(firstHit, { pointerType: 'mouse' })
    expect(onShotLeave).toHaveBeenCalledTimes(1)
  })

  it('ignores non-mouse pointers — a tap neither opens nor closes a tooltip (ADR-0027)', () => {
    const onShotEnter = vi.fn()
    const onShotLeave = vi.fn()
    const { container } = render(
      <ShotChart
        shots={golden.shots}
        ariaLabel="test chart"
        onShotEnter={onShotEnter}
        onShotLeave={onShotLeave}
      />,
    )
    const firstHit = container.querySelector('.shot-dot .dot-hit')!
    fireEvent.pointerEnter(firstHit, { pointerType: 'touch' })
    fireEvent.pointerLeave(firstHit, { pointerType: 'touch' })
    fireEvent.pointerEnter(firstHit, { pointerType: 'pen' })
    expect(onShotEnter).not.toHaveBeenCalled()
    expect(onShotLeave).not.toHaveBeenCalled()
  })
})
