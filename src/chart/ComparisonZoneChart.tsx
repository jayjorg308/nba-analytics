// The comparison page's zone evidence (comparison plan §4): both axes
// visible SIMULTANEOUSLY over the same six evaluation-zone rows — a diet
// panel (attempt-share gap vs league share) and a making panel (making Δ vs
// league FG%), each in the product's one comparison grammar, the dumbbell.
//
// Side identity is never color: the left window is a solid circle, the
// right an outlined diamond — two non-color encodings (shape and fill
// style), named in the legend and carried by every marker. Color appears
// only where it already means something: the making panel's axis ribbon
// renders the existing fixed making scale (ADR-0013 bins, the court's
// palette classes), so hue keeps encoding above/below-league magnitude and
// nothing else. Team colors never encode identity.
//
// Paired markers are connected to make the distance visible without
// implying direction or a winner (the connector is the quiet dumbbell bar).
// A side with no attempts in a zone draws nothing there (ADR-0013: no data
// is absence of paint, not neutral); thin windows keep their markers with
// the † convention on the value labels (ADR-0075: flagged, never dropped).
//
// Hand-rolled SVG, image semantics, no tooltips (ADR-0027); the zone
// comparison table is the accessible data twin. Presentation mapping over
// aggregation outputs only — pixel positions are the sole quantities
// computed here (ADR-0011).

import { useEffect, useRef, useState } from 'react'
import type { ComparisonMetrics, ComparisonZoneRow } from '../domain/aggregateComparison'
import { formatSignedGap, formatSignedPp1, withSmallSampleMark } from '../format'
import { MAKING_BIN_EDGES_PP, makingBinClass } from './makingScale'
import type { MakingBin } from './makingScale'

// viewBox geometry — the growth diet chart's calibration: WIDTH is the
// design width and the floor the viewBox never shrinks below; wider
// containers extend the axis at 1:1 type.
const WIDTH = 520
const LABEL_X = 170
const PLOT_X0 = 186
const PLOT_X1 = 490
const PLOT_RIGHT_PAD = WIDTH - PLOT_X1
const DOT_R = 4.5
const DIAMOND_R = 4.2
const ROW_H = 44
const HEADER_H = 34
const TOP_PAD = 22
const TICK = 0.05 // 5 share/FG% points — both axes speak pp

/** Axis tick label: signed integer points ("+5", "0", "−10"). */
function tickLabel(t: number): string {
  const pp = Math.round(t * 100)
  if (pp === 0) return '0'
  return `${pp < 0 ? '−' : '+'}${Math.abs(pp)}`
}

/** The fixed making bins as axis intervals, cold to warm (open ends are
 * clamped to the plotted domain by the caller). */
const [EDGE_1, EDGE_2, EDGE_3] = MAKING_BIN_EDGES_PP
const BIN_INTERVALS: { bin: MakingBin; from: number; to: number }[] = [
  { bin: -3, from: -Infinity, to: -EDGE_3 },
  { bin: -2, from: -EDGE_3, to: -EDGE_2 },
  { bin: -1, from: -EDGE_2, to: -EDGE_1 },
  { bin: 0, from: -EDGE_1, to: EDGE_1 },
  { bin: 1, from: EDGE_1, to: EDGE_2 },
  { bin: 2, from: EDGE_2, to: EDGE_3 },
  { bin: 3, from: EDGE_3, to: Infinity },
]

interface PanelSpec {
  title: string
  ariaLabel: string
  value: (row: ComparisonZoneRow, side: 'left' | 'right') => number | null
  /** The value label's text — each panel formats to agree exactly with the
   * table twin's numbers (ADR-0023 across the twin surfaces): the diet
   * label is the gap of the two DISPLAYED shares, the making label the
   * same rounded-raw string as the table's Making Δ column. */
  label: (row: ComparisonZoneRow, side: 'left' | 'right') => string
  /** The † convention for this axis's value labels. */
  flagged: (row: ComparisonZoneRow, side: 'left' | 'right') => boolean
  /** Draw the fixed making scale as an axis ribbon. */
  makingRibbon: boolean
}

function Panel({ metrics, spec }: { metrics: ComparisonMetrics; spec: PanelSpec }) {
  // Responsive width: the creation chart's ResizeObserver pattern — jsdom
  // (and any environment without the observer) renders at design geometry.
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(WIDTH)
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(WIDTH, Math.round(entry.contentRect.width)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const plotX1 = width - PLOT_RIGHT_PAD

  const values = metrics.zones
    .flatMap((row) => [spec.value(row, 'left'), spec.value(row, 'right')])
    .filter((v): v is number => v !== null)

  // One shared point axis, padded and rounded outward to the TICK step and
  // always spanning zero — the league line is the axis's anchor.
  const loSteps = Math.floor((Math.min(0, ...values) - 0.005) / TICK + 1e-9)
  const hiSteps = Math.ceil((Math.max(0, ...values) + 0.005) / TICK - 1e-9)
  const lo = loSteps * TICK
  const hi = hiSteps * TICK
  const x = (v: number) => PLOT_X0 + ((v - lo) / (hi - lo)) * (plotX1 - PLOT_X0)
  const ticks: number[] = []
  for (let s = loSteps; s <= hiSteps; s++) {
    ticks.push(Math.round(s * TICK * 100) / 100)
  }

  const ribbon = spec.makingRibbon
    ? BIN_INTERVALS.map(({ bin, from, to }) => ({
        bin,
        from: Math.max(from, lo),
        to: Math.min(to, hi),
      })).filter((seg) => seg.from < seg.to)
    : []

  const height = TOP_PAD + HEADER_H + metrics.zones.length * ROW_H + 4

  return (
    <div className="creation-chart" ref={containerRef}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={spec.ariaLabel}>
        {/* The fixed making scale on the axis itself: same bins, same
            palette classes as the court — color stays magnitude-only. */}
        {ribbon.length > 0 && (
          <g className="comparison-making-ribbon">
            {ribbon.map((seg) => (
              <rect
                key={seg.bin}
                className={makingBinClass(seg.bin)}
                x={x(seg.from)}
                y={14}
                width={x(seg.to) - x(seg.from)}
                height={4}
              />
            ))}
          </g>
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line
              className={t === 0 ? 'creation-gridline growth-zeroline' : 'creation-gridline'}
              x1={x(t)}
              y1={TOP_PAD - 4}
              x2={x(t)}
              y2={height - 4}
            />
            <text className="creation-grid-label" x={x(t)} y={12} textAnchor="middle">
              {tickLabel(t)}
            </text>
          </g>
        ))}
        <text className="creation-chart-group" x={0} y={TOP_PAD + HEADER_H - 8}>
          {spec.title}
        </text>
        {metrics.zones.map((row, i) => {
          const cy = TOP_PAD + HEADER_H + i * ROW_H + ROW_H / 2
          const leftValue = spec.value(row, 'left')
          const rightValue = spec.value(row, 'right')
          return (
            <g key={row.zone}>
              <text
                className="creation-chart-label"
                x={LABEL_X - 8}
                y={cy}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {row.zone}
              </text>
              {leftValue !== null && rightValue !== null && (
                <line
                  className="creation-connector"
                  x1={x(leftValue)}
                  y1={cy}
                  x2={x(rightValue)}
                  y2={cy}
                />
              )}
              {/* Right before left, so a coincident pair still shows the
                  solid circle over the outlined diamond's open center. */}
              {rightValue !== null && (
                <>
                  <rect
                    className="comparison-dot-right"
                    x={x(rightValue) - DIAMOND_R}
                    y={cy - DIAMOND_R}
                    width={DIAMOND_R * 2}
                    height={DIAMOND_R * 2}
                    transform={`rotate(45 ${x(rightValue)} ${cy})`}
                  />
                  <text
                    className="comparison-value"
                    x={x(rightValue)}
                    y={cy + 18}
                    textAnchor="middle"
                  >
                    {withSmallSampleMark(spec.label(row, 'right'), spec.flagged(row, 'right'))}
                  </text>
                </>
              )}
              {leftValue !== null && (
                <>
                  <circle
                    className="comparison-dot-left"
                    cx={x(leftValue)}
                    cy={cy}
                    r={DOT_R}
                  />
                  <text
                    className="comparison-value"
                    x={x(leftValue)}
                    y={cy - 11}
                    textAnchor="middle"
                  >
                    {withSmallSampleMark(spec.label(row, 'left'), spec.flagged(row, 'left'))}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function ComparisonZoneChart({ metrics }: { metrics: ComparisonMetrics }) {
  const { left, right } = metrics
  const dietSpec: PanelSpec = {
    title: 'DIET GAP vs LG SHARE (PP)',
    ariaLabel:
      `Shot diet comparison: attempt-share gap vs league share by zone, ` +
      `${left.label} (solid circle) vs ${right.label} (outlined diamond), in share points; ` +
      `full numbers in the zone comparison table`,
    value: (row, side) => {
      const r = row[side]
      return r.attemptShare === null ? null : r.attemptShare - r.leagueAttemptShare
    },
    // The table twin shows this gap's two anchors (Share and Lg), so the
    // label must be their DISPLAYED difference — a rounded raw gap can
    // disagree with the table by a display unit (the acceptance review's
    // one reconciliation miss).
    label: (row, side) => {
      const r = row[side]
      return formatSignedGap(
        r.attemptShare === null ? null : r.attemptShare * 100,
        r.leagueAttemptShare * 100,
        1,
      )
    },
    // Below the 15-attempt bar the share reading is too thin to be stable
    // (ADR-0075) — the marker stays, the label carries the flag.
    flagged: (row, side) => !row[side].included,
    makingRibbon: false,
  }
  const makingSpec: PanelSpec = {
    title: 'MAKING Δ vs LG (FG% PP)',
    ariaLabel:
      `Shot making comparison: FG% delta vs league by zone, ` +
      `${left.label} (solid circle) vs ${right.label} (outlined diamond), in percentage points, ` +
      `on the fixed making scale; full numbers in the zone comparison table`,
    value: (row, side) => row[side].makingDelta,
    // The same rounded-raw string as the table's Making Δ column (whose
    // FG% anchors round independently by design; the delta is the column).
    label: (row, side) => formatSignedPp1(row[side].makingDelta),
    flagged: (row, side) => row[side].smallSampleMaking,
    makingRibbon: true,
  }
  return (
    <div className="comparison-zone-visual">
      {/* Identity legend (aria-hidden: the charts' aria-labels name the
          sides and their marks in words). */}
      <div className="creation-legend" aria-hidden="true">
        <span className="comparison-swatch-left" /> {left.label}
        <span className="comparison-swatch-right" /> {right.label}
      </div>
      <div className="comparison-zone-panels">
        <Panel metrics={metrics} spec={dietSpec} />
        <Panel metrics={metrics} spec={makingSpec} />
      </div>
    </div>
  )
}
