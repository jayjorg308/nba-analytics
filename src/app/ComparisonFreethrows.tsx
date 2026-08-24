// The comparison page's free-throw section (ADR-0079): players mode only,
// where each full-season window IS the season-total free-throw contract, so
// the section consumes the exact comparison windows (ADR-0073). Layout by
// the winning C variant of the THE LINE prototype: three season-line
// scoreboard cards lead in the ADR-0078 call grammar — the line's verdicts
// live where full-season sample sizes can support them — over the trip
// taxonomy transposed to a row per side, so each name sits beside its
// numbers. Every number is a formatted aggregation output (ADR-0011),
// every call decides and prices on displayed anchors (ADR-0023), side
// identity by the shared marks, never color. No whole-comparison grade:
// the page stays a tool, not an argument.
//
// Call vocabulary (the ADR-0078 asymmetry, extended): drawing fouls and
// converting free throws are results against the league, so FTA rate and
// FT conversion carry an edge — "Draw edge", "Conversion edge" — while FT
// share of points is a scoring mix with no better direction, so it only
// "leans" ("Reliance lean"). Per-class calls are deliberately absent: most
// classes sit under the 50-FTA bar, and a wall of flagged chips is noise,
// not answers.

import type { ReactNode } from 'react'
import type {
  FreethrowComparisonMetrics,
  FreethrowComparisonRow,
} from '../domain/aggregateComparison'
import { SMALL_SAMPLE_MAKING_ATTEMPTS } from '../domain/constants'
import { formatPercent1, formatTripClass, withSmallSampleMark } from '../format'
import type { ComparisonCall } from './comparisonCalls'
import { comparisonCall } from './comparisonCalls'
import { shortLabels } from './comparisonLabels'
import { SideMark } from './ComparisonZoneScoreboard'
import { Term } from './Term'

/** Anchor rescale for call arithmetic: the season line displays in
 * percentage points at 1 dp, so its calls must decide at that grain. */
function pp(x: number | null): number | null {
  return x === null ? null : x * 100
}

function CallChip({ call, names }: { call: ComparisonCall; names: { left: string; right: string } }) {
  if (call.kind === 'none') {
    return <span className="comparison-call-chip comparison-call-even">—</span>
  }
  if (call.kind === 'even') {
    return (
      <span className="comparison-call-chip comparison-call-even">
        {withSmallSampleMark('even', call.flagged)}
      </span>
    )
  }
  return (
    <span className="comparison-call-chip">
      <SideMark side={call.side} />
      {withSmallSampleMark(`${names[call.side]} +${call.margin}`, call.flagged)}
    </span>
  )
}

/** One season-line metric per card: a call over the two sides' values, then
 * the mini table of both sides and the Lg ruler row, each value beside the
 * raw counts it rounds from. */
interface SeasonCardProps {
  names: { left: string; right: string }
  ariaLabel: string
  title: ReactNode
  callLabel: string
  anchorHeader: string
  left: { value: number | null; anchor: string; flagged: boolean }
  right: { value: number | null; anchor: string; flagged: boolean }
  league: number
}

function SeasonCard({
  names,
  ariaLabel,
  title,
  callLabel,
  anchorHeader,
  left,
  right,
  league,
}: SeasonCardProps) {
  const call = comparisonCall(pp(left.value), pp(right.value), left.flagged || right.flagged)
  return (
    <section className="comparison-zone-card" aria-label={ariaLabel}>
      <header className="comparison-zone-card-head">
        <h3>{title}</h3>
      </header>
      <div className="comparison-card-calls">
        <div className="comparison-card-call">
          <span className="comparison-card-call-label">{callLabel}</span>
          <CallChip call={call} names={names} />
        </div>
      </div>
      <table className="comparison-card-table">
        <thead>
          <tr>
            <td />
            <th scope="col">Value</th>
            <th scope="col">{anchorHeader}</th>
          </tr>
        </thead>
        <tbody>
          {(
            [
              ['left', names.left, left],
              ['right', names.right, right],
            ] as const
          ).map(([id, name, side]) => (
            <tr key={id}>
              <th scope="row">
                <SideMark side={id} /> {name}
              </th>
              <td>
                {withSmallSampleMark(
                  formatPercent1(side.value),
                  side.flagged && side.value !== null,
                )}
              </td>
              <td>{side.anchor}</td>
            </tr>
          ))}
          {/* The league ruler row (one shared line, asserted identical at
              aggregation): its raw counts are league-wide, not comparable
              values, so the anchor stays an em dash. */}
          <tr className="comparison-card-row-lg">
            <th scope="row">Lg</th>
            <td>{formatPercent1(league)}</td>
            <td>—</td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}

export function ComparisonFreethrows({ metrics }: { metrics: FreethrowComparisonMetrics }) {
  const names = shortLabels(metrics)
  const leftLine = metrics.left.metrics.seasonLine
  const rightLine = metrics.right.metrics.seasonLine

  const byTier = (tier: 'attemptEquivalent' | 'addOn') =>
    metrics.tripClasses.filter(
      (row) => row.left.tier === tier && row.left.trips + row.right.trips > 0,
    )
  const shown = [...byTier('attemptEquivalent'), ...byTier('addOn')]
  // The † definition renders once for the whole section, whenever a card's
  // conversion or any class conversion shows one.
  const anyFlagged =
    shown.some(
      (row) =>
        (row.left.smallSampleConversion && row.left.conversion !== null) ||
        (row.right.smallSampleConversion && row.right.conversion !== null),
    ) ||
    (leftLine.smallSampleConversion && leftLine.conversion.value !== null) ||
    (rightLine.smallSampleConversion && rightLine.conversion.value !== null)
  const anyOmitted = metrics.tripClasses.some((row) => row.left.trips + row.right.trips === 0)
  const anyOneSided = shown.some((row) => row.left.trips === 0 || row.right.trips === 0)
  const technicals = [
    { name: names.left, line: leftLine },
    { name: names.right, line: rightLine },
  ].filter((s) => s.line.technicalFta > 0)

  const sideStat = (value: number | null, anchor: string, flagged = false) => ({
    value,
    anchor,
    flagged,
  })

  const sideRow = (row: FreethrowComparisonRow, id: 'left' | 'right', first: boolean) => (
    <tr key={`${row.tripClass}-${id}`}>
      {first && (
        <th scope="rowgroup" rowSpan={2}>
          {formatTripClass(row.tripClass)}
        </th>
      )}
      <td className="comparison-side-cell">
        <SideMark side={id} /> {names[id]}
      </td>
      <td>{row[id].trips}</td>
      <td>
        {row[id].ftm}/{row[id].fta}
      </td>
      <td>
        {withSmallSampleMark(
          formatPercent1(row[id].conversion),
          row[id].smallSampleConversion && row[id].conversion !== null,
        )}
      </td>
    </tr>
  )
  const tierRows = (tier: 'attemptEquivalent' | 'addOn', label: string) => (
    <tbody>
      <tr className="creation-group-row">
        <th scope="colgroup" colSpan={5}>
          {label}
        </th>
      </tr>
      {byTier(tier).flatMap((row) => [sideRow(row, 'left', true), sideRow(row, 'right', false)])}
    </tbody>
  )

  return (
    <section className="comparison-freethrow" aria-labelledby="comparison-freethrow-caption">
      <header className="section-caption">
        <h2 id="comparison-freethrow-caption">THE LINE</h2>
        <p className="section-caption-desc">
          free throws over the same full-season windows, each side vs the shared league
          average (margins in percentage&nbsp;points)
        </p>
      </header>
      <div className="comparison-scoreboard">
        <SeasonCard
          names={names}
          ariaLabel="FTA rate"
          title={<Term id="fta-rate">FTA rate</Term>}
          callLabel="Draw edge"
          anchorHeader="FTA/FGA"
          left={sideStat(leftLine.ftaRate.value, `${leftLine.fta}/${leftLine.seasonFga}`)}
          right={sideStat(rightLine.ftaRate.value, `${rightLine.fta}/${rightLine.seasonFga}`)}
          league={leftLine.ftaRate.league}
        />
        <SeasonCard
          names={names}
          ariaLabel="FT conversion"
          title={<Term id="ft-conversion">FT conversion</Term>}
          callLabel="Conversion edge"
          anchorHeader="FTM/FTA"
          left={sideStat(
            leftLine.conversion.value,
            `${leftLine.ftm}/${leftLine.fta}`,
            leftLine.smallSampleConversion,
          )}
          right={sideStat(
            rightLine.conversion.value,
            `${rightLine.ftm}/${rightLine.fta}`,
            rightLine.smallSampleConversion,
          )}
          league={leftLine.conversion.league}
        />
        <SeasonCard
          names={names}
          ariaLabel="FT share of points"
          title={<Term id="ft-points-share">FT share of points</Term>}
          callLabel="Reliance lean"
          anchorHeader="FTM/Pts"
          left={sideStat(leftLine.ftPointsShare.value, `${leftLine.ftm}/${leftLine.seasonPoints}`)}
          right={sideStat(
            rightLine.ftPointsShare.value,
            `${rightLine.ftm}/${rightLine.seasonPoints}`,
          )}
          league={leftLine.ftPointsShare.league}
        />
      </div>
      <div className="table-panel">
        <div className="zone-scroll">
          <table className="zone-table" aria-label="Free-throw trips by class, both sides">
            <thead>
              <tr>
                <th scope="col">Class</th>
                <th scope="col">Side</th>
                <th scope="col">
                  <Term id="trip">Trips</Term>
                </th>
                <th scope="col">FTM/FTA</th>
                <th scope="col">Conv</th>
              </tr>
            </thead>
            {tierRows('attemptEquivalent', 'Attempt-equivalent: the trip stood in for a shot')}
            {tierRows('addOn', 'Add-on: points on top of a play that stood')}
          </table>
        </div>
        <div className="table-notes">
          <p>
            Draw edge: the side drawing more free throws per field-goal attempt. Conversion
            edge: the side making its free throws at the higher rate. Reliance lean: the side
            with the larger share of its points from the line, a scoring mix, not a result.
          </p>
          <p>
            Each margin is the gap of the two displayed percentages, in points, and margins
            under 1.0 read as even.
            {anyFlagged && ' A call carries † whenever either of its sides does.'}
          </p>
          <p>
            Both sides&apos; numbers and the league&apos;s include technical free throws:
            league totals cannot exclude them, so parity keeps the comparison honest.
          </p>
          {(anyOmitted || anyOneSided) && (
            <p>
              {anyOmitted && 'Classes neither side drew are omitted.'}
              {anyOmitted && anyOneSided && ' '}
              {anyOneSided &&
                'A class one side never drew keeps its row, with no claim made for the empty side.'}
            </p>
          )}
          {technicals.length > 0 && (
            <p>
              Technical free throws sit in the season line and nowhere else, never earned
              by a trip:{' '}
              {technicals
                .map(
                  (s) => `${s.name} ${s.line.technicalFta} (${s.line.technicalFtm} made)`,
                )
                .join(' · ')}
              .
            </p>
          )}
          {anyFlagged && (
            <p>
              † conversion on fewer than {SMALL_SAMPLE_MAKING_ATTEMPTS} free throws: treat
              as uncertain (flagged, never suppressed).
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
