import { Fragment } from 'react'
import type { BandMetricsRow, ShotMetrics, ZoneMetricsRow } from '../domain/aggregate'
import { LONG_TWO_BAND } from '../domain/constants'
import { formatPercent1, formatPps2, formatSignedPp1, withSmallSampleMark } from '../format'

function ZoneRow({ row }: { row: ZoneMetricsRow }) {
  return (
    // included=false zones are muted, never deleted (ADR-0008): their
    // attempts still count toward the diet weighting.
    <tr className={row.included ? undefined : 'zone-row-excluded'}>
      <th scope="row">{row.zone}</th>
      <td>{row.attempts}</td>
      <td>{formatPercent1(row.attemptShare)}</td>
      <td>{formatPercent1(row.leagueAttemptShare)}</td>
      <td>
        {formatPercent1(row.fgPct)} <span className="lg">({formatPercent1(row.leagueFgPct)})</span>
      </td>
      <td>
        {formatPps2(row.pps)} <span className="lg">({formatPps2(row.leaguePps)})</span>
      </td>
      <td>{withSmallSampleMark(formatSignedPp1(row.makingDelta), row.smallSampleMaking)}</td>
    </tr>
  )
}

function BandRow({ band }: { band: BandMetricsRow }) {
  return (
    <tr className="band-row">
      <th scope="row">
        {band.band}
        {band.band === LONG_TWO_BAND && (
          // Selection transparency, not a making indictment (ADR-0008).
          <span className="band-note">long two — lowest-value shot on the floor</span>
        )}
      </th>
      <td>{band.attempts}</td>
      <td>{formatPercent1(band.shareOfMidRange)}</td>
      <td>{formatPercent1(band.leagueShareOfMidRange)}</td>
      <td>
        {formatPercent1(band.fgPct)}{' '}
        <span className="lg">({formatPercent1(band.leagueFgPct)})</span>
      </td>
      <td>
        {formatPps2(band.pps)} <span className="lg">({formatPps2(band.leaguePps)})</span>
      </td>
      <td>{withSmallSampleMark(formatSignedPp1(band.makingDelta), band.smallSampleMaking)}</td>
    </tr>
  )
}

/**
 * The accessible data representation of the chart, and the shot-making axis.
 * Every number comes from the single aggregation output — this component
 * formats, it never computes (ADR-0007).
 */
export function ZoneTable({ metrics }: { metrics: ShotMetrics }) {
  const { zones, midRangeSplit, cornerSplit, backcourt } = metrics
  const anyExcluded = zones.some((z) => !z.included)
  const anyFlagged =
    zones.some((z) => z.smallSampleMaking) ||
    (midRangeSplit.visible && midRangeSplit.bands.some((b) => b.smallSampleMaking))

  return (
    <section className="zone-panel">
      <table className="zone-table">
        <caption>Zone by zone: shot mix and shot making, vs league average</caption>
        <thead>
          <tr>
            <th scope="col">Zone</th>
            <th scope="col">FGA</th>
            <th scope="col">Share</th>
            <th scope="col">Lg share</th>
            <th scope="col">FG% (lg)</th>
            <th scope="col">PPS (lg)</th>
            <th scope="col">Making Δ (pp)</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((row) => (
            <Fragment key={row.zone}>
              <ZoneRow row={row} />
              {row.zone === 'Mid-Range' &&
                midRangeSplit.visible &&
                midRangeSplit.bands.map((band) => <BandRow key={band.band} band={band} />)}
            </Fragment>
          ))}
        </tbody>
      </table>
      <div className="table-notes">
        {midRangeSplit.visible && (
          <p>Mid-range sub-rows: shares are of mid-range attempts, not of all shots.</p>
        )}
        {cornerSplit.visible && (
          <p>
            Corner 3s: Left {cornerSplit.left.attempts} FGA / Right {cornerSplit.right.attempts}{' '}
            FGA — both clear the volume bar
            {(cornerSplit.left.smallSampleMaking || cornerSplit.right.smallSampleMaking) &&
              '; per-corner making is small-sample†'}
            .
          </p>
        )}
        {backcourt.attempts > 0 && (
          <p>
            Backcourt heaves: {backcourt.attempts} attempt{backcourt.attempts === 1 ? '' : 's'} (
            {backcourt.makes} made) — excluded from evaluation, reported here.
          </p>
        )}
        {anyExcluded && (
          <p>
            Zones under 15 attempts are shown muted; their attempts still count toward the diet.
          </p>
        )}
        {anyFlagged && (
          <p>
            † Making delta on fewer than 50 attempts — treat as uncertain (flagged, never
            suppressed).
          </p>
        )}
      </div>
    </section>
  )
}
