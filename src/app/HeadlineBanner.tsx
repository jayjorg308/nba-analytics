import type { ShotMetrics } from '../domain/aggregate'
import { formatPps2, formatSignedPps2 } from '../format'

/**
 * The headline selection number. The comparison class is stated plainly
 * beside the numbers (ADR-0002): this is "vs league average", never
 * peer-adjusted, and must not read otherwise.
 */
export function HeadlineBanner({ selection }: { selection: ShotMetrics['selection'] }) {
  return (
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
  )
}
