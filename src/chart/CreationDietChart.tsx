// The creation-diet chart (ADR-0031): per creation context, a paired
// horizontal bar — his attempt share vs the league's — hand-rolled SVG
// themed by the shared CSS variables, direct labels, no chart library
// (ADR-0011). Neutral ink only: the making palette means "FG% delta vs
// league" and nothing else (ADR-0013/0014), and a creation-value encoding
// would need its own guarded scale contract — deliberately not paid in v2.0.
//
// Presentation mapping over aggregation outputs only: shares come off
// aggregateCreationMetrics untouched; the single quantity computed here is
// pixel width. The creation table is the accessible data twin (ADR-0027
// stance) — this SVG keeps image semantics, no tooltips, nothing hover-only.

import type { CreationMetrics } from '../domain/aggregateCreation'
import { formatClockBand, formatCreationContext, formatPercent1 } from '../format'

// viewBox geometry (SVG user units), calibrated like the court's: the
// 520-unit width renders ~1:1 in the desktop column (the court is 540), so
// design sizes are real pixels there; ≤640px viewports get the same
// font-size bump the court labels get (App.css). The label column fits the
// longest label at the bumped size; bars share one linear scale so length
// is comparable across every row of both families.
const WIDTH = 520
const LABEL_X = 170 // bars start here; labels right-align just before it
const BAR_MAX = 270 // widest bar (the scale's domain maps onto this)
const VALUE_GAP = 6 // bar end -> value label
const BAR_H = 12
const BAR_GAP = 3 // player bar -> league bar within a row
const ROW_H = 44 // two bars + breathing room
const GROUP_HEADER_H = 34
const GROUP_GAP = 18 // extra space before the second group's header
const TOP_PAD = 4

interface BarRow {
  label: string
  attemptShare: number | null
  leagueAttemptShare: number
}

interface Group {
  title: string
  rows: BarRow[]
}

function groups(metrics: CreationMetrics): Group[] {
  return [
    {
      title: 'HOW THE SHOT ARRIVED',
      rows: metrics.general.map((r) => ({
        label: formatCreationContext(r.context),
        attemptShare: r.attemptShare,
        leagueAttemptShare: r.leagueAttemptShare,
      })),
    },
    {
      title: 'SHOT CLOCK',
      rows: metrics.shotClock.map((r) => ({
        label: formatClockBand(r.band, r.seconds),
        attemptShare: r.attemptShare,
        leagueAttemptShare: r.leagueAttemptShare,
      })),
    },
  ]
}

interface PositionedGroup {
  title: string
  headerY: number
  rows: (BarRow & { y: number })[]
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

export function CreationDietChart({ metrics }: { metrics: CreationMetrics }) {
  const gs = groups(metrics)
  const allRows = gs.flatMap((g) => g.rows)

  // One shared linear scale, domain = the largest share on either side
  // rounded up to the next 10% — direct value labels carry the exact
  // numbers, the lengths carry the comparison.
  const maxShare = Math.max(...allRows.map((r) => Math.max(r.attemptShare ?? 0, r.leagueAttemptShare)))
  const domain = Math.max(0.1, Math.ceil(maxShare * 10) / 10)
  const barWidth = (share: number | null) => ((share ?? 0) / domain) * BAR_MAX

  const { positioned, height } = layout(gs)

  return (
    <div className="creation-chart">
      <div className="creation-legend" aria-hidden="true">
        <span className="creation-swatch creation-swatch-player" /> his share
        <span className="creation-swatch creation-swatch-league" /> lg share
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={`Creation diet: ${metrics.seasonFga} attempts by creation context, his share vs league average — full numbers in the shot creation table`}
      >
        {positioned.map((group) => {
          return (
            <g key={group.title}>
              <text className="creation-chart-group" x={0} y={group.headerY}>
                {group.title}
              </text>
              {group.rows.map((row) => {
                const playerW = barWidth(row.attemptShare)
                const leagueW = barWidth(row.leagueAttemptShare)
                const barsTop = row.y + (ROW_H - (2 * BAR_H + BAR_GAP)) / 2 - 2
                return (
                  <g key={row.label}>
                    <text
                      className="creation-chart-label"
                      x={LABEL_X - 8}
                      y={barsTop + BAR_H + BAR_GAP / 2}
                      textAnchor="end"
                      dominantBaseline="middle"
                    >
                      {row.label}
                    </text>
                    <rect
                      className="creation-bar-player"
                      x={LABEL_X}
                      y={barsTop}
                      width={playerW}
                      height={BAR_H}
                    />
                    <text
                      className="creation-chart-value"
                      x={LABEL_X + playerW + VALUE_GAP}
                      y={barsTop + BAR_H / 2}
                      dominantBaseline="middle"
                    >
                      {formatPercent1(row.attemptShare)}
                    </text>
                    <rect
                      className="creation-bar-league"
                      x={LABEL_X}
                      y={barsTop + BAR_H + BAR_GAP}
                      width={leagueW}
                      height={BAR_H}
                    />
                    <text
                      className="creation-chart-value creation-chart-value-lg"
                      x={LABEL_X + leagueW + VALUE_GAP}
                      y={barsTop + BAR_H + BAR_GAP + BAR_H / 2}
                      dominantBaseline="middle"
                    >
                      {formatPercent1(row.leagueAttemptShare)}
                    </text>
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
