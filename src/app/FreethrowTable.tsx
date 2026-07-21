import type { FreethrowMetrics, TripClassRow } from '../domain/aggregateFreethrow'
import { SMALL_SAMPLE_MAKING_ATTEMPTS, ZONE_INCLUSION_MIN_ATTEMPTS } from '../domain/constants'
import { formatPercent1, formatPps2, formatTripClass, withSmallSampleMark } from '../format'
import { Term } from './Term'

/**
 * The accessible data twin of the line-vs-floor chart, and the home of the
 * season line's league comparisons. Every number comes from the single
 * free-throw aggregation output — this component formats, it never computes
 * (ADR-0011). The season line leads (payoff first, ADR-0018): generation and
 * conversion are two-number stories, so they live here and in the act
 * description rather than in the chart (ADR-0056). Below it, the trip
 * taxonomy at its two tiers — hero-descriptive, no league column beyond each
 * trip's league price (ADR-0038/0055).
 *
 * Trip classes the hero never drew are omitted, the ADR-0043 pattern: an
 * attempt-empty row reappears automatically when its data becomes
 * informative. Nothing is corrupted by the omission — the taxonomy table
 * displays no share column.
 */
export function FreethrowTable({ metrics }: { metrics: FreethrowMetrics }) {
  const s = metrics.seasonLine
  const byTier = (tier: TripClassRow['tier']) =>
    metrics.tripClasses.filter((row) => row.tier === tier && row.trips > 0)
  const shown = [...byTier('attemptEquivalent'), ...byTier('addOn')]
  const anyFlagged = shown.some((row) => row.smallSampleConversion && row.conversion !== null)
  const anyUnplaced = metrics.tripClasses.some(
    (row) =>
      (row.tripClass === 'shootingFoul2' || row.tripClass === 'shootingFoul3') &&
      row.fta > 0 &&
      row.fta < ZONE_INCLUSION_MIN_ATTEMPTS,
  )
  const chartedZeroClasses = metrics.tripClasses.filter(
    (row) =>
      (row.tripClass === 'shootingFoul2' || row.tripClass === 'shootingFoul3') &&
      row.trips === 0,
  )

  return (
    <div className="table-panel">
      <div className="zone-scroll">
        <table className="zone-table" aria-label="Free-throw trips by class">
          <thead>
            <tr>
              <th scope="col">Class</th>
              <th scope="col">
                <Term id="trip">Trips</Term>
              </th>
              <th scope="col">FTM/FTA</th>
              <th scope="col">Conv</th>
              <th scope="col">
                <Term id="pts-per-trip">Pts per trip (lg)</Term>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="creation-group-row">
              <th scope="colgroup" colSpan={5}>
                Attempt-equivalent: the trip stood in for a shot
              </th>
            </tr>
            {byTier('attemptEquivalent').map((row) => (
              <TripRow key={row.tripClass} row={row} />
            ))}
          </tbody>
          <tbody>
            <tr className="creation-group-row">
              <th scope="colgroup" colSpan={5}>
                Add-on: points on top of a play that stood
              </th>
            </tr>
            {byTier('addOn').map((row) => (
              <TripRow key={row.tripClass} row={row} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-notes">
        <p>
          His numbers and the league&apos;s include technical free throws on both sides:
          league totals cannot exclude them, so parity keeps the comparison honest.
        </p>
        {s.technicalFta > 0 && (
          <p>
            {s.technicalFta} technical free throw{s.technicalFta === 1 ? '' : 's'} (
            {s.technicalFtm} made) {s.technicalFta === 1 ? 'sits' : 'sit'} in his season
            line and nowhere else: awarded to a designated shooter, never earned by a trip.
          </p>
        )}
        {chartedZeroClasses.map((row) => (
          <p key={row.tripClass}>
            He drew no {row.tripClass === 'shootingFoul3' ? 'three' : 'two'}-shot shooting
            fouls this season; the chart keeps the league&apos;s price for scale.
          </p>
        ))}
        {anyUnplaced && (
          <p>
            Classes under {ZONE_INCLUSION_MIN_ATTEMPTS} free throws draw no dot of his in
            the chart: too thin to place a value on; their numbers stay here.
          </p>
        )}
        {anyFlagged && (
          <p>
            † conversion on fewer than {SMALL_SAMPLE_MAKING_ATTEMPTS} free throws: treat as
            uncertain (flagged, never suppressed).
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * The season line — the act's stat coda, rendered in the visual column below
 * the line-vs-floor chart so both grid cells start at the same top edge (the
 * register every act holds, ADR-0026). Each metric vs the league on
 * identical semantics (technicals included both sides — ADR-0055);
 * dictionary terms wrap every label, this surface's reference convention
 * (ADR-0052, uniform per surface).
 */
export function FreethrowSeasonLine({ metrics }: { metrics: FreethrowMetrics }) {
  const s = metrics.seasonLine
  return (
    <dl className="freethrow-season" aria-label="Season free-throw line, vs league average">
      <div className="freethrow-metric">
        <dt>
          <Term id="fta-rate">FTA rate</Term>
        </dt>
        <dd>
          {formatPercent1(s.ftaRate.value)}{' '}
          <span className="lg">(lg {formatPercent1(s.ftaRate.league)})</span>
        </dd>
      </div>
      <div className="freethrow-metric">
        <dt>
          <Term id="ft-points-share">FT share of points</Term>
        </dt>
        <dd>
          {formatPercent1(s.ftPointsShare.value)}{' '}
          <span className="lg">(lg {formatPercent1(s.ftPointsShare.league)})</span>
        </dd>
      </div>
      <div className="freethrow-metric">
        <dt>
          <Term id="ft-conversion">FT conversion</Term>
        </dt>
        <dd>
          {withSmallSampleMark(
            formatPercent1(s.conversion.value),
            s.smallSampleConversion && s.conversion.value !== null,
          )}{' '}
          <span className="lg">(lg {formatPercent1(s.conversion.league)})</span>
        </dd>
      </div>
    </dl>
  )
}

function TripRow({ row }: { row: TripClassRow }) {
  return (
    <tr>
      <th scope="row">{formatTripClass(row.tripClass)}</th>
      <td>{row.trips}</td>
      <td>
        {row.ftm}/{row.fta}
      </td>
      <td>
        {withSmallSampleMark(
          formatPercent1(row.conversion),
          row.smallSampleConversion && row.conversion !== null,
        )}
      </td>
      <td>
        {formatPps2(row.pointsPerTrip)}{' '}
        {row.leagueExpectedPointsPerTrip !== null && (
          <span className="lg">({formatPps2(row.leagueExpectedPointsPerTrip)})</span>
        )}
      </td>
    </tr>
  )
}
