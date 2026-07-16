import type { CreationMetrics } from '../domain/aggregateCreation'
import { SMALL_SAMPLE_MAKING_ATTEMPTS } from '../domain/constants'
import {
  formatClockBand,
  formatCreationContext,
  formatPercent1,
  formatPps2,
  withSmallSampleMark,
} from '../format'

interface CreationCells {
  attempts: number
  attemptShare: number | null
  leagueAttemptShare: number
  pps: number | null
  leaguePps: number | null
  smallSamplePps: boolean
}

/** A zero-attempt context makes no PPS claim (ADR-0013's no-data distinction),
 * so there is nothing for † to qualify — the dash stands alone. */
function ppsMarked(row: CreationCells): boolean {
  return row.smallSamplePps && row.pps !== null
}

function CreationRow({ label, row }: { label: string; row: CreationCells }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{row.attempts}</td>
      <td>{formatPercent1(row.attemptShare)}</td>
      <td>{formatPercent1(row.leagueAttemptShare)}</td>
      <td>
        {withSmallSampleMark(formatPps2(row.pps), ppsMarked(row))}{' '}
        <span className="lg">({formatPps2(row.leaguePps)})</span>
      </td>
    </tr>
  )
}

/**
 * The accessible data twin of the creation-diet chart, and the home of
 * creation PPS. Every number comes from the single creation aggregation
 * output — this component formats, it never computes (ADR-0011). Column
 * philosophy follows the zone table (ADR-0018): FGA leads as the honesty
 * anchor that makes † interpretable, the diet pair carries the argument,
 * and PPS (lg) trails as the reference column. There is deliberately no
 * eFG% column: PPS is the unit of shot value everywhere (ADR-0001).
 */
export function CreationTable({ metrics }: { metrics: CreationMetrics }) {
  const anyFlagged = [...metrics.general, ...metrics.shotClock].some(ppsMarked)

  return (
    <div className="creation-table-body">
      <div className="zone-scroll">
        <table className="zone-table" aria-label="Shot creation by context, vs league average">
          <thead>
            <tr>
              <th scope="col">Context</th>
              <th scope="col">FGA</th>
              <th scope="col">Share</th>
              <th scope="col">Lg share</th>
              <th scope="col">PPS (lg)</th>
            </tr>
          </thead>
          {/* Each family is a partition of the same attempts (CONTEXT.md:
              context family) — every context always renders, so each group's
              shares sum to 100% minus any unattributed remainder. */}
          <tbody>
            <tr className="creation-group-row">
              <th scope="colgroup" colSpan={5}>
                How the shot arrived
              </th>
            </tr>
            {metrics.general.map((row) => (
              <CreationRow key={row.context} label={formatCreationContext(row.context)} row={row} />
            ))}
          </tbody>
          <tbody>
            <tr className="creation-group-row">
              <th scope="colgroup" colSpan={5}>
                Shot clock
              </th>
            </tr>
            {metrics.shotClock.map((row) => (
              <CreationRow
                key={row.band}
                label={formatClockBand(row.band, row.seconds)}
                row={row}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-notes">
        <p>
          Shot clock rows roll the NBA&apos;s six ranges up to three bands — makes and
          attempts summed, never rates averaged.
        </p>
        {metrics.shotClockUnattributed > 0 && (
          <p>
            {metrics.shotClockUnattributed} attempt
            {metrics.shotClockUnattributed === 1 ? '' : 's'} without shot-clock tracking —
            counted here, never guessed into a band.
          </p>
        )}
        {anyFlagged && (
          <p>
            † PPS on fewer than {SMALL_SAMPLE_MAKING_ATTEMPTS} attempts — treat as uncertain
            (flagged, never suppressed).
          </p>
        )}
      </div>
    </div>
  )
}
