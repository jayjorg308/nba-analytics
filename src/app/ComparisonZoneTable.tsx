// The zone comparison's accessible data twin (comparison plan §4): both
// sides' FGA, shares, league share, FG%, and making delta, with the
// explicit right-minus-left gaps — every zone present regardless of
// thinness (ADR-0075: flags, never suppression), every number a formatted
// aggregation output (ADR-0011), and every Δ the gap of its two DISPLAYED
// anchors (formatSignedGap in the anchors' own display units — ADR-0023).

import type { ComparisonMetrics, ComparisonZoneRow } from '../domain/aggregateComparison'
import {
  formatPercent1,
  formatSignedGap,
  formatSignedPp1,
  withSmallSampleMark,
} from '../format'
import { Term } from './Term'

/** Anchor rescale for gap arithmetic: shares and making deltas display in
 * percentage points at 1 dp, so their gaps must subtract at that grain. */
function pp(x: number | null): number | null {
  return x === null ? null : x * 100
}

function ZoneComparisonRow({ row }: { row: ComparisonZoneRow }) {
  const { left, right } = row
  return (
    <tr>
      <th scope="row">{row.zone}</th>
      <td>{left.attempts}</td>
      <td>{right.attempts}</td>
      <td>{withSmallSampleMark(formatPercent1(left.attemptShare), !left.included)}</td>
      <td>{withSmallSampleMark(formatPercent1(right.attemptShare), !right.included)}</td>
      <td className="lg">{formatPercent1(left.leagueAttemptShare)}</td>
      {/* A Δ inherits the flag when either of its windows carries it — the
          derived number can never read cleaner than its inputs (the
          acceptance review's uncertainty-laundering finding). */}
      <td>
        {withSmallSampleMark(
          formatSignedGap(pp(right.attemptShare), pp(left.attemptShare), 1),
          !left.included || !right.included,
        )}
      </td>
      <td>{formatPercent1(left.fgPct)}</td>
      <td>{formatPercent1(right.fgPct)}</td>
      <td>{withSmallSampleMark(formatSignedPp1(left.makingDelta), left.smallSampleMaking)}</td>
      <td>{withSmallSampleMark(formatSignedPp1(right.makingDelta), right.smallSampleMaking)}</td>
      <td>
        {withSmallSampleMark(
          formatSignedGap(pp(right.makingDelta), pp(left.makingDelta), 1),
          left.smallSampleMaking || right.smallSampleMaking,
        )}
      </td>
    </tr>
  )
}

export function ComparisonZoneTable({ metrics }: { metrics: ComparisonMetrics }) {
  const { left, right, zones } = metrics
  const anyThin = zones.some((r) => !r.left.included || !r.right.included)
  const anyFlagged = zones.some((r) => r.left.smallSampleMaking || r.right.smallSampleMaking)
  const backcourt = left.metrics.backcourt.attempts + right.metrics.backcourt.attempts > 0
  return (
    <div className="table-panel">
      <div className="zone-scroll">
        <table
          className="zone-table comparison-zone-table"
          aria-label="Zone comparison: shot diet and shot making by zone, both windows vs league average"
        >
          <thead>
            {/* Metric groups over side columns: like compares beside like,
                and the Δ column closes each comparable group. */}
            <tr className="comparison-group-row">
              <td />
              <th scope="colgroup" colSpan={2}>
                <Term id="fga">FGA</Term>
              </th>
              <th scope="colgroup" colSpan={4}>
                <Term id="attempt-share">Share</Term>
              </th>
              <th scope="colgroup" colSpan={2}>
                FG%
              </th>
              <th scope="colgroup" colSpan={3}>
                <Term id="making-delta">Making Δ</Term>
              </th>
            </tr>
            <tr>
              <th scope="col">Zone</th>
              <th scope="col">{left.label}</th>
              <th scope="col">{right.label}</th>
              <th scope="col">{left.label}</th>
              <th scope="col">{right.label}</th>
              <th scope="col">Lg</th>
              <th scope="col">Δ</th>
              <th scope="col">{left.label}</th>
              <th scope="col">{right.label}</th>
              <th scope="col">{left.label}</th>
              <th scope="col">{right.label}</th>
              <th scope="col">Δ</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((row) => (
              <ZoneComparisonRow key={row.zone} row={row} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-notes">
        {/* The gaps' direction leads with the unambiguous named form, and
            the units are named per column (share points and FG percentage
            points are different quantities). */}
        <p>
          Δ columns: {right.label} minus {left.label}, in share points for Share and FG
          percentage points for Making Δ.
          {(anyThin || anyFlagged) && ' A Δ carries † whenever either of its windows does.'}
        </p>
        {anyThin && (
          <p>
            † beside a Share: fewer than 15 attempts in that window, too thin for a stable
            selection reading (shown, never dropped).
          </p>
        )}
        {anyFlagged && (
          <p>
            † beside a Making Δ: fewer than 50 attempts in that window, treat as uncertain
            (flagged, never suppressed).
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
