// The line-vs-floor chart (ADR-0056): per value-bearing trip class (the
// two-shot and three-shot shooting fouls), a dumbbell — his points per trip
// vs a league shooter's expected points — on one shared points-per-attempt
// axis, with the league zone-baseline PPS values drawn as labeled reference
// ticks. The picture argues in one glance: a trip to the line is worth more
// than a shot from anywhere on the floor, and here is whether he cashes it.
//
// The creation value chart's dumbbell grammar, reused deliberately (one
// grammar the reader learns once — its CSS classes are the shared dumbbell
// vocabulary, not creation-specific styling). Cross-payload juxtaposition is
// pure formatting (ADR-0011): trip values come off aggregateFreethrowMetrics,
// zone reference values off aggregateShotMetrics, and the only quantities
// computed here are pixel positions. The free-throws table is the accessible
// data twin — image semantics, no tooltips, nothing hover-only (ADR-0027).
// The dot floor is aggregation-owned (chartIncluded, ≥15 FTA at the shared
// bar): below it a class draws only its league dot, like a thin zone
// (no data is not a value claim — ADR-0013, third use).

import { useEffect, useRef, useState } from 'react'
import type { FreethrowMetrics, TripClassRow } from '../domain/aggregateFreethrow'
import { formatPps2, formatTripClass, withSmallSampleMark } from '../format'

/** A league zone's PPS, marked on the shared axis so trip value reads
 * against the floor's (ADR-0056). Built by the caller as a mapping over
 * aggregateShotMetrics zone rows. */
export interface FloorReference {
  label: string
  pps: number
}

const WIDTH = 520
const LABEL_X = 170
const PLOT_X0 = 186
const PLOT_X1 = 490
const PLOT_RIGHT_PAD = WIDTH - PLOT_X1
const DOT_R = 4.5
// Two dumbbell rows carry this act, so they get more air than the creation
// chart's eleven — a compact pair reads jammed in a column built for a
// taller visual.
const ROW_H = 64
const TOP_PAD = 26
// The bottom strip where the floor's reference labels live: one row per
// reference, a cascade — collision-proof at any hero's axis range and any
// scale (the ≤480px font bump widens labels ~30%, which broke a two-row
// stagger on phones).
const REF_ROW_H = 26
const REF_STRIP_PAD = 20

/** The chart rows only the value-bearing shooting-foul classes (ADR-0056):
 * the denied attempts the whistle priced at two or three free throws. */
const CHARTED_CLASSES = ['shootingFoul2', 'shootingFoul3'] as const

export function LineVsFloorChart({
  metrics,
  floorReferences,
}: {
  metrics: FreethrowMetrics
  floorReferences: FloorReference[]
}) {
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

  const rows = CHARTED_CLASSES.map(
    (tripClass) => metrics.tripClasses.find((row) => row.tripClass === tripClass)!,
  )
  const playerValue = (row: TripClassRow): number | null =>
    row.chartIncluded ? row.pointsPerTrip : null

  const references = [...floorReferences].sort((a, b) => a.pps - b.pps)
  const values = [
    ...rows.flatMap((row) => [playerValue(row), row.leagueExpectedPointsPerTrip]),
    ...references.map((ref) => ref.pps),
  ].filter((v): v is number => v !== null)

  // Same axis discipline as the creation chart: padded outward to the tick
  // step so the axis always ends on a labeled gridline; a dumbbell encodes
  // positions, not lengths, so it needn't start at zero.
  const TICK = 0.2
  const loSteps = Math.floor((Math.min(...values) - 0.05) / TICK + 1e-9)
  const hiSteps = Math.ceil((Math.max(...values) + 0.05) / TICK - 1e-9)
  const lo = loSteps * TICK
  const hi = hiSteps * TICK
  const x = (v: number) => PLOT_X0 + ((v - lo) / (hi - lo)) * (plotX1 - PLOT_X0)
  // A trip axis spans wider than a shot axis (a three-shot trip prices near
  // 2.4), and twelve 0.20-step labels collide at the design width — so past
  // eight steps, gridlines keep the 0.20 rhythm but labels thin to the 0.40
  // multiples (anchored on even steps, so the labeled set is stable).
  const labelEveryStep = hiSteps - loSteps > 8 ? 2 : 1
  const ticks: { value: number; labeled: boolean }[] = []
  for (let s = loSteps; s <= hiSteps; s++) {
    ticks.push({
      value: Math.round(s * TICK * 10) / 10,
      labeled: labelEveryStep === 1 || s % 2 === 0,
    })
  }

  const rowsTop = TOP_PAD
  const refTop = rowsTop + rows.length * ROW_H + 6
  const height = refTop + REF_STRIP_PAD + references.length * REF_ROW_H

  return (
    <div className="creation-chart line-chart" ref={containerRef}>
      <div className="creation-legend" aria-hidden="true">
        <span className="creation-swatch creation-swatch-player" /> his points per trip
        <span className="creation-swatch creation-swatch-league" /> a league shooter&apos;s trip
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={
          'The line vs the floor: points per trip for his fouled shots, his conversion vs ' +
          'a league shooter, with league zone values marked on the same axis; full numbers ' +
          'in the free throws table'
        }
      >
        {ticks.map((t) => (
          <g key={t.value}>
            <line
              className="creation-gridline"
              x1={x(t.value)}
              y1={TOP_PAD - 4}
              x2={x(t.value)}
              y2={refTop}
            />
            {t.labeled && (
              <text className="creation-grid-label" x={x(t.value)} y={12} textAnchor="middle">
                {formatPps2(t.value)}
              </text>
            )}
          </g>
        ))}
        {rows.map((row, index) => {
          const cy = rowsTop + index * ROW_H + ROW_H / 2
          const his = playerValue(row)
          return (
            <g key={row.tripClass}>
              <text
                className="creation-chart-label"
                x={LABEL_X - 8}
                y={cy}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {formatTripClass(row.tripClass)}
              </text>
              {row.leagueExpectedPointsPerTrip !== null && (
                <>
                  {his !== null && (
                    <line
                      className="creation-connector"
                      x1={x(row.leagueExpectedPointsPerTrip)}
                      y1={cy}
                      x2={x(his)}
                      y2={cy}
                    />
                  )}
                  <circle
                    className="creation-dot-league"
                    cx={x(row.leagueExpectedPointsPerTrip)}
                    cy={cy}
                    r={DOT_R}
                  />
                  <text
                    className="creation-value-lg"
                    x={x(row.leagueExpectedPointsPerTrip)}
                    y={cy + 18}
                    textAnchor="middle"
                  >
                    {formatPps2(row.leagueExpectedPointsPerTrip)}
                  </text>
                </>
              )}
              {his !== null && (
                <>
                  <circle className="creation-dot-player" cx={x(his)} cy={cy} r={DOT_R} />
                  <text className="creation-value-his" x={x(his)} y={cy - 11} textAnchor="middle">
                    {withSmallSampleMark(formatPps2(his), row.smallSampleConversion)}
                  </text>
                </>
              )}
            </g>
          )
        })}
        {/* The floor: league zone-baseline PPS as reference ticks under the
            rows — where a SHOT from each part of the floor prices, on the
            same axis a TRIP prices. Two-line labels (name over value), one
            cascade row per reference: collision-proof by construction. */}
        {references.map((ref, index) => {
          const labelY = refTop + 16 + index * REF_ROW_H
          return (
            <g key={ref.label}>
              <line
                className="floor-ref-line"
                x1={x(ref.pps)}
                y1={TOP_PAD - 4}
                x2={x(ref.pps)}
                y2={labelY - 8}
              />
              <text className="floor-ref-label" x={x(ref.pps)} y={labelY} textAnchor="middle">
                <tspan x={x(ref.pps)}>{ref.label}</tspan>
                <tspan x={x(ref.pps)} dy={11}>
                  {formatPps2(ref.pps)}
                </tspan>
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
