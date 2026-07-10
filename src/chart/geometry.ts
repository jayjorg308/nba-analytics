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
// ORIENTATION: baseline at the BOTTOM of the frame, three-point arc opening
// upward, half-court line at the top. The y-flip (SVG y grows downward)
// happens exactly once, inside statsToSvg — not via a scale(1,-1) transform —
// so tests can assert exact SVG numbers.

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
  return { x: x - COURT.minX + PAD, y: COURT.maxY + PAD - y }
}

export function svgToStats(x: number, y: number): SvgPoint {
  return { x: x + COURT.minX - PAD, y: COURT.maxY + PAD - y }
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

/**
 * Court line-work as SVG-space descriptors (NBA dimensions in feet, x10 to
 * stats units, then through statsToSvg). Rendered stroke-only.
 */
export function courtElements(): CourtElement[] {
  const hoop = statsToSvg(0, 0) // (270, 437.5)
  const junction = statsToSvg(0, CORNER_ARC_JUNCTION_Y).y // corner-line top / arc ends

  const boundaryTL = statsToSvg(COURT.minX, COURT.maxY)
  const paintTL = statsToSvg(-80, 137.5) // key: 16 ft wide, 19 ft from baseline
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
      d: `M ${hoop.x - 40} ${hoop.y} A 40 40 0 0 1 ${hoop.x + 40} ${hoop.y}`,
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
      d: `M ${statsToSvg(-220, 0).x} ${junction} A 237.5 237.5 0 0 1 ${statsToSvg(220, 0).x} ${junction}`,
    },
    {
      id: 'center-circle',
      kind: 'path',
      d: `M ${hoop.x - 60} ${halfCourtY} A 60 60 0 0 0 ${hoop.x + 60} ${halfCourtY}`,
    },
  ]
}
