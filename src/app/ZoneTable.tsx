import { Fragment } from 'react'
import type { BandMetricsRow, ShotMetrics, ZoneMetricsRow } from '../domain/aggregate'
import { LONG_TWO_BAND, ZONE_POINT_VALUE } from '../domain/constants'
import { formatPercent1, formatPps2, formatSignedPp1, withSmallSampleMark } from '../format'

function ZoneRow({ row, child = false }: { row: ZoneMetricsRow; child?: boolean }) {
  const className =
    [child ? 'zone-row-child' : null, row.included ? null : 'zone-row-excluded']
      .filter(Boolean)
      .join(' ') || undefined
  return (
    // included=false zones are muted, never deleted (ADR-0008): their
    // attempts still count toward the diet weighting.
    <tr className={className}>
      <th scope="row">{row.zone}</th>
      <td>{row.attempts}</td>
      <td>{formatPercent1(row.attemptShare)}</td>
      <td>{formatPercent1(row.leagueAttemptShare)}</td>
      <td>{withSmallSampleMark(formatSignedPp1(row.makingDelta), row.smallSampleMaking)}</td>
      <td>
        {formatPps2(row.pps)} <span className="lg">({formatPps2(row.leaguePps)})</span>
      </td>
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
      <td>{withSmallSampleMark(formatSignedPp1(band.makingDelta), band.smallSampleMaking)}</td>
      <td>
        {formatPps2(band.pps)} <span className="lg">({formatPps2(band.leaguePps)})</span>
      </td>
    </tr>
  )
}

/**
 * The accessible data representation of the chart, and the shot-making axis.
 * Every number comes from the single aggregation output — this component
 * formats, it never computes (ADR-0007).
 */
export function ZoneTable({ metrics }: { metrics: ShotMetrics }) {
  const { zones, midRangeSplit, cornerSplit, backcourt, threes } = metrics
  const twoPointZones = zones.filter((z) => ZONE_POINT_VALUE[z.zone] === 2)
  const threePointZones = zones.filter((z) => ZONE_POINT_VALUE[z.zone] === 3)
  const anyExcluded = zones.some((z) => !z.included)
  const anyFlagged =
    zones.some((z) => z.smallSampleMaking) ||
    (midRangeSplit.visible && midRangeSplit.bands.some((b) => b.smallSampleMaking))

  return (
    <section className="zone-panel">
      <table className="zone-table">
        <caption>
          Zone by zone: shot mix and shot making, vs league average (making Δ in FG percentage
          points)
        </caption>
        {/* Column philosophy: the verdict-supporting columns lead — FGA (the
            honesty anchor that makes † interpretable, never hover-hidden),
            the diet pair, then Making Δ. PPS (lg) trails as the reference
            column, so if the table ever overflows, the scroll cuts reference
            material, never the payoff. There is no FG% column: PPS is the
            unit of shot quality (ADR-0001) and Making Δ already encodes
            FG%-vs-league; raw FG% lives on the court's zone tooltip. */}
        <thead>
          <tr>
            <th scope="col">Zone</th>
            <th scope="col">FGA</th>
            <th scope="col">Share</th>
            <th scope="col">Lg share</th>
            <th scope="col">Making Δ</th>
            <th scope="col">PPS (lg)</th>
          </tr>
        </thead>
        <tbody>
          {twoPointZones.map((row) => (
            <Fragment key={row.zone}>
              <ZoneRow row={row} />
              {row.zone === 'Mid-Range' &&
                midRangeSplit.visible &&
                midRangeSplit.bands.map((band) => <BandRow key={band.band} band={band} />)}
            </Fragment>
          ))}
          {/* The verdict-grain parent row (ADR-0016): the combined threes
              clear the small-sample bar its children individually fail — the
              row order is the argument for why the verdict speaks here. */}
          <tr>
            <th scope="row">All threes</th>
            <td>{threes.attempts}</td>
            <td>{formatPercent1(threes.attemptShare)}</td>
            <td>{formatPercent1(threes.leagueAttemptShare)}</td>
            <td>{withSmallSampleMark(formatSignedPp1(threes.makingDelta), threes.smallSampleMaking)}</td>
            <td>
              {formatPps2(threes.pps)} <span className="lg">({formatPps2(threes.leaguePps)})</span>
            </td>
          </tr>
          {threePointZones.map((row) => (
            <ZoneRow key={row.zone} row={row} child />
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
