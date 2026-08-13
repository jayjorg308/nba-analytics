// The integrated two-axis headline (comparison plan §3): ONE surface for
// both windows rather than two reused HeadlineBanner components — selection
// and making cards in the headline-banner grammar, each leading with the
// two sides' league-relative residuals and closing with the named
// right-minus-left gap. Neutral language throughout: side labels and
// directions, never grades, ranks, or a winner.
//
// Every number obeys ADR-0023 as displayed: each residual is the gap of its
// two displayed anchors (formatSignedGap; the anchors themselves sit in the
// card's note line), and the cross-side gap subtracts the two displayed
// residuals in display units (formatSignedGapOfGaps) — the visible chain
// reconciles exactly, guarded by the component identity test.

import type { ComparisonMetrics, ComparisonSide } from '../domain/aggregateComparison'
import { formatPps2, formatSignedGap, formatSignedGapOfGaps } from '../format'
import { Term } from './Term'

/** A side's selection residual anchors: [expected from diet, lg diet]. */
function selectionAnchors(side: ComparisonSide): readonly [number | null, number] {
  const s = side.metrics.selection
  return [s.playerDietExpectedPps, s.leagueDietExpectedPps]
}

/** A side's making residual anchors: [actual, expected from diet]. */
function makingAnchors(side: ComparisonSide): readonly [number | null, number | null] {
  return [side.metrics.making.actualPps, side.metrics.selection.playerDietExpectedPps]
}

export function ComparisonHeadline({ metrics }: { metrics: ComparisonMetrics }) {
  const { left, right } = metrics
  // The direction is named with the side labels themselves (plan §3): a
  // positive gap means the right window's residual is larger, nothing more.
  const gapLabel = `${right.label} minus ${left.label}`
  return (
    <div className="headline-pair comparison-headline">
      <section className="headline-banner" aria-label="Shot selection comparison">
        <h2>
          SHOT SELECTION
          <span className="comparison-class">
            {/* First reading-order mention of both terms on a results page
                (the setup intro renders only in the setup state). */}
            <Term id="expected-pps">expected points per shot</Term>: each window&apos;s{' '}
            <Term id="shot-diet">shot diet</Term> vs the league&apos;s
          </span>
        </h2>
        <div className="headline-numbers">
          <div className="headline-stat">
            <span className="stat-value">{formatSignedGap(...selectionAnchors(left), 2)}</span>
            <span className="stat-label">{left.label}</span>
          </div>
          <div className="headline-stat">
            <span className="stat-value">{formatSignedGap(...selectionAnchors(right), 2)}</span>
            <span className="stat-label">{right.label}</span>
          </div>
          <div className="headline-stat">
            <span className="stat-value">
              {formatSignedGapOfGaps(selectionAnchors(right), selectionAnchors(left), 2)}
            </span>
            <span className="stat-label">{gapLabel}</span>
          </div>
        </div>
        {/* The raw anchors behind the residuals (plan §3): expected-from-diet
            per side, against the one shared league diet (ADR-0074). */}
        <p className="headline-note">
          Expected from diet: {left.label} {formatPps2(left.metrics.selection.playerDietExpectedPps)}{' '}
          · {right.label} {formatPps2(right.metrics.selection.playerDietExpectedPps)} · lg diet{' '}
          {formatPps2(left.metrics.selection.leagueDietExpectedPps)}.
        </p>
      </section>
      <section className="headline-banner" aria-label="Shot making comparison">
        <h2>
          SHOT MAKING
          <span className="comparison-class">
            actual vs expected points per shot, each window on its own diet
          </span>
        </h2>
        <div className="headline-numbers">
          <div className="headline-stat">
            <span className="stat-value">{formatSignedGap(...makingAnchors(left), 2)}</span>
            <span className="stat-label">{left.label}</span>
          </div>
          <div className="headline-stat">
            <span className="stat-value">{formatSignedGap(...makingAnchors(right), 2)}</span>
            <span className="stat-label">{right.label}</span>
          </div>
          <div className="headline-stat">
            <span className="stat-value">
              {formatSignedGapOfGaps(makingAnchors(right), makingAnchors(left), 2)}
            </span>
            <span className="stat-label">{gapLabel}</span>
          </div>
        </div>
        <p className="headline-note">
          Actual vs expected: {left.label} {formatPps2(left.metrics.making.actualPps)} vs{' '}
          {formatPps2(left.metrics.selection.playerDietExpectedPps)} · {right.label}{' '}
          {formatPps2(right.metrics.making.actualPps)} vs{' '}
          {formatPps2(right.metrics.selection.playerDietExpectedPps)}.
        </p>
      </section>
    </div>
  )
}
