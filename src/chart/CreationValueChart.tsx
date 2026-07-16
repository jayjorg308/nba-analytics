// The creation-value chart (ADR-0031, as amended): per creation context, a
// dumbbell — his PPS vs the league's on one shared positional axis — because
// the section's NEW information is what each kind of shot is worth, not
// where the diet sits (the diet largely restates the zone story; prominence
// follows differentiation, ADR-0018). Hand-rolled SVG themed by the shared
// CSS variables, no chart library (ADR-0011). Positional encoding only: the
// making palette means "FG% delta vs league" and nothing else
// (ADR-0013/0014), and a dumbbell needs no color scale at all.
//
// Presentation mapping over aggregation outputs: PPS values come off
// aggregateCreationMetrics untouched; the only quantities computed here are
// pixel positions. The creation table is the accessible data twin (ADR-0027
// stance) — this SVG keeps image semantics, no tooltips, nothing hover-only.
// A zero-attempt context draws only the league dot: no data is not a value
// claim (ADR-0013 ported).

import type { CreationMetrics } from '../domain/aggregateCreation'
import {
  formatClockBand,
  formatCreationContext,
  formatPps2,
  JUMPERS_LABEL,
  withSmallSampleMark,
} from '../format'

// viewBox geometry (SVG user units), calibrated like the court's: the
// 520-unit width renders ~1:1 in the desktop column (the court is 540);
// ≤640px viewports get the same font-size bump the court labels get
// (App.css).
const WIDTH = 520
const LABEL_X = 170 // row labels right-align just before the plot
const PLOT_X0 = 186 // the PPS axis spans this range
const PLOT_X1 = 490
const DOT_R = 4.5
const ROW_H = 44
const GROUP_HEADER_H = 34
const GROUP_GAP = 18 // extra space before each subsequent group's header
const TOP_PAD = 22 // room for the axis tick labels above the first group

interface ValueRow {
  label: string
  /** ≤640px swap (CSS-driven): the bumped mobile font clips labels longer
   * than the label column — the short form must carry the same meaning. */
  shortLabel?: string
  pps: number | null
  leaguePps: number | null
  smallSamplePps: boolean
}

interface Group {
  title: string
  rows: ValueRow[]
}

function groups(metrics: CreationMetrics): Group[] {
  const { inside, jumpers, jumperContexts } = metrics.general
  const row = (label: string, r: Pick<ValueRow, 'pps' | 'leaguePps' | 'smallSamplePps'>) => ({
    label,
    pps: r.pps,
    leaguePps: r.leaguePps,
    smallSamplePps: r.smallSamplePps,
  })
  return [
    {
      title: 'HOW THE SHOT ARRIVED',
      rows: [
        row(formatCreationContext(inside.context), inside),
        // Short form for phones: 'Inside 10 ft' above it implies the
        // complement, and the group header + table carry the boundary.
        { ...row(JUMPERS_LABEL, jumpers), shortLabel: 'Jumpers' },
      ],
    },
    {
      title: 'JUMPERS, BY CREATION',
      rows: jumperContexts.map((r) => row(formatCreationContext(r.context), r)),
    },
    {
      title: 'SHOT CLOCK',
      rows: metrics.shotClock.map((r) => row(formatClockBand(r.band, r.seconds), r)),
    },
  ]
}

interface PositionedGroup {
  title: string
  headerY: number
  rows: (ValueRow & { y: number })[]
}

/** Pure layout pass: every y position computed before render touches it. */
function layout(gs: Group[]): { positioned: PositionedGroup[]; height: number } {
  let y = TOP_PAD
  const positioned: PositionedGroup[] = []
  for (const [gi, group] of gs.entries()) {
    if (gi > 0) y += GROUP_GAP
    const headerY = y + GROUP_HEADER_H - 8
    y += GROUP_HEADER_H
    const rows = group.rows.map((row) => {
      const rowY = y
      y += ROW_H
      return { ...row, y: rowY }
    })
    positioned.push({ title: group.title, headerY, rows })
  }
  return { positioned, height: y + 4 }
}

export function CreationValueChart({ metrics }: { metrics: CreationMetrics }) {
  const gs = groups(metrics)
  const values = gs
    .flatMap((g) => g.rows)
    .flatMap((r) => [r.pps, r.leaguePps])
    .filter((v): v is number => v !== null)

  // One shared PPS axis, padded and rounded to tenths. A dumbbell encodes
  // positions, not lengths, so the axis needn't start at zero — the ticks
  // keep it honest.
  const lo = Math.floor((Math.min(...values) - 0.05) * 10) / 10
  const hi = Math.ceil((Math.max(...values) + 0.05) * 10) / 10
  const x = (v: number) => PLOT_X0 + ((v - lo) / (hi - lo)) * (PLOT_X1 - PLOT_X0)
  const ticks: number[] = []
  for (let t = Math.ceil(lo / 0.2) * 0.2; t <= hi + 1e-9; t += 0.2) {
    ticks.push(Math.round(t * 10) / 10)
  }

  const { positioned, height } = layout(gs)

  return (
    <div className="creation-chart">
      <div className="creation-legend" aria-hidden="true">
        <span className="creation-swatch creation-swatch-player" /> his PPS
        <span className="creation-swatch creation-swatch-league" /> lg PPS
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={`Creation value: points per shot by creation context over ${metrics.seasonFga} attempts, his conversion vs league average — full numbers in the shot creation table`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              className="creation-gridline"
              x1={x(t)}
              y1={TOP_PAD - 4}
              x2={x(t)}
              y2={height - 4}
            />
            <text className="creation-grid-label" x={x(t)} y={12} textAnchor="middle">
              {formatPps2(t)}
            </text>
          </g>
        ))}
        {positioned.map((group) => (
          <g key={group.title}>
            <text className="creation-chart-group" x={0} y={group.headerY}>
              {group.title}
            </text>
            {group.rows.map((row) => {
              const cy = row.y + ROW_H / 2
              return (
                <g key={row.label}>
                  <text
                    className={`creation-chart-label${row.shortLabel ? ' creation-label-full' : ''}`}
                    x={LABEL_X - 8}
                    y={cy}
                    textAnchor="end"
                    dominantBaseline="middle"
                  >
                    {row.label}
                  </text>
                  {row.shortLabel && (
                    <text
                      className="creation-chart-label creation-label-short"
                      x={LABEL_X - 8}
                      y={cy}
                      textAnchor="end"
                      dominantBaseline="middle"
                    >
                      {row.shortLabel}
                    </text>
                  )}
                  {row.leaguePps !== null && (
                    <>
                      {row.pps !== null && (
                        <line
                          className="creation-connector"
                          x1={x(row.leaguePps)}
                          y1={cy}
                          x2={x(row.pps)}
                          y2={cy}
                        />
                      )}
                      <circle
                        className="creation-dot-league"
                        cx={x(row.leaguePps)}
                        cy={cy}
                        r={DOT_R}
                      />
                      <text
                        className="creation-value-lg"
                        x={x(row.leaguePps)}
                        y={cy + 18}
                        textAnchor="middle"
                      >
                        {formatPps2(row.leaguePps)}
                      </text>
                    </>
                  )}
                  {row.pps !== null && (
                    <>
                      <circle className="creation-dot-player" cx={x(row.pps)} cy={cy} r={DOT_R} />
                      <text
                        className="creation-value-his"
                        x={x(row.pps)}
                        y={cy - 11}
                        textAnchor="middle"
                      >
                        {withSmallSampleMark(formatPps2(row.pps), row.smallSamplePps)}
                      </text>
                    </>
                  )}
                </g>
              )
            })}
          </g>
        ))}
      </svg>
    </div>
  )
}
