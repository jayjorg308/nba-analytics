import type {
  AssistBandMetricsRow,
  AssistMetricsRow,
  AssistZoneMetricsRow,
  ShotContextMetrics,
} from '../domain/aggregateShotContext'
import { formatPercent1 } from '../format'

interface DisplayRow {
  key: string
  label: string
  row: AssistMetricsRow
  child?: boolean
}

function zoneLabel(zone: string): string {
  return zone.replace(/ 3$/, '')
}

function tableRows(metrics: ShotContextMetrics, showMidRangeBands: boolean): DisplayRow[] {
  const byZone = new Map(metrics.zones.map((row) => [row.zone, row]))
  const row = (zone: AssistZoneMetricsRow): DisplayRow => ({
    key: zone.zone,
    label: zoneLabel(zone.zone),
    row: zone,
  })
  const result: DisplayRow[] = [
    { key: 'all', label: 'All makes', row: metrics.all },
    row(byZone.get('Restricted Area')!),
    row(byZone.get('In The Paint (Non-RA)')!),
    row(byZone.get('Mid-Range')!),
  ]
  if (showMidRangeBands) {
    result.push(
      ...metrics.midRangeBands.filter((band) => band.attempts > 0).map(
        (band: AssistBandMetricsRow): DisplayRow => ({
          key: `mid-${band.band}`,
          label: band.band,
          row: band,
          child: true,
        }),
      ),
    )
  }
  result.push({ key: 'threes', label: '3 Pointers', row: metrics.threes })
  result.push(
    ...metrics.zones
      .filter((zone) => zone.zone.endsWith('3'))
      .map((zone) => ({
        key: zone.zone,
        label: zoneLabel(zone.zone),
        row: zone,
        child: true,
      })),
  )
  return result
}

function bounds(row: AssistMetricsRow): string {
  if (row.minAssistedShare === null || row.maxAssistedShare === null) return '—'
  return `${formatPercent1(row.minAssistedShare)}–${formatPercent1(row.maxAssistedShare)}`
}

function AssistedSharePlot({ rows, showBounds }: { rows: DisplayRow[]; showBounds: boolean }) {
  return (
    <div
      className="assist-plot"
      role="img"
      aria-label={
        showBounds
          ? 'Assisted-share bounds by shooting area; exact values are in the assisted makes table'
          : 'Assisted share by shooting area; exact values are in the assisted makes table'
      }
    >
      <div className="assist-axis" aria-hidden="true">
        <span className="assist-axis-scale">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </span>
      </div>
      {rows.map(({ key, label, row, child }) => (
        <div
          className={`assist-plot-row${child ? ' assist-plot-row-child' : ''}`}
          key={key}
          aria-hidden="true"
        >
          <span className="assist-plot-label">
            <span>{label}</span>
            <span className="assist-plot-denominator">{row.makes} FGM</span>
          </span>
          <span className="assist-track">
            {row.minAssistedShare !== null && row.maxAssistedShare !== null && (
              <>
                {showBounds && (
                  <span
                    className="assist-bound"
                    style={{
                      left: `${row.minAssistedShare * 100}%`,
                      width: `${(row.maxAssistedShare - row.minAssistedShare) * 100}%`,
                    }}
                  />
                )}
                {row.assistedShare !== null && (
                  <span
                    className="assist-share-dot"
                    style={{ left: `${row.assistedShare * 100}%` }}
                  />
                )}
              </>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

export function AssistedMakes({
  metrics,
  showMidRangeBands,
}: {
  metrics: ShotContextMetrics
  showMidRangeBands: boolean
}) {
  const rows = tableRows(metrics, showMidRangeBands)
  const hasCoverageGaps = rows.some(({ row }) => row.unknownMakes > 0)
  return (
    <section className="assisted-section" aria-labelledby="assisted-caption">
      <header className="section-caption">
        <h2 id="assisted-caption">ASSISTED MAKES</h2>
        <p className="section-caption-desc">
          {hasCoverageGaps
            ? 'scorer-credit assist share, with unknown makes kept visible as a bounded range'
            : 'scorer-credit assist share by shooting area'}
        </p>
      </header>
      <div className="section-layout assisted-layout">
        <AssistedSharePlot rows={rows} showBounds={hasCoverageGaps} />
        <div className="table-panel">
          <div className="zone-scroll">
            <table className="zone-table" aria-label="Assisted makes by shooting area">
              <thead>
                <tr>
                  <th scope="col">Area</th>
                  <th scope="col">FGM</th>
                  <th scope="col">Ast</th>
                  <th scope="col">Unast</th>
                  {hasCoverageGaps && <th scope="col">Unknown</th>}
                  <th scope="col">Ast share</th>
                  {hasCoverageGaps && <th scope="col">Coverage</th>}
                  {hasCoverageGaps && <th scope="col">Bounds</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ key, label, row, child }) => (
                  <tr key={key} className={child ? 'zone-row-child' : undefined}>
                    <th scope="row">{label}</th>
                    <td>{row.makes}</td>
                    <td>{row.assistedMakes}</td>
                    <td>{row.unassistedMakes}</td>
                    {hasCoverageGaps && <td>{row.unknownMakes}</td>}
                    <td>{formatPercent1(row.assistedShare)}</td>
                    {hasCoverageGaps && <td>{formatPercent1(row.coverage)}</td>}
                    {hasCoverageGaps && <td>{bounds(row)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-notes">
            {hasCoverageGaps && (
              <p>
                Assist share uses classified makes only. Unknown makes stay in the denominator for
                the minimum–maximum bounds; they are never guessed into either class.
              </p>
            )}
            <p>Unassisted means no scorer assist was credited, not necessarily self-created.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
