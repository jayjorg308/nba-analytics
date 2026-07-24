// The growth coda's visual (ADR-0062): the product's one comparison grammar
// — the dumbbell, two dots on one positional axis — with the pair
// reinterpreted as the two SEASONS. Per evaluation zone, the axis is the
// diet-share gap vs league in share points (his share minus the league's,
// each season against its own season's league), so league drift is already
// netted out of the picture. The chart deliberately charts the DIET axis:
// attempt shares stabilize early while per-zone conversion stays †-flagged
// to 50, so this is the axis that reads true from flip day; making movement
// lives in the table twin with its flags.
//
// Class reuse is the ADR-0062 consequence made literal: the dumbbell dot
// classes gain a second documented meaning — .creation-dot-player marks the
// CURRENT season, .creation-dot-league the PRIOR one (emphasis = now,
// muted = then) — so no new palette and no new component class exists. The
// coda's gate (ADR-0061) guarantees every zone clears the inclusion bar on
// both sides, so there is no dot-floor case here; nulls (a zone with no
// attempts at all) simply draw nothing, per the ADR-0013 stance.
//
// Hand-rolled SVG, image semantics, no tooltips; the growth table is the
// accessible data twin (ADR-0027 stance). Presentation mapping over
// aggregation outputs: the only quantities computed here are pixel
// positions (ADR-0011).

import { useEffect, useRef, useState } from 'react'
import type { GrowthMetrics } from '../domain/aggregateGrowth'
import { formatSignedPp1 } from '../format'

// viewBox geometry — the creation value chart's calibration (see its
// comment): WIDTH is the design width and the floor the viewBox never
// shrinks below; wider containers extend the axis at 1:1 type.
const WIDTH = 520
const LABEL_X = 170
const PLOT_X0 = 186
const PLOT_X1 = 490
const PLOT_RIGHT_PAD = WIDTH - PLOT_X1
const DOT_R = 4.5
const ROW_H = 44
const HEADER_H = 34
const TOP_PAD = 22

/** Axis tick label: share points, signed, integer grain ("+5", "0", "−10"). */
function tickLabel(t: number): string {
  const pp = Math.round(t * 100)
  if (pp === 0) return '0'
  return `${pp < 0 ? '−' : '+'}${Math.abs(pp)}`
}

export function GrowthDietChart({ metrics }: { metrics: GrowthMetrics }) {
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
    .flatMap((z) => [z.prior.dietGap, z.current.dietGap])
    .filter((v): v is number => v !== null)

  // One shared share-point axis, padded and rounded outward to the TICK step
  // (the creation chart's rule), and always spanning zero — the league line
  // is the axis's anchor, so it must be on the picture.
  const TICK = 0.05
  const loSteps = Math.floor((Math.min(0, ...values) - 0.005) / TICK + 1e-9)
  const hiSteps = Math.ceil((Math.max(0, ...values) + 0.005) / TICK - 1e-9)
  const lo = loSteps * TICK
  const hi = hiSteps * TICK
  const x = (v: number) => PLOT_X0 + ((v - lo) / (hi - lo)) * (plotX1 - PLOT_X0)
  const ticks: number[] = []
  for (let s = loSteps; s <= hiSteps; s++) {
    ticks.push(Math.round(s * TICK * 100) / 100)
  }

  const height = TOP_PAD + HEADER_H + metrics.zones.length * ROW_H + 4

  return (
    <div className="creation-chart" ref={containerRef}>
      <div className="creation-legend" aria-hidden="true">
        <span className="creation-swatch creation-swatch-player" /> {metrics.currentSeason}
        <span className="creation-swatch creation-swatch-league" /> {metrics.priorSeason}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Season over season shot diet: attempt-share gap vs league share by zone, ${metrics.priorSeason} vs ${metrics.currentSeason}, in share points; full numbers in the season over season table`}
      >
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
          DIET GAP vs LG SHARE (PP)
        </text>
        {metrics.zones.map((row, i) => {
          const cy = TOP_PAD + HEADER_H + i * ROW_H + ROW_H / 2
          const prior = row.prior.dietGap
          const current = row.current.dietGap
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
              {prior !== null && current !== null && (
                <line
                  className="creation-connector"
                  x1={x(prior)}
                  y1={cy}
                  x2={x(current)}
                  y2={cy}
                />
              )}
              {prior !== null && (
                <>
                  <circle className="creation-dot-league" cx={x(prior)} cy={cy} r={DOT_R} />
                  <text
                    className="creation-value-lg"
                    x={x(prior)}
                    y={cy + 18}
                    textAnchor="middle"
                  >
                    {formatSignedPp1(prior)}
                  </text>
                </>
              )}
              {current !== null && (
                <>
                  <circle className="creation-dot-player" cx={x(current)} cy={cy} r={DOT_R} />
                  <text
                    className="creation-value-his"
                    x={x(current)}
                    y={cy - 11}
                    textAnchor="middle"
                  >
                    {formatSignedPp1(current)}
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
