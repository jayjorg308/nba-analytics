// The zone evidence's scoreboard (comparison plan §4 as reshaped by
// ADR-0078): six per-zone cards, each leading with the two calls — Diet
// lean on the diet axis, Making edge on the making axis — over a compact
// stat table of both windows plus the league ruler row. Every zone renders
// regardless of thinness (ADR-0075: flags, never suppression), every
// number is a formatted aggregation output (ADR-0011), and every call
// decides and prices its margin in the gap of its two DISPLAYED anchors
// (displayGapUnits — ADR-0023), so a chip and the numbers beneath it
// always subtract.
//
// Call vocabulary is deliberately asymmetric: "Making edge" names the
// window with the higher making Δ (a result vs the league); "Diet lean"
// names the window taking the larger share of its attempts in the zone (a
// preference, not a result). Neither grades the comparison as a whole —
// the page stays a tool, not an argument.

import type { ComparisonMetrics, ComparisonZoneRow } from '../domain/aggregateComparison'
import type { ZoneMetricsRow } from '../domain/aggregate'
import { formatPercent1, formatSignedGap, withSmallSampleMark } from '../format'
import type { ComparisonCall } from './comparisonCalls'
import { comparisonCall } from './comparisonCalls'
import { shortLabels } from './comparisonLabels'
import { Term } from './Term'

/** Anchor rescale for gap arithmetic: shares and FG% display in percentage
 * points at 1 dp, so their gaps must subtract at that grain. */
function pp(x: number | null): number | null {
  return x === null ? null : x * 100
}

/** Diet lean: who takes the larger share of his attempts in the zone.
 * Inherits the selection-stability flag from either window (ADR-0075's 15
 * bar). */
function dietCall(row: ComparisonZoneRow): ComparisonCall {
  return comparisonCall(
    pp(row.left.attemptShare),
    pp(row.right.attemptShare),
    !row.left.included || !row.right.included,
  )
}

/** Making edge: whose making Δ is higher. Priced on the displayed FG%
 * anchors — the shared league anchor cancels exactly in display units, so
 * the margin equals the gap of the two displayed Making Δ cells. Inherits
 * the making uncertainty flag from either window (ADR-0075's 50 bar) — a
 * call can never read cleaner than its inputs. */
function makingCall(row: ComparisonZoneRow): ComparisonCall {
  return comparisonCall(
    pp(row.left.fgPct),
    pp(row.right.fgPct),
    row.left.smallSampleMaking || row.right.smallSampleMaking,
  )
}

export function SideMark({ side }: { side: 'left' | 'right' }) {
  // Side identity is shape + fill, never color (plan §4): the left window
  // is a solid dot, the right an outlined diamond — the chart's marks.
  return <span className={`comparison-mark-${side}`} aria-hidden="true" />
}

function CallChip({ call, metrics }: { call: ComparisonCall; metrics: ComparisonMetrics }) {
  if (call.kind === 'none') return <span className="comparison-call-chip comparison-call-even">—</span>
  if (call.kind === 'even') {
    return (
      <span className="comparison-call-chip comparison-call-even">
        {withSmallSampleMark('even', call.flagged)}
      </span>
    )
  }
  const names = shortLabels(metrics)
  // Margins carry no unit word: each subtracts the two displayed numbers
  // in the table below, and the notes name the units per call.
  return (
    <span className="comparison-call-chip">
      <SideMark side={call.side} />
      {withSmallSampleMark(`${names[call.side]} +${call.margin}`, call.flagged)}
    </span>
  )
}

/** A window's Making Δ cell: rendered beside its two displayed FG% anchors
 * (the window's and the Lg row's), so it is their gap as displayed, never
 * the rounded raw delta — the ZoneDetailCard precedent (ADR-0023). */
function makingDeltaCell(side: ZoneMetricsRow): string {
  return withSmallSampleMark(
    formatSignedGap(pp(side.fgPct), pp(side.leagueFgPct), 1),
    side.smallSampleMaking,
  )
}

function ZoneCard({ row, metrics }: { row: ComparisonZoneRow; metrics: ComparisonMetrics }) {
  const names = shortLabels(metrics)
  return (
    <section className="comparison-zone-card" aria-label={row.zone}>
      <header className="comparison-zone-card-head">
        <h3>{row.zone}</h3>
      </header>
      <div className="comparison-card-calls">
        <div className="comparison-card-call">
          <span className="comparison-card-call-label">Diet lean</span>
          <CallChip call={dietCall(row)} metrics={metrics} />
        </div>
        <div className="comparison-card-call">
          <span className="comparison-card-call-label">Making edge</span>
          <CallChip call={makingCall(row)} metrics={metrics} />
        </div>
      </div>
      <table className="comparison-card-table">
        <thead>
          <tr>
            <td />
            <th scope="col">FGA</th>
            <th scope="col">Share</th>
            <th scope="col">FG%</th>
            <th scope="col">Making Δ</th>
          </tr>
        </thead>
        <tbody>
          {(
            [
              ['left', names.left, row.left],
              ['right', names.right, row.right],
            ] as const
          ).map(([id, name, side]) => (
            <tr key={id}>
              <th scope="row">
                <SideMark side={id} /> {name}
              </th>
              <td>{side.attempts}</td>
              <td>{withSmallSampleMark(formatPercent1(side.attemptShare), !side.included)}</td>
              <td>{formatPercent1(side.fgPct)}</td>
              <td>{makingDeltaCell(side)}</td>
            </tr>
          ))}
          {/* The league ruler row (ADR-0074: one baseline for both windows):
              the share and FG% every number above reads against. Its FGA is
              league-wide and its Making Δ is the zero point — neither is a
              comparable value, so both stay em dashes. */}
          <tr className="comparison-card-row-lg">
            <th scope="row">Lg</th>
            <td>—</td>
            <td>{formatPercent1(row.left.leagueAttemptShare)}</td>
            <td>{formatPercent1(row.left.leagueFgPct)}</td>
            <td>—</td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}

export function ComparisonZoneScoreboard({ metrics }: { metrics: ComparisonMetrics }) {
  const { left, right, zones } = metrics
  const anyThin = zones.some((r) => !r.left.included || !r.right.included)
  const anyFlagged = zones.some((r) => r.left.smallSampleMaking || r.right.smallSampleMaking)
  const backcourt = left.metrics.backcourt.attempts + right.metrics.backcourt.attempts > 0
  return (
    <div className="table-panel">
      <div className="comparison-scoreboard">
        {zones.map((row) => (
          <ZoneCard key={row.zone} row={row} metrics={metrics} />
        ))}
      </div>
      <div className="table-notes">
        <p>
          <Term id="making-delta">Making Δ</Term>: a window&apos;s FG% minus the Lg row&apos;s
          FG% in the same zone, in FG percentage points.
        </p>
        <p>
          Diet lean: the window taking the larger <Term id="attempt-share">share</Term> of its
          attempts in the zone, margin in share points. Making edge: the window with the higher
          making Δ, margin in FG percentage points.
        </p>
        <p>
          Each margin is the gap of the two displayed numbers, and margins under 1.0 read as
          even.
          {(anyThin || anyFlagged) && ' A call carries † whenever either of its windows does.'}
        </p>
        {anyThin && (
          <p>
            † on a share or a Diet lean call: fewer than 15 attempts in that window, too thin
            for a stable selection reading (shown, never dropped).
          </p>
        )}
        {anyFlagged && (
          <p>
            † on a making Δ or a Making edge call: fewer than 50 attempts in that window, treat
            as uncertain (flagged, never suppressed).
          </p>
        )}
        {backcourt && (
          // The backcourt report (the dropped-and-counted ethos): excluded
          // from evaluation, stated per window whenever either has any.
          <p>
            Backcourt heaves, excluded from evaluation: {left.label}{' '}
            {left.metrics.backcourt.attempts} ({left.metrics.backcourt.makes} made) ·{' '}
            {right.label} {right.metrics.backcourt.attempts} ({right.metrics.backcourt.makes}{' '}
            made).
          </p>
        )}
      </div>
    </div>
  )
}
