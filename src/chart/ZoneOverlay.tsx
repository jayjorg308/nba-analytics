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
  onZoneEnter?: (row: ZoneMetricsRow, clientAnchor: { x: number; y: number }) => void
  onZoneLeave?: () => void
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
  const transform = labelRotate
    ? `rotate(${labelRotate} ${labelAnchor.x} ${labelAnchor.y})`
    : undefined
  return (
    <text className="zone-label" x={labelAnchor.x} y={labelAnchor.y} transform={transform}>
      <tspan className="zone-label-name" x={labelAnchor.x} dy="-0.2em">
        {ZONE_SHORT_NAME[row.zone]}
      </tspan>
      <tspan className="zone-label-delta" x={labelAnchor.x} dy="1.25em">
        {withSmallSampleMark(formatSignedPp1(row.makingDelta), row.smallSampleMaking)}
      </tspan>
    </text>
  )
}

/**
 * The Zones view: evaluation-zone regions shaded by making delta.
 *
 * Fills render in PAINTER ORDER (each inner shape covers the outer), so
 * hit-testing needs no region math — the topmost shape under the pointer is
 * the innermost zone. Court line-work draws over the fills; labels draw last
 * with pointer-events off so hover falls through to the fills.
 *
 * Regions are keyed by ZONE NAME from ShotMetrics, never derived from shot
 * coordinates — drawn geometry approximates the data's zone assignments and
 * never overrides them (ADR-0012). All six zones are shaded regardless of
 * `included` (inclusion gates the mix view; making is flagged†, never
 * suppressed — ADR-0008), and small-sample fills keep full color: muting
 * them would corrupt the magnitude encoding.
 */
export function ZoneOverlay({ zones, ariaLabel, onZoneEnter, onZoneLeave }: ZoneOverlayProps) {
  const rowsByZone = new Map(zones.map((row) => [row.zone, row]))
  const regions = zoneRegions().filter((region) => rowsByZone.has(region.zone))

  return (
    <svg className="shot-chart" viewBox={VIEWBOX} role="img" aria-label={ariaLabel}>
      <g className="zone-fills">
        {regions.map((region) => {
          const row = rowsByZone.get(region.zone)!
          return (
            <g
              key={region.zone}
              className={`zone-fill ${makingBinClass(makingDeltaBin(row.makingDelta))}`}
              onPointerEnter={(e) => {
                onZoneEnter?.(row, { x: e.clientX, y: e.clientY })
              }}
              onPointerLeave={() => onZoneLeave?.()}
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
