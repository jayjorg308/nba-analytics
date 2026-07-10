import { describe, expect, it } from 'vitest'
import {
  CORNER_ARC_JUNCTION_Y,
  courtElements,
  isOnCourt,
  statsToSvg,
  svgToStats,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
} from './geometry'

describe('statsToSvg', () => {
  it('places the hoop at (270, 437.5)', () => {
    expect(statsToSvg(0, 0)).toEqual({ x: 270, y: 437.5 })
  })

  it('maps the court extremes to the padded frame edges', () => {
    expect(statsToSvg(-250, -52.5)).toEqual({ x: 20, y: 490 }) // left baseline corner
    expect(statsToSvg(250, 417.5)).toEqual({ x: 520, y: 20 }) // right half-court corner
  })

  it('round-trips through svgToStats', () => {
    const samples = [
      { x: 0, y: 0 },
      { x: -248, y: 27 },
      { x: 246, y: 32 },
      { x: 13, y: -28 },
      { x: 0, y: 417.5 },
    ]
    for (const p of samples) {
      const svg = statsToSvg(p.x, p.y)
      expect(svgToStats(svg.x, svg.y)).toEqual(p)
    }
  })
})

describe('three-point geometry', () => {
  it('junction sits on both the corner line and the arc', () => {
    expect(CORNER_ARC_JUNCTION_Y).toBeCloseTo(89.4776, 3)
    expect(Math.hypot(220, CORNER_ARC_JUNCTION_Y)).toBeCloseTo(237.5, 10)
  })
})

describe('courtElements', () => {
  const elements = courtElements()

  it('keeps every element inside the viewBox', () => {
    for (const el of elements) {
      const extents: number[] = []
      if (el.kind === 'rect') {
        extents.push(el.x, el.y, el.x + el.width, el.y + el.height)
      } else if (el.kind === 'circle') {
        extents.push(el.cx - el.r, el.cy - el.r, el.cx + el.r, el.cy + el.r)
      } else if (el.kind === 'line') {
        extents.push(el.x1, el.y1, el.x2, el.y2)
      } else {
        // paths: pull every numeric token; arcs bulge inward here, so
        // endpoint/radius tokens bound the extent well enough for a sanity check
        extents.push(...(el.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number))
      }
      for (const v of extents) {
        expect(v, `${el.id} extent ${v}`).toBeGreaterThanOrEqual(0)
        expect(v, `${el.id} extent ${v}`).toBeLessThanOrEqual(Math.max(VIEWBOX_WIDTH, VIEWBOX_HEIGHT))
      }
    }
  })

  it('draws the expected line-work', () => {
    const byId = new Map(elements.map((e) => [e.id, e]))
    expect(byId.get('boundary')).toMatchObject({ x: 20, y: 20, width: 500, height: 470 })
    expect(byId.get('paint')).toMatchObject({ x: 190, y: 300, width: 160, height: 190 })
    expect(byId.get('ft-circle')).toMatchObject({ cx: 270, cy: 300, r: 60 })
    expect(byId.get('rim')).toMatchObject({ cx: 270, cy: 437.5, r: 7.5 })
    expect(byId.get('backboard')).toMatchObject({ x1: 240, y1: 450, x2: 300, y2: 450 })
    expect(byId.get('corner-3-left')).toMatchObject({ x1: 50, y1: 490, x2: 50 })
    expect(byId.get('corner-3-right')).toMatchObject({ x1: 490, y1: 490, x2: 490 })
  })
})

describe('isOnCourt', () => {
  it('accepts the real payload extremes', () => {
    expect(isOnCourt({ locX: -248, locY: 27 })).toBe(true)
    expect(isOnCourt({ locX: 246, locY: 32 })).toBe(true)
    expect(isOnCourt({ locX: 13, locY: -28 })).toBe(true) // behind the rim, on court
    expect(isOnCourt({ locX: 0, locY: 270 })).toBe(true)
  })

  it('rejects the synthetic backcourt heave and anything past half court', () => {
    expect(isOnCourt({ locX: 0, locY: 550 })).toBe(false)
    expect(isOnCourt({ locX: 0, locY: 418 })).toBe(false)
    expect(isOnCourt({ locX: -251, locY: 100 })).toBe(false)
  })
})
