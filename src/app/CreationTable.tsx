import type { CreationMetrics } from '../domain/aggregateCreation'
import { SMALL_SAMPLE_MAKING_ATTEMPTS } from '../domain/constants'
import {
  formatClockBand,
  formatCreationContext,
  formatPercent1,
  formatPps2,
  JUMPERS_LABEL,
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

function CreationRow({
  label,
  row,
  child = false,
}: {
  label: string
  row: CreationCells
  child?: boolean
}) {
  return (
    <tr className={child ? 'zone-row-child' : undefined}>
      <th scope="row">{label}</th>
      <td>{row.attempts}</td>
      <td>
        {withSmallSampleMark(formatPps2(row.pps), ppsMarked(row))}{' '}
        <span className="lg">({formatPps2(row.leaguePps)})</span>
      </td>
      <td>{formatPercent1(row.attemptShare)}</td>
      <td>{formatPercent1(row.leagueAttemptShare)}</td>
    </tr>
  )
}

/**
 * The accessible data twin of the creation-value chart, and the home of the
 * diet shares (the chart deliberately doesn't carry them — the diet cut
 * largely restates the zone story). Every number comes from the single
 * creation aggregation output — this component formats, it never computes
 * (ADR-0011). Column philosophy follows the zone table (ADR-0018): FGA leads
 * as the honesty anchor that makes † interpretable, PPS (lg) — the section's
 * payoff — comes next, and the diet pair trails as context. There is
 * deliberately no eFG% column: PPS is the unit of shot value everywhere
 * (ADR-0001).
 */
export function CreationTable({ metrics }: { metrics: CreationMetrics }) {
  const { inside, jumpers, jumperContexts } = metrics.general
  const anyFlagged = [inside, jumpers, ...jumperContexts, ...metrics.shotClock].some(ppsMarked)

  return (
    <div className="creation-table-body">
      <div className="zone-scroll">
        <table className="zone-table" aria-label="Shot creation by context, vs league average">
          <thead>
            <tr>
              <th scope="col">Context</th>
              <th scope="col">FGA</th>
              <th scope="col">PPS (lg)</th>
              <th scope="col">Share</th>
              <th scope="col">Lg share</th>
            </tr>
          </thead>
          {/* Each family is a partition of the same attempts (CONTEXT.md:
              context family) — every context always renders, so each group's
              shares sum to 100% minus any unattributed remainder. The General
              family renders at its TRUE two-tier shape: the NBA classifies
              creation only for jumpers outside 10 ft, so the rim bucket and
              the jumper parent split the diet, and catch-vs-dribble refines
              the jumpers (the zone table's parent/child pattern). */}
          <tbody>
            <tr className="creation-group-row">
              <th scope="colgroup" colSpan={5}>
                How the shot arrived
              </th>
            </tr>
            <CreationRow label={formatCreationContext(inside.context)} row={inside} />
            <CreationRow label={JUMPERS_LABEL} row={jumpers} />
            {jumperContexts.map((row) => (
              <CreationRow
                key={row.context}
                label={formatCreationContext(row.context)}
                row={row}
                child
              />
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
          Inside 10 ft the NBA&apos;s tracking doesn&apos;t classify creation — the
          catch-vs-dribble split covers jumpers from 10 ft and out.
        </p>
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
