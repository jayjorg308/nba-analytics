import type { GrowthMetrics, GrowthZoneSeason } from '../domain/aggregateGrowth'
import {
  formatPercent1,
  formatSignedGap,
  formatSignedPp1,
  formatSignedPps2,
  withSmallSampleMark,
} from '../format'
import { Term } from './Term'

// Table-only display names — the zone table's convention, minus the parent
// grouping (both seasons' grains sit side by side here, so the table stays
// at the six evaluation zones).
const TABLE_ZONE_LABEL: Record<string, string> = {
  'Left Corner 3': 'Left Corner',
  'Right Corner 3': 'Right Corner',
  'Above the Break 3': 'Above the Break',
}

function SeasonCells({ season }: { season: GrowthZoneSeason }) {
  return (
    <>
      <td>{season.attempts}</td>
      <td>
        {formatPercent1(season.attemptShare)}{' '}
        <span className="lg">({formatPercent1(season.leagueAttemptShare)})</span>
      </td>
      <td>{withSmallSampleMark(formatSignedPp1(season.makingDelta), season.smallSampleMaking)}</td>
    </>
  )
}

/**
 * The growth coda's accessible data twin (ADR-0062): both seasons' full zone
 * grain — diet share vs lg share, making Δ, † flags — side by side, each
 * season against its own season's league baseline. Every number comes from
 * the growth aggregation output; this component formats, it never computes
 * (ADR-0011).
 */
export function GrowthTable({ metrics }: { metrics: GrowthMetrics }) {
  const anyFlagged = metrics.zones.some(
    (z) => z.prior.smallSampleMaking || z.current.smallSampleMaking,
  )
  return (
    <div className="table-panel">
      <div className="zone-scroll">
        <table
          className="zone-table"
          aria-label={`Season over season by zone: shot diet and shot making, ${metrics.priorSeason} and ${metrics.currentSeason}, each vs its own league`}
        >
          <thead>
            <tr>
              <td />
              <th scope="colgroup" colSpan={3}>
                {metrics.priorSeason}
              </th>
              <th scope="colgroup" colSpan={3}>
                {metrics.currentSeason}
              </th>
            </tr>
            <tr>
              <th scope="col">Zone</th>
              <th scope="col">
                <Term id="fga">FGA</Term>
              </th>
              <th scope="col">
                <Term id="attempt-share">Share</Term> <span className="lg">(lg)</span>
              </th>
              <th scope="col">
                <Term id="making-delta">Making Δ</Term>
              </th>
              <th scope="col">
                <Term id="fga">FGA</Term>
              </th>
              <th scope="col">
                <Term id="attempt-share">Share</Term> <span className="lg">(lg)</span>
              </th>
              <th scope="col">
                <Term id="making-delta">Making Δ</Term>
              </th>
            </tr>
          </thead>
          <tbody>
            {metrics.zones.map((row) => (
              <tr key={row.zone}>
                <th scope="row">{TABLE_ZONE_LABEL[row.zone] ?? row.zone}</th>
                <SeasonCells season={row.prior} />
                <SeasonCells season={row.current} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-notes">
        <p>
          Each season&apos;s shares and deltas compare against that season&apos;s own league
          baseline, so league movement nets out of the picture.
        </p>
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

/**
 * The two-axis spine movement — the coda's stat coda, rendered in the visual
 * column below the diet chart (THE LINE's register, ADR-0056/0062): each
 * headline residual per season, with the movement figure computed from the
 * DISPLAYED anchors (formatSignedGap, ADR-0023) — the numbers on screen must
 * subtract exactly.
 */
export function GrowthSpineLine({ metrics }: { metrics: GrowthMetrics }) {
  const { prior, current } = metrics.spine
  return (
    <dl
      className="freethrow-season"
      aria-label="Two-axis movement, each season vs its own league"
    >
      <div className="freethrow-metric">
        <dt>Selection Δ</dt>
        <dd>
          {formatSignedPps2(prior.selectionDelta)} → {formatSignedPps2(current.selectionDelta)}{' '}
          <span className="lg">
            (moved {formatSignedGap(current.selectionDelta, prior.selectionDelta, 2)})
          </span>
        </dd>
      </div>
      <div className="freethrow-metric">
        <dt>Making Δ</dt>
        <dd>
          {formatSignedPps2(prior.makingPpsDelta)} → {formatSignedPps2(current.makingPpsDelta)}{' '}
          <span className="lg">
            (moved {formatSignedGap(current.makingPpsDelta, prior.makingPpsDelta, 2)})
          </span>
        </dd>
      </div>
    </dl>
  )
}
