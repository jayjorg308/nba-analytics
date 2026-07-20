import type { CreationMetrics } from '../domain/aggregateCreation'
import { SMALL_SAMPLE_MAKING_ATTEMPTS, ZONE_INCLUSION_MIN_ATTEMPTS } from '../domain/constants'
import {
  formatClockBand,
  formatCreationContext,
  formatDefenderBand,
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
  note,
}: {
  label: string
  row: CreationCells
  child?: boolean
  /** Small gray annotation under the label — the zone table's band-note
   * pattern (e.g. "highest-value shot"), here carrying computed story
   * context like the three-arrival bridge. */
  note?: string
}) {
  return (
    <tr className={child ? 'zone-row-child' : undefined}>
      <th scope="row">
        {label}
        {note && <span className="band-note">{note}</span>}
      </th>
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
  const { inside, jumpers, jumperContexts, catchAndShootThrees } = metrics.general
  const allRows = [
    inside,
    jumpers,
    ...jumperContexts,
    ...metrics.shotClock,
    ...metrics.closestDefender,
  ]
  const anyFlagged = allRows.some(ppsMarked)
  // The chart's dot floor (ADR-0031 amendment): a nonzero CHARTED context
  // under the inclusion bar has a figure here that the chart declines to
  // place — that omission is disclosed, never silent. The Other residual is
  // outside the scan: it has no chart row at all (its own standing note).
  const anyUnplaced = allRows.some(
    (row) =>
      !('context' in row && row.context === 'Other') &&
      row.attempts > 0 &&
      row.attempts < ZONE_INCLUSION_MIN_ATTEMPTS,
  )

  return (
    <div className="table-panel">
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
                // The three-arrival bridge (read beside the PPS gap): which
                // KIND of three the zone table's verdict is about.
                note={
                  row.context === 'Catch and Shoot' && catchAndShootThrees.share !== null
                    ? `${catchAndShootThrees.attempts} of his ${catchAndShootThrees.totalThrees} threes`
                    : undefined
                }
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
          <tbody>
            <tr className="creation-group-row">
              <th scope="colgroup" colSpan={5}>
                Closest defender
              </th>
            </tr>
            {metrics.closestDefender.map((row) => (
              <CreationRow
                key={row.band}
                label={formatDefenderBand(row.band, row.feet)}
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
          The tiny Other residual — jumpers fitting neither catch-and-shoot nor
          pull-up — appears only here; the jumper parent includes its attempts.
        </p>
        <p>
          Shot clock and defender rows roll the NBA&apos;s finer ranges up to three bands
          each — makes and attempts summed, never rates averaged.
        </p>
        {metrics.shotClockUnattributed > 0 && (
          <p>
            {metrics.shotClockUnattributed} attempt
            {metrics.shotClockUnattributed === 1 ? '' : 's'} without shot-clock tracking —
            counted here, never guessed into a band.
          </p>
        )}
        {metrics.defenderUnattributed > 0 && (
          <p>
            {metrics.defenderUnattributed} attempt
            {metrics.defenderUnattributed === 1 ? '' : 's'} without defender tracking —
            counted here, never guessed into a band.
          </p>
        )}
        {anyUnplaced && (
          <p>
            Contexts under {ZONE_INCLUSION_MIN_ATTEMPTS} attempts draw no PPS dot in the
            chart — too thin to place a value on; their numbers stay here.
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
