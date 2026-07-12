import type { ShotMetrics } from '../domain/aggregate'
import { formatPps2, formatSignedGap } from '../format'

/**
 * The paired headline blocks: the two-axis answer (v1 thesis) with equal
 * billing — selection and making, in the same unit and the same diet
 * weighting (ADR-0016). The shared middle number (his diet-weighted expected
 * PPS) is the hinge and deliberately carries the SAME label in both blocks
 * ("expected from his diet"): it is the output of selection (what his
 * choices are worth) and the benchmark for making (what he should have
 * scored). "Expected" always means at league-average shooting; in prose the
 * making axis is described as "conversion" (the CONTEXT.md defining word),
 * never as bare "making". The comparison class is stated plainly beside the
 * numbers (ADR-0002). This component only formats aggregation outputs
 * (ADR-0011) — the interpretive verdict prose lives elsewhere.
 *
 * Deliberately spare: each card is its three numbers and one explainer
 * line. Drill-down evidence (rim share, combined threes) lives in the zone
 * table and the court, not here — a previous iteration appended it to the
 * cards and they bloated.
 */
export function HeadlineBanner({
    selection,
    making,
}: {
    selection: ShotMetrics['selection']
    making: ShotMetrics['making']
}) {
    return (
        <div className="headline-pair">
            <section
                className="headline-banner"
                aria-label="Shot selection headline"
            >
                <h2>
                    Shot selection
                    <span className="comparison-class">
                        expected points per shot: his shot diet vs. the
                        league&apos;s
                    </span>
                </h2>
                <div className="headline-numbers">
                    <div className="headline-stat">
                        <span className="stat-value">
                            {formatPps2(selection.playerDietExpectedPps)}
                        </span>
                        <span className="stat-label">
                            expected from his diet
                        </span>
                    </div>
                    <div className="headline-stat">
                        <span className="stat-value">
                            {formatPps2(selection.leagueDietExpectedPps)}
                        </span>
                        <span className="stat-label">
                            expected from league diet
                        </span>
                    </div>
                    <div className="headline-stat">
                        {/* The delta a reader can verify: the gap of the two
                            displayed anchors, not the rounded raw delta
                            (ADR-0023) — guarded by the identity test. */}
                        <span className="stat-value">
                            {formatSignedGap(
                                selection.playerDietExpectedPps,
                                selection.leagueDietExpectedPps,
                                2,
                            )}
                        </span>
                        <span className="stat-label">his choices</span>
                    </div>
                </div>
                <p className="headline-note">
                    Expected PPS prices every shot at league-average shooting.
                    His shot selection moves this number, not whether they go
                    in.
                </p>
            </section>
            <section
                className="headline-banner"
                aria-label="Shot making headline"
            >
                <h2>
                    Shot making
                    <span className="comparison-class">
                        actual vs. expected points per shot, on the same diet
                    </span>
                </h2>
                <div className="headline-numbers">
                    <div className="headline-stat">
                        <span className="stat-value">
                            {formatPps2(making.actualPps)}
                        </span>
                        <span className="stat-label">he scored</span>
                    </div>
                    <div className="headline-stat">
                        <span className="stat-value">
                            {formatPps2(selection.playerDietExpectedPps)}
                        </span>
                        <span className="stat-label">
                            expected from his diet
                        </span>
                    </div>
                    <div className="headline-stat">
                        <span className="stat-value">
                            {formatSignedGap(
                                making.actualPps,
                                selection.playerDietExpectedPps,
                                2,
                            )}
                        </span>
                        <span className="stat-label">his conversion</span>
                    </div>
                </div>
                <p className="headline-note">
                    Comparing his actual PPS vs. what league-average shooting
                    yields from the same shots.
                </p>
            </section>
        </div>
    )
}
