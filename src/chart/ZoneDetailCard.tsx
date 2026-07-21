import { useEffect, useRef } from 'react'
import type { ZoneMetricsRow } from '../domain/aggregate'
import { formatPercent1, formatPps2, formatSignedGap, withSmallSampleMark } from '../format'
import type { MakingBin } from './makingScale'
import { MAKING_LEGEND, makingBinVar, makingDeltaBin } from './makingScale'

export interface ZoneDetailCardProps {
  /** The clicked zone's row from metrics.zones — passed in whole, keyed by
   * zone name upstream (ADR-0012); this card only formats it (ADR-0011). */
  row: ZoneMetricsRow
  onClose: () => void
}

/** The mini making scale: the legend's seven swatches with a marker on the
 * bin this zone's delta lands in — ties the card back to the court's fill
 * color. Fixed bins, never a gradient (ADR-0013); reuses the --making-*
 * variables so the palette contract stays in one place (ADR-0014). No text
 * renders on a fill, so the contrast guard carries no new obligations.
 * aria-hidden like the main legend: the Making Δ line above carries the
 * value textually. A null bin (zero-attempt zone) shows the bar unmarked —
 * no data is not "at league average". */
function MakingScaleMini({ bin }: { bin: MakingBin | null }) {
  const activeIndex = MAKING_LEGEND.findIndex((entry) => entry.bin === bin)
  return (
    <div className="zone-detail-scale" aria-hidden="true">
      <div className="zone-detail-scale-bar">
        {MAKING_LEGEND.map((entry) => (
          <span
            key={entry.bin}
            className={`zone-detail-swatch${entry.bin === bin ? ' zone-detail-swatch-active' : ''}`}
            title={entry.label}
            style={{ background: `var(${makingBinVar(entry.bin)})` }}
          />
        ))}
        {activeIndex >= 0 && (
          <span
            className="zone-detail-scale-marker"
            style={{ left: `${((activeIndex + 0.5) / MAKING_LEGEND.length) * 100}%` }}
          />
        )}
      </div>
      <div className="zone-detail-scale-title">Shot making vs league average</div>
    </div>
  )
}

/**
 * The zone detail card: a click-opened overlay over the top of the court
 * (ADR-0027) — the same descriptive/evaluative facts the old hover tooltip
 * carried, plus the diet share and the making-scale position. Absolutely
 * positioned inside .chart-wrapper and sized by its content (the stylesheet
 * anchors it to the wrapper's top), so opening it never shifts page
 * geometry (ADR-0026).
 *
 * Every number is a re-presented ZoneMetricsRow field through src/format.ts
 * (ADR-0011). Making Δ renders BESIDE its two FG% anchors here, so it is
 * their gap as displayed, never the rounded raw delta (ADR-0023).
 *
 * Focus moves to the card on open (Escape then works immediately and the
 * dialog is announced); the owner returns focus to the zone on close. Not a
 * focus trap and not aria-modal — the card is a local disclosure over the
 * court, and Tab past the close button exits to the page naturally.
 */
export function ZoneDetailCard({ row, onClose }: ZoneDetailCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    cardRef.current?.focus()
  }, [])

  return (
    <div
      className="zone-detail"
      role="dialog"
      aria-label={`${row.zone} details`}
      tabIndex={-1}
      ref={cardRef}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <button
        type="button"
        className="zone-detail-close"
        aria-label="Close zone details"
        onClick={onClose}
      >
        ×
      </button>
      <h3 className="zone-detail-title">{row.zone}</h3>
      <p className="zone-detail-made">
        {row.makes} of {row.attempts} made
      </p>
      <dl className="zone-detail-rows">
        <div className="zone-detail-row">
          <dt>FG%</dt>
          <dd>
            {formatPercent1(row.fgPct)}{' '}
            <span className="lg">(lg {formatPercent1(row.leagueFgPct)})</span>
          </dd>
        </div>
        <div className="zone-detail-row">
          <dt>PPS</dt>
          <dd>
            {formatPps2(row.pps)} <span className="lg">(lg {formatPps2(row.leaguePps)})</span>
          </dd>
        </div>
        <div className="zone-detail-row">
          <dt>Share of his shots</dt>
          <dd>
            {formatPercent1(row.attemptShare)}{' '}
            <span className="lg">(lg {formatPercent1(row.leagueAttemptShare)})</span>
          </dd>
        </div>
        <div className="zone-detail-row">
          <dt>Making Δ</dt>
          <dd>
            {/* The gap of the two displayed FG% anchors above (ADR-0023) —
                the bin below still consumes the raw delta (ADR-0013 edge). */}
            {withSmallSampleMark(
              formatSignedGap(
                row.fgPct === null ? null : row.fgPct * 100,
                row.leagueFgPct * 100,
                1,
              ),
              row.smallSampleMaking,
            )}{' '}
            pp
          </dd>
        </div>
      </dl>
      {row.smallSampleMaking && (
        <p className="zone-detail-note">† Under 50 attempts — treat as uncertain.</p>
      )}
      <MakingScaleMini bin={makingDeltaBin(row.makingDelta)} />
    </div>
  )
}
