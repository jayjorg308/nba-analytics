import { Fragment } from 'react'
import type { BandMetricsRow, ShotMetrics, ZoneMetricsRow } from '../domain/aggregate'
import { LONG_TWO_BAND, ZONE_POINT_VALUE, type EvalZone } from '../domain/constants'
import { formatPercent1, formatPps2, formatSignedPp1, withSmallSampleMark } from '../format'
import { Term } from './Term'

// Table-only display names: the three-point children sit under the
// "3 Pointers" parent row, so repeating "3" in every child label is
// redundant here. Everywhere else (court labels, tooltips, data, notes)
// keeps the full zone name.
const TABLE_ZONE_LABEL: Partial<Record<EvalZone, string>> = {
  'Left Corner 3': 'Left Corner',
  'Right Corner 3': 'Right Corner',
  'Above the Break 3': 'Above the Break',
}

function ZoneRow({ row, child = false }: { row: ZoneMetricsRow; child?: boolean }) {
  const className =
    [child ? 'zone-row-child' : null, row.included ? null : 'zone-row-excluded']
      .filter(Boolean)
      .join(' ') || undefined
  return (
    // included=false zones are muted, never deleted (ADR-0008): their
    // attempts still count toward the diet weighting.
    <tr className={className}>
      <th scope="row">
        {TABLE_ZONE_LABEL[row.zone] ?? row.zone}
        {row.zone === 'Restricted Area' && (
          // The long-two note's mirror: a league value-hierarchy fact, not
          // hero copy — asserted against the deployed payload by the table
          // claim in cody-williams.2025-26.guard.test.ts.
          <span className="band-note">highest-value shot</span>
        )}
      </th>
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
          <span className="band-note">lowest-value shot</span>
        )}
      </th>
      <td>{band.attempts}</td>
      <td>{formatPercent1(band.attemptShare)}</td>
      <td>{formatPercent1(band.leagueAttemptShare)}</td>
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
export function ZoneTable({
  metrics,
  zoneConflictsDropped,
}: {
  metrics: ShotMetrics
  /** _meta.zoneConflictsDropped — reported whenever nonzero (ADR-0019). */
  zoneConflictsDropped: number
}) {
  const { zones, midRangeSplit, cornerSplit, backcourt, threes } = metrics
  const twoPointZones = zones.filter((z) => ZONE_POINT_VALUE[z.zone] === 2)
  const threePointZones = zones.filter((z) => ZONE_POINT_VALUE[z.zone] === 3)
  const anyExcluded = zones.some((z) => !z.included)
  const anyFlagged =
    zones.some((z) => z.smallSampleMaking) ||
    (midRangeSplit.visible && midRangeSplit.bands.some((b) => b.smallSampleMaking))

  // The act header (ZONE BY ZONE + description) lives at section scope in
  // HeroPage (ADR-0051), so the table names itself like its siblings.
  return (
    <div className="table-panel">
      <div className="zone-scroll">
        <table
          className="zone-table"
          aria-label="Zone by zone shot diet and shot making, vs league average"
        >
        {/* Column philosophy: the verdict-supporting columns lead — FGA (the
            honesty anchor that makes † interpretable, never hover-hidden),
            the diet pair, then Making Δ. PPS (lg) trails as the reference
            column, so if the table ever overflows, the scroll cuts reference
            material, never the payoff. There is no FG% column: PPS is the
            unit of shot quality (ADR-0001) and Making Δ already encodes
            FG%-vs-league; raw FG% lives on the court's zone detail card. */}
        <thead>
          {/* The stat-abbreviation headers are dictionary terms (ADR-0052):
              a tap opens the definition. The wrapped button's text is the
              header's text exactly, so the column reads unchanged. */}
          <tr>
            <th scope="col">Zone</th>
            <th scope="col">
              <Term id="fga">FGA</Term>
            </th>
            <th scope="col">
              <Term id="attempt-share">Share</Term>
            </th>
            <th scope="col">Lg share</th>
            <th scope="col">
              <Term id="making-delta">Making Δ</Term>
            </th>
            <th scope="col">
              <Term id="pps">PPS (lg)</Term>
            </th>
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
            <th scope="row">3 Pointers</th>
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
      </div>
      <div className="table-notes">
        {/* No denominator footnote needed: every Share in the table — zones,
            bands, the All threes parent — is a share of evaluation attempts,
            so parent/child rows sum and league comparisons are like-for-like. */}
        {cornerSplit.visible && (
          <p>
            Corner 3s: Left {cornerSplit.left.attempts} FGA / Right {cornerSplit.right.attempts}{' '}
            FGA; both clear the volume bar
            {(cornerSplit.left.smallSampleMaking || cornerSplit.right.smallSampleMaking) &&
              ', though per-corner making is small-sample†'}
            .
          </p>
        )}
        {backcourt.attempts > 0 && (
          <p>
            Backcourt heaves: {backcourt.attempts} attempt{backcourt.attempts === 1 ? '' : 's'} (
            {backcourt.makes} made), excluded from evaluation and reported here.
          </p>
        )}
        {zoneConflictsDropped > 0 && (
          <p>
            {zoneConflictsDropped} shot{zoneConflictsDropped === 1 ? '' : 's'} dropped at derive:
            the NBA&apos;s own scoring (2PT/3PT) and zone assignment disagree; dropped and
            counted, never guessed.
          </p>
        )}
        {anyExcluded && (
          <p>
            Zones under 15 attempts are shown muted; their attempts still count toward the diet.
          </p>
        )}
        {anyFlagged && (
          <p>
            † Making delta on fewer than 50 attempts: treat as uncertain (flagged, never
            suppressed).
          </p>
        )}
      </div>
    </div>
  )
}
