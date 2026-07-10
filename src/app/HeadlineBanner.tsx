import type { ShotMetrics } from '../domain/aggregate'
import { formatPercent1, formatPps2, formatSignedPps2, withSmallSampleMark } from '../format'

/**
 * The paired headline blocks: the two-axis answer (v1 thesis) with equal
 * billing — selection and making, in the same unit and the same diet
 * weighting (ADR-0016). The shared middle number (his diet-weighted expected
 * PPS) is the hinge: selection moves league diet → his diet; making moves
 * his diet → what he actually scored. The comparison class is stated plainly
 * beside the numbers (ADR-0002). This component only formats aggregation
 * outputs (ADR-0011) — the interpretive verdict prose lives elsewhere.
 */
export function HeadlineBanner({
  selection,
  making,
  threes,
}: {
  selection: ShotMetrics['selection']
  making: ShotMetrics['making']
  threes: ShotMetrics['threes']
}) {
  return (
    <div className="headline-pair">
      <section className="headline-banner" aria-label="Shot selection headline">
        <h2>
          Shot selection{' '}
          <span className="comparison-class">— diet-weighted expected PPS, vs league average</span>
        </h2>
        <div className="headline-numbers">
          <div className="headline-stat">
            <span className="stat-value">{formatPps2(selection.playerDietExpectedPps)}</span>
            <span className="stat-label">his shot diet</span>
          </div>
          <div className="headline-stat">
            <span className="stat-value">{formatPps2(selection.leagueDietExpectedPps)}</span>
            <span className="stat-label">league diet</span>
          </div>
          <div className="headline-stat">
            <span className="stat-value">{formatSignedPps2(selection.selectionDelta)}</span>
            <span className="stat-label">difference</span>
          </div>
        </div>
        <p className="headline-note">
          Expected points per shot from where he shoots, with making held at league level —
          selection only.
        </p>
      </section>
      <section className="headline-banner" aria-label="Shot making headline">
        <h2>
          Shot making{' '}
          <span className="comparison-class">— actual vs expected PPS, at league-average making</span>
        </h2>
        <div className="headline-numbers">
          <div className="headline-stat">
            <span className="stat-value">{formatPps2(making.actualPps)}</span>
            <span className="stat-label">he scored</span>
          </div>
          <div className="headline-stat">
            <span className="stat-value">{formatPps2(selection.playerDietExpectedPps)}</span>
            <span className="stat-label">expected from his diet</span>
          </div>
          <div className="headline-stat">
            <span className="stat-value">{formatSignedPps2(making.makingPpsDelta)}</span>
            <span className="stat-label">difference</span>
          </div>
        </div>
        <p className="headline-note">
          Points per shot he actually scored vs his shot diet converted at league level — making
          only.
        </p>
        <p className="headline-note">
          From three: {withSmallSampleMark(formatPercent1(threes.fgPct), threes.smallSampleMaking)}{' '}
          on {threes.attempts} attempts (league {formatPercent1(threes.leagueFgPct)}).
        </p>
      </section>
    </div>
  )
}
