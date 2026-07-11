// Half-court geometry: stats.nba.com shot coordinates -> SVG.
//
// COORDINATE CONVENTION (stats.nba.com `shotchartdetail`): units are tenths
// of feet ("stats units"); the hoop center is (0, 0); +x runs toward the
// right sideline from the offense's point of view; +y runs from the hoop
// toward the half-court line. The court is 50 ft wide -> x in [-250, 250].
// We take the hoop center as 5.25 ft from the baseline (backboard face 4 ft
// off the baseline + 15 in to the rim center), so the baseline sits at
// y = -52.5 and the half-court line at y = 417.5. Some reference
// implementations use -47.5/422.5 instead — the choice moves court LINES
// only; dot positions are the API's coordinates either way.
//
// ORIENTATION: the OFFENSE'S PERSPECTIVE — baseline and hoop at the TOP of
// the frame, three-point arc opening downward, half-court line at the bottom.
// This is the one orientation that needs no axis flip: the NBA's naming is
// the offense's (negative locX = "Left Side(L)" = the shooter's left), so
// with the hoop at the top the shooter's left is the image's left and both
// axes of statsToSvg are plain translations. Flipping y alone to put the
// hoop at the bottom — the common tutorial view — MIRRORS the court: left-
// corner shots render in what a player reads as the right corner. A true
// hoop-at-bottom view would have to flip x as well (ADR-0015).

import type { EvalZone } from '../domain/constants'

export const COURT = { minX: -250, maxX: 250, minY: -52.5, maxY: 417.5 } as const

const PAD = 20 // stats units (2 ft) of breathing room around the playing surface

export const VIEWBOX_WIDTH = COURT.maxX - COURT.minX + 2 * PAD // 540
export const VIEWBOX_HEIGHT = COURT.maxY - COURT.minY + 2 * PAD // 510
export const VIEWBOX = `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`

/** Dot radius in stats units (0.5 ft). */
export const DOT_R = 5
/** Invisible pointer-target radius — hover precision at 509 dots. */
export const HIT_R = 10

// Where the 3-pt corner line (x = +/-220, i.e. 22 ft) meets the 23.75 ft arc.
// Computed, not hardcoded, so the geometry test can assert it lies on both.
export const CORNER_ARC_JUNCTION_Y = Math.sqrt(237.5 ** 2 - 220 ** 2) // ~89.4776

export interface SvgPoint {
  x: number
  y: number
}

export function statsToSvg(x: number, y: number): SvgPoint {
  return { x: x - COURT.minX + PAD, y: y - COURT.minY + PAD }
}

export function svgToStats(x: number, y: number): SvgPoint {
  return { x: x + COURT.minX - PAD, y: y + COURT.minY - PAD }
}

export function isOnCourt(shot: { locX: number; locY: number }): boolean {
  return (
    shot.locX >= COURT.minX &&
    shot.locX <= COURT.maxX &&
    shot.locY >= COURT.minY &&
    shot.locY <= COURT.maxY
  )
}

export type CourtElement =
  | { id: string; kind: 'rect'; x: number; y: number; width: number; height: number }
  | { id: string; kind: 'circle'; cx: number; cy: number; r: number }
  | { id: string; kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { id: string; kind: 'path'; d: string }

export interface ZoneRegion {
  zone: EvalZone
  shape: CourtElement
  /** Where the zone's label sits (svg coords), chosen to dodge line-work. */
  labelAnchor: SvgPoint
  /** Corners are 30 units wide — their labels render rotated. */
  labelRotate?: number
}

/**
 * Court line-work as SVG-space descriptors (NBA dimensions in feet, x10 to
 * stats units, then through statsToSvg). Rendered stroke-only.
 */
export function courtElements(): CourtElement[] {
  const hoop = statsToSvg(0, 0) // (270, 72.5)
  const junction = statsToSvg(0, CORNER_ARC_JUNCTION_Y).y // corner-line bottom / arc ends

  const boundaryTL = statsToSvg(COURT.minX, COURT.minY)
  const paintTL = statsToSvg(-80, COURT.minY) // key: 16 ft wide, 19 ft from baseline
  const ftCenter = statsToSvg(0, 137.5)
  const backboardY = statsToSvg(0, -12.5).y // face 4 ft from baseline
  const baselineY = statsToSvg(0, COURT.minY).y
  const halfCourtY = statsToSvg(0, COURT.maxY).y

  return [
    {
      id: 'boundary',
      kind: 'rect',
      x: boundaryTL.x,
      y: boundaryTL.y,
      width: COURT.maxX - COURT.minX,
      height: COURT.maxY - COURT.minY,
    },
    { id: 'paint', kind: 'rect', x: paintTL.x, y: paintTL.y, width: 160, height: 190 },
    { id: 'ft-circle', kind: 'circle', cx: ftCenter.x, cy: ftCenter.y, r: 60 },
    {
      id: 'restricted-arc',
      kind: 'path',
      d: `M ${hoop.x - 40} ${hoop.y} A 40 40 0 0 0 ${hoop.x + 40} ${hoop.y}`,
    },
    { id: 'rim', kind: 'circle', cx: hoop.x, cy: hoop.y, r: 7.5 },
    {
      id: 'backboard',
      kind: 'line',
      x1: hoop.x - 30,
      y1: backboardY,
      x2: hoop.x + 30,
      y2: backboardY,
    },
    {
      id: 'corner-3-left',
      kind: 'line',
      x1: statsToSvg(-220, 0).x,
      y1: baselineY,
      x2: statsToSvg(-220, 0).x,
      y2: junction,
    },
    {
      id: 'corner-3-right',
      kind: 'line',
      x1: statsToSvg(220, 0).x,
      y1: baselineY,
      x2: statsToSvg(220, 0).x,
      y2: junction,
    },
    {
      id: 'three-point-arc',
      kind: 'path',
      d: `M ${statsToSvg(-220, 0).x} ${junction} A 237.5 237.5 0 0 0 ${statsToSvg(220, 0).x} ${junction}`,
    },
    {
      id: 'center-circle',
      kind: 'path',
      d: `M ${hoop.x - 60} ${halfCourtY} A 60 60 0 0 1 ${hoop.x + 60} ${halfCourtY}`,
    },
  ]
}

/**
 * The six evaluation-zone regions for the Zones view, in PAINTER ORDER:
 * each later (inner) shape simply covers the earlier (outer) one, so no
 * clipPath/evenodd is needed and pointer hit-testing works naturally
 * (topmost shape wins = innermost zone). The full boundary rect IS the
 * Above-the-Break-3 fill; corners, the inside-3pt region, the paint, and
 * the restricted-area disc stack on top.
 *
 * These regions are PRESENTATION shapes that approximate the data's zone
 * assignments — they never decide a shot's zone (ADR-0012).
 */
export function zoneRegions(): ZoneRegion[] {
  const hoop = statsToSvg(0, 0)
  const junctionY = statsToSvg(0, CORNER_ARC_JUNCTION_Y).y // ≈ 161.9776
  const baselineY = statsToSvg(0, COURT.minY).y // 20
  const boundaryTL = statsToSvg(COURT.minX, COURT.minY)
  const paintTL = statsToSvg(-80, COURT.minY)
  const leftCornerX = statsToSvg(-220, 0).x // 50
  const rightCornerX = statsToSvg(220, 0).x // 490

  return [
    {
      zone: 'Above the Break 3',
      shape: {
        id: 'zone-atb3',
        kind: 'rect',
        x: boundaryTL.x,
        y: boundaryTL.y,
        width: COURT.maxX - COURT.minX,
        height: COURT.maxY - COURT.minY,
      },
      labelAnchor: { x: hoop.x, y: 390 },
    },
    {
      zone: 'Left Corner 3',
      shape: {
        id: 'zone-lc3',
        kind: 'rect',
        x: boundaryTL.x,
        y: baselineY,
        width: leftCornerX - boundaryTL.x,
        height: junctionY - baselineY,
      },
      labelAnchor: { x: 35, y: 91 },
      labelRotate: -90,
    },
    {
      zone: 'Right Corner 3',
      shape: {
        id: 'zone-rc3',
        kind: 'rect',
        x: rightCornerX,
        y: baselineY,
        width: leftCornerX - boundaryTL.x,
        height: junctionY - baselineY,
      },
      labelAnchor: { x: 505, y: 91 },
      labelRotate: 90,
    },
    {
      zone: 'Mid-Range',
      shape: {
        id: 'zone-mid-range',
        kind: 'path',
        d: `M ${leftCornerX} ${baselineY} L ${leftCornerX} ${junctionY} A 237.5 237.5 0 0 0 ${rightCornerX} ${junctionY} L ${rightCornerX} ${baselineY} Z`,
      },
      labelAnchor: { x: hoop.x, y: 285 },
    },
    {
      zone: 'In The Paint (Non-RA)',
      shape: { id: 'zone-paint', kind: 'rect', x: paintTL.x, y: paintTL.y, width: 160, height: 190 },
      labelAnchor: { x: hoop.x, y: 138 },
    },
    {
      zone: 'Restricted Area',
      shape: { id: 'zone-ra', kind: 'circle', cx: hoop.x, cy: hoop.y, r: 40 },
      labelAnchor: { x: hoop.x, y: 99 },
    },
  ]
}

/**
 * TEST-ONLY (ADR-0012): never import from production code.
 *
 * Mirrors the zoneRegions painter stack top-down (innermost wins) so tests
 * can measure how well the DRAWN regions agree with the DATA's zone
 * assignments. The data is the sole authority on a shot's zone — in the
 * launch payload the RA radial envelope tops out at ~39.66 stats units and
 * the paint's begins at ~40.46, so the nominal 40-unit boundary is not
 * recoverable from coordinates. A disagreement with this classifier is
 * documented, never "fixed" by reassigning the shot.
 */
export function classifyByGeometry(locX: number, locY: number): EvalZone {
  if (Math.hypot(locX, locY) <= 40) return 'Restricted Area'
  if (locX >= -80 && locX <= 80 && locY >= COURT.minY && locY <= 137.5) {
    return 'In The Paint (Non-RA)'
  }
  const insideThree =
    locY <= CORNER_ARC_JUNCTION_Y ? Math.abs(locX) < 220 : Math.hypot(locX, locY) < 237.5
  if (insideThree) return 'Mid-Range'
  if (locY <= CORNER_ARC_JUNCTION_Y) {
    return locX <= -220 ? 'Left Corner 3' : 'Right Corner 3'
  }
  return 'Above the Break 3'
}
