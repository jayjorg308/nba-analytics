import type { ZoneMetricsRow } from '../domain/aggregate'
import type { EvalZone } from '../domain/constants'
import { formatSignedPp1, withSmallSampleMark } from '../format'
import { CourtElementShape } from './CourtLines'
import { CourtLines } from './CourtLines'
import type { ZoneRegion } from './geometry'
import { VIEWBOX, zoneRegions } from './geometry'
import { makingBinClass, makingDeltaBin } from './makingScale'

export interface ZoneOverlayProps {
  /** metrics.zones — the single aggregation output; this component only
   * formats and maps, it never computes (ADR-0011). */
  zones: ZoneMetricsRow[]
  ariaLabel: string
  /** Fired on click or Enter/Space. `trigger` is the zone's <g>, so the
   * detail-card owner can return focus to it on close (ADR-0027). */
  onZoneSelect?: (row: ZoneMetricsRow, trigger: SVGGElement) => void
}

// Presentation copy only (descriptive names, ADR-0005-safe).
const ZONE_SHORT_NAME: Record<EvalZone, string> = {
  'Restricted Area': 'RA',
  'In The Paint (Non-RA)': 'Paint',
  'Mid-Range': 'Mid-Range',
  'Left Corner 3': 'Left C3',
  'Right Corner 3': 'Right C3',
  'Above the Break 3': 'Above Break 3',
}

function ZoneLabel({ region, row }: { region: ZoneRegion; row: ZoneMetricsRow }) {
  const { labelAnchor, labelRotate } = region
  const delta = withSmallSampleMark(formatSignedPp1(row.makingDelta), row.smallSampleMaking)
  if (labelRotate) {
    // Corner strips are 30 units wide: the stacked two-line label spans ~34
    // and bled over the sideline and the corner-3 line. Rotated labels run
    // name + delta on ONE line along the strip's ~142-unit length instead;
    // dy centers the single baseline across the strip.
    return (
      <text
        className="zone-label zone-label-rotated"
        x={labelAnchor.x}
        y={labelAnchor.y}
        dy="0.35em"
        transform={`rotate(${labelRotate} ${labelAnchor.x} ${labelAnchor.y})`}
      >
        <tspan className="zone-label-name">{ZONE_SHORT_NAME[row.zone]}</tspan>
        <tspan className="zone-label-delta" dx="7">
          {delta}
        </tspan>
      </text>
    )
  }
  return (
    <text className="zone-label" x={labelAnchor.x} y={labelAnchor.y}>
      <tspan className="zone-label-name" x={labelAnchor.x} dy="-0.2em">
        {ZONE_SHORT_NAME[row.zone]}
      </tspan>
      <tspan className="zone-label-delta" x={labelAnchor.x} dy="1.25em">
        {delta}
      </tspan>
    </text>
  )
}

/**
 * The Zones view: evaluation-zone regions shaded by making delta.
 *
 * Fills render in PAINTER ORDER (each inner shape covers the outer), so
 * hit-testing needs no region math — the topmost shape under the click is
 * the innermost zone. Court line-work draws over the fills with pointer
 * events off; labels draw last, also with pointer-events off, so clicks
 * fall through to the fills.
 *
 * Each zone is a real button (click or Enter/Space opens its detail card —
 * one interaction model on every device, ADR-0027), so the svg is a labeled
 * GROUP of controls, not an image. Hover is a CSS affordance only.
 *
 * Regions are keyed by ZONE NAME from ShotMetrics, never derived from shot
 * coordinates — drawn geometry approximates the data's zone assignments and
 * never overrides them (ADR-0012). All six zones are shaded regardless of
 * `included` (inclusion gates the mix view; making is flagged†, never
 * suppressed — ADR-0008), and small-sample fills keep full color: muting
 * them would corrupt the magnitude encoding.
 */
export function ZoneOverlay({ zones, ariaLabel, onZoneSelect }: ZoneOverlayProps) {
  const rowsByZone = new Map(zones.map((row) => [row.zone, row]))
  const regions = zoneRegions().filter((region) => rowsByZone.has(region.zone))

  return (
    <svg className="shot-chart" viewBox={VIEWBOX} role="group" aria-label={ariaLabel}>
      <g className="zone-fills">
        {regions.map((region) => {
          const row = rowsByZone.get(region.zone)!
          return (
            <g
              key={region.zone}
              className={`zone-fill ${makingBinClass(makingDeltaBin(row.makingDelta))}`}
              role="button"
              tabIndex={0}
              aria-haspopup="dialog"
              aria-label={row.zone}
              data-zone={region.zone}
              onClick={(e) => onZoneSelect?.(row, e.currentTarget)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault() // Space must not scroll the page
                  onZoneSelect?.(row, e.currentTarget)
                }
              }}
            >
              <CourtElementShape el={region.shape} />
            </g>
          )
        })}
      </g>
      <CourtLines />
      <g className="zone-labels" aria-hidden="true">
        {regions.map((region) => (
          <ZoneLabel key={region.zone} region={region} row={rowsByZone.get(region.zone)!} />
        ))}
      </g>
    </svg>
  )
}
