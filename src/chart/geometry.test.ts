import { describe, expect, it } from 'vitest'
import {
  classifyByGeometry,
  CORNER_ARC_JUNCTION_Y,
  COURT,
  courtElements,
  isOnCourt,
  statsToSvg,
  svgToStats,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
  zoneRegions,
} from './geometry'

describe('statsToSvg', () => {
  it('places the hoop at (270, 72.5)', () => {
    expect(statsToSvg(0, 0)).toEqual({ x: 270, y: 72.5 })
  })

  it('maps the court extremes to the padded frame edges', () => {
    expect(statsToSvg(-250, -52.5)).toEqual({ x: 20, y: 20 }) // left baseline corner
    expect(statsToSvg(250, 417.5)).toEqual({ x: 520, y: 490 }) // right half-court corner
  })

  it('keeps the offense perspective: hoop at top, shooter-left on image-left', () => {
    // Negative locX is the NBA's "Left Side(L)" — the SHOOTER'S left. Hoop at
    // the top is the one orientation where that lands on image-left with no
    // axis flip; a y-only flip (hoop at bottom) mirrors the court (ADR-0015).
    expect(statsToSvg(0, 0).y).toBeLessThan(statsToSvg(0, COURT.maxY).y)
    expect(statsToSvg(-220, 0).x).toBeLessThan(statsToSvg(220, 0).x)
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
    expect(byId.get('paint')).toMatchObject({ x: 190, y: 20, width: 160, height: 190 })
    expect(byId.get('ft-circle')).toMatchObject({ cx: 270, cy: 210, r: 60 })
    expect(byId.get('rim')).toMatchObject({ cx: 270, cy: 72.5, r: 7.5 })
    expect(byId.get('backboard')).toMatchObject({ x1: 240, y1: 60, x2: 300, y2: 60 })
    expect(byId.get('corner-3-left')).toMatchObject({ x1: 50, y1: 20, x2: 50 })
    expect(byId.get('corner-3-right')).toMatchObject({ x1: 490, y1: 20, x2: 490 })
  })
})

describe('zoneRegions', () => {
  const regions = zoneRegions()
  const byZone = new Map(regions.map((r) => [r.zone, r]))
  const junctionSvgY = 72.5 + CORNER_ARC_JUNCTION_Y

  it('returns the six regions in painter order (outer to inner)', () => {
    expect(regions.map((r) => r.zone)).toEqual([
      'Above the Break 3',
      'Left Corner 3',
      'Right Corner 3',
      'Mid-Range',
      'In The Paint (Non-RA)',
      'Restricted Area',
    ])
  })

  it('uses the exact court numbers', () => {
    expect(byZone.get('Above the Break 3')!.shape).toMatchObject({
      kind: 'rect', x: 20, y: 20, width: 500, height: 470,
    })
    const lc3 = byZone.get('Left Corner 3')!.shape
    expect(lc3).toMatchObject({ kind: 'rect', x: 20, y: 20, width: 30 })
    expect((lc3 as { height: number }).height).toBeCloseTo(junctionSvgY - 20, 10)
    const rc3 = byZone.get('Right Corner 3')!.shape
    expect(rc3).toMatchObject({ kind: 'rect', x: 490, y: 20, width: 30 })
    // paint region uses the same numbers as the paint line-work rect
    expect(byZone.get('In The Paint (Non-RA)')!.shape).toMatchObject({
      kind: 'rect', x: 190, y: 20, width: 160, height: 190,
    })
    expect(byZone.get('Restricted Area')!.shape).toMatchObject({
      kind: 'circle', cx: 270, cy: 72.5, r: 40,
    })
    const mid = byZone.get('Mid-Range')!.shape
    expect(mid.kind).toBe('path')
    expect((mid as { d: string }).d).toContain('A 237.5 237.5 0 0 0')
    expect((mid as { d: string }).d).toMatch(/^M 50 20 /)
  })

  it('keeps every region shape inside the viewBox', () => {
    for (const { zone, shape } of regions) {
      const extents: number[] = []
      if (shape.kind === 'rect') {
        extents.push(shape.x, shape.y, shape.x + shape.width, shape.y + shape.height)
      } else if (shape.kind === 'circle') {
        extents.push(shape.cx - shape.r, shape.cy - shape.r, shape.cx + shape.r, shape.cy + shape.r)
      } else if (shape.kind === 'path') {
        extents.push(...(shape.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number))
      }
      for (const v of extents) {
        expect(v, `${zone} extent ${v}`).toBeGreaterThanOrEqual(0)
        expect(v, `${zone} extent ${v}`).toBeLessThanOrEqual(
          Math.max(VIEWBOX_WIDTH, VIEWBOX_HEIGHT),
        )
      }
    }
  })

  it('places every label anchor inside its own zone', () => {
    // catches the (270, 370)-is-inside-the-paint class of mistake
    for (const { zone, labelAnchor } of regions) {
      const stats = svgToStats(labelAnchor.x, labelAnchor.y)
      expect(classifyByGeometry(stats.x, stats.y), `${zone} label anchor`).toBe(zone)
    }
  })
})

describe('classifyByGeometry (test-only, ADR-0012)', () => {
  it('resolves the RA/paint boundary as a closed disc', () => {
    expect(classifyByGeometry(0, 40)).toBe('Restricted Area')
    expect(classifyByGeometry(0, 40.5)).toBe('In The Paint (Non-RA)')
  })

  it('resolves the corner line and junction edges', () => {
    expect(classifyByGeometry(-220, 0)).toBe('Left Corner 3')
    expect(classifyByGeometry(220, 0)).toBe('Right Corner 3')
    expect(classifyByGeometry(-219.99, 0)).toBe('Mid-Range')
    // just above the junction on the corner-line x: radial > 237.5 -> ATB3
    expect(classifyByGeometry(220, CORNER_ARC_JUNCTION_Y + 0.01)).toBe('Above the Break 3')
    expect(classifyByGeometry(221, CORNER_ARC_JUNCTION_Y - 0.01)).toBe('Right Corner 3')
  })

  it('resolves the arc boundary', () => {
    expect(classifyByGeometry(0, 237.5)).toBe('Above the Break 3')
    expect(classifyByGeometry(0, 237.49)).toBe('Mid-Range')
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
