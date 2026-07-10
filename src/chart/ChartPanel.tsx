import { useRef, useState } from 'react'
import type { ZoneMetricsRow } from '../domain/aggregate'
import type { EnrichedShot } from '../domain/payload'
import {
  formatClock,
  formatGameDate,
  formatPercent1,
  formatPeriod,
  formatPps2,
  formatSignedPp1,
  withSmallSampleMark,
} from '../format'
import { MAKING_BIN_EDGES_PP, MAKING_LEGEND, makingBinVar } from './makingScale'
import { ShotChart } from './ShotChart'
import { ZoneOverlay } from './ZoneOverlay'

// Display-only view state: the toggle re-presents the same aggregation
// output and never re-aggregates (ADR-0007/0011 — the single production
// call site stays in HeroReady).
type CourtView = 'shots' | 'zones'

type Hovered =
  | { kind: 'shot'; shot: EnrichedShot; x: number; y: number; wrapperWidth: number }
  | { kind: 'zone'; row: ZoneMetricsRow; x: number; y: number; wrapperWidth: number }

// One controlled HTML tooltip for the whole chart — not per-mark <title>
// elements (delay-gated, unstylable, still invisible to touch). Content is
// descriptive/evaluative facts only (ADR-0005 — no creation language).
function TooltipBox({
  x,
  y,
  wrapperWidth,
  children,
}: {
  x: number
  y: number
  wrapperWidth: number
  children: React.ReactNode
}) {
  const clampedX = Math.min(Math.max(x, 80), Math.max(wrapperWidth - 80, 80))
  return (
    <div className="shot-tooltip" style={{ left: clampedX, top: y - 12 }}>
      {children}
    </div>
  )
}

function ShotTooltipContent({ shot }: { shot: EnrichedShot }) {
  return (
    <>
      <div className="shot-tooltip-when">
        {formatGameDate(shot.gameDate)} · {formatPeriod(shot.period)} ·{' '}
        {formatClock(shot.minutesRemaining, shot.secondsRemaining)}
      </div>
      <div>
        {shot.zoneBasic} — {shot.distanceFt} ft
      </div>
      <div className="shot-tooltip-result">{shot.made ? 'Made' : 'Missed'}</div>
    </>
  )
}

function ZoneTooltipContent({ row }: { row: ZoneMetricsRow }) {
  return (
    <>
      <div className="shot-tooltip-result">{row.zone}</div>
      <div>{row.attempts} FGA</div>
      <div>
        FG% {formatPercent1(row.fgPct)} <span className="lg">(lg {formatPercent1(row.leagueFgPct)})</span>
      </div>
      <div>
        PPS {formatPps2(row.pps)} <span className="lg">(lg {formatPps2(row.leaguePps)})</span>
      </div>
      <div>
        Making Δ {withSmallSampleMark(formatSignedPp1(row.makingDelta), row.smallSampleMaking)} pp
      </div>
      {row.smallSampleMaking && (
        <div className="shot-tooltip-when">† Under 50 attempts — treat as uncertain.</div>
      )}
    </>
  )
}

function edgeLabel(edge: number, sign: '−' | '+'): string {
  return `${sign}${(edge * 100).toFixed(1).replace(/\.0$/, '')}`
}

function ZonesLegend() {
  const edges = [
    ...[...MAKING_BIN_EDGES_PP].reverse().map((e) => edgeLabel(e, '−')),
    ...MAKING_BIN_EDGES_PP.map((e) => edgeLabel(e, '+')),
  ]
  return (
    // The comparison class travels with the scale (ADR-0002). aria-hidden:
    // the byline and the table caption carry it accessibly.
    <div className="zones-legend" aria-hidden="true">
      <div className="zones-legend-title">
        Shot making vs league average (percentage points)
      </div>
      <div className="zones-legend-scale">
        <span className="zones-legend-end">− below league</span>
        <div className="zones-legend-steps">
          <div className="zones-legend-swatches">
            {MAKING_LEGEND.map((entry) => (
              <span
                key={entry.bin}
                className="zones-legend-swatch"
                title={entry.label}
                style={{ background: `var(${makingBinVar(entry.bin)})` }}
              />
            ))}
          </div>
          <div className="zones-legend-edges">
            {edges.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
        <span className="zones-legend-end">+ above league</span>
      </div>
    </div>
  )
}

export function ChartPanel({
  shots,
  zones,
  ariaLabel,
}: {
  shots: EnrichedShot[]
  zones: ZoneMetricsRow[]
  ariaLabel: string
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<CourtView>('shots')
  const [hovered, setHovered] = useState<Hovered | null>(null)

  function switchView(next: CourtView) {
    setView(next)
    setHovered(null)
  }

  function anchorInWrapper(clientAnchor: { x: number; y: number }) {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: clientAnchor.x - rect.left,
      y: clientAnchor.y - rect.top,
      wrapperWidth: rect.width,
    }
  }

  return (
    <div className="chart-panel">
      <fieldset className="court-view-toggle">
        <legend className="visually-hidden">Court view</legend>
        {(['shots', 'zones'] as const).map((v) => (
          <label key={v} className={view === v ? 'toggle-active' : undefined}>
            <input
              type="radio"
              name="court-view"
              value={v}
              checked={view === v}
              onChange={() => switchView(v)}
            />
            {v === 'shots' ? 'Shots' : 'Zones'}
          </label>
        ))}
      </fieldset>
      <div className="chart-wrapper" ref={wrapperRef}>
        {view === 'shots' ? (
          <ShotChart
            shots={shots}
            ariaLabel={ariaLabel}
            onShotEnter={(shot, clientAnchor) => {
              const pos = anchorInWrapper(clientAnchor)
              if (pos) setHovered({ kind: 'shot', shot, ...pos })
            }}
            onShotLeave={() => setHovered(null)}
          />
        ) : (
          <ZoneOverlay
            zones={zones}
            ariaLabel="Zone-shaded half court: shot making vs league average by zone"
            onZoneEnter={(row, clientAnchor) => {
              const pos = anchorInWrapper(clientAnchor)
              if (pos) setHovered({ kind: 'zone', row, ...pos })
            }}
            onZoneLeave={() => setHovered(null)}
          />
        )}
        {hovered && (
          <TooltipBox x={hovered.x} y={hovered.y} wrapperWidth={hovered.wrapperWidth}>
            {hovered.kind === 'shot' ? (
              <ShotTooltipContent shot={hovered.shot} />
            ) : (
              <ZoneTooltipContent row={hovered.row} />
            )}
          </TooltipBox>
        )}
      </div>
      {view === 'shots' ? (
        <div className="chart-legend" aria-hidden="true">
          <span className="legend-item">
            <span className="legend-swatch legend-made" /> Made
          </span>
          <span className="legend-item">
            <span className="legend-swatch legend-missed" /> Missed
          </span>
        </div>
      ) : (
        <ZonesLegend />
      )}
    </div>
  )
}
