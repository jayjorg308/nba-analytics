import { useLayoutEffect, useRef, useState } from 'react'
import type { ZoneMetricsRow } from '../domain/aggregate'
import type { EvalZone } from '../domain/constants'
import type { EnrichedShot } from '../domain/payload'
import type { AssistStatus } from '../domain/shotContextPayload'
import { shotIdentity } from '../domain/aggregateShotContext'
import { formatClock, formatGameDate, formatMatchup, formatPeriod } from '../format'
import { MAKING_BIN_EDGES_PP, MAKING_LEGEND, makingBinVar } from './makingScale'
import { ShotChart } from './ShotChart'
import { ZoneDetailCard } from './ZoneDetailCard'
import { ZoneOverlay } from './ZoneOverlay'

// Display-only view state: the toggle re-presents the same aggregation
// output and never re-aggregates (ADR-0007/0011 — the single production
// call site stays in HeroReady).
type CourtView = 'shots' | 'zones'

// Shots-view hover only (mouse pointers, ADR-0027) — zone details are the
// click-opened ZoneDetailCard, not a tooltip.
type Hovered = {
  shot: EnrichedShot
  x: number
  y: number
  wrapperWidth: number
  wrapperHeight: number
}

// The selected zone is stored by KEY and the row looked up from the zones
// prop — the card re-presents the data's row for that zone name, never
// anything derived from where the click landed (ADR-0012). The trigger
// element is kept so close can return focus to the zone.
type SelectedZone = { zone: EvalZone; trigger: SVGGElement | null }

// One controlled HTML tooltip for the Shots view — not per-mark <title>
// elements (delay-gated, unstylable, still invisible to touch). Content is
// descriptive facts only (ADR-0005 — no creation language). The box
// measures itself and clamps to the wrapper on both axes (flipping below
// the dot when the top would clip), so it can never overflow the court.
function TooltipBox({
  x,
  y,
  wrapperWidth,
  wrapperHeight,
  children,
}: {
  x: number
  y: number
  wrapperWidth: number
  wrapperHeight: number
  children: React.ReactNode
}) {
  const boxRef = useRef<HTMLDivElement>(null)

  // Position imperatively after every render: the box must be measured
  // before it can be clamped, and measuring needs it in the DOM. It renders
  // hidden at the anchor, then this effect places it and reveals it before
  // paint — no state, so no re-render chain, and content changes re-measure
  // automatically. (jsdom measures 0×0 — the math degrades safely.)
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const EDGE = 8
    const GAP = 12
    const w = el.offsetWidth
    const h = el.offsetHeight
    const left = Math.min(Math.max(x - w / 2, EDGE), Math.max(wrapperWidth - w - EDGE, EDGE))
    const above = y - h - GAP
    const flipBelow = above < EDGE // would clip the top edge -> go under the dot
    const rawTop = flipBelow ? y + GAP + 4 : above
    const top = Math.min(Math.max(rawTop, EDGE), Math.max(wrapperHeight - h - EDGE, EDGE))
    el.style.left = `${left}px`
    el.style.top = `${top}px`
    el.style.visibility = 'visible'
  })

  return (
    <div
      className="shot-tooltip"
      ref={boxRef}
      style={{ left: x, top: y, visibility: 'hidden' }}
    >
      {children}
    </div>
  )
}

function ShotTooltipContent({ shot, assistStatus }: { shot: EnrichedShot; assistStatus?: AssistStatus }) {
  const assistLabel =
    assistStatus === 'assisted'
      ? 'Assisted'
      : assistStatus === 'unassisted'
        ? 'Unassisted'
        : assistStatus === 'unknown'
          ? 'Assist status unavailable'
          : null
  return (
    <>
      <div className="shot-tooltip-when">
        {formatGameDate(shot.gameDate)} · {formatMatchup(shot.opponent, shot.home)} ·{' '}
        {formatPeriod(shot.period)} · {formatClock(shot.minutesRemaining, shot.secondsRemaining)}
      </div>
      <div>
        {shot.zoneBasic} · {shot.distanceFt} ft
      </div>
      <div className="shot-tooltip-result">{shot.made ? 'Made' : 'Missed'}</div>
      {shot.made && assistLabel && <div className="shot-tooltip-assist">{assistLabel}</div>}
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
      {/* Boundary values render INSIDE the bar (the court labels' ink+halo
          recipe — the ADR-0014 guard's contrast floor covers every fill), so
          the legend is two compact lines. Both views' legends then share a
          height and the reserved slot carries no dead band in the Shots
          view. End caps ("below"/"above") dropped: the values are signed
          and the title names the comparison. */}
      <div className="zones-legend-bar">
        {MAKING_LEGEND.map((entry) => (
          <span
            key={entry.bin}
            className="zones-legend-swatch"
            title={entry.label}
            style={{ background: `var(${makingBinVar(entry.bin)})` }}
          />
        ))}
        {edges.map((label, i) => (
          <span
            key={label}
            className="zones-legend-edge"
            style={{ left: `${((i + 1) / 7) * 100}%` }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function ChartPanel({
  shots,
  zones,
  ariaLabel,
  assistStatusByShotKey,
}: {
  shots: EnrichedShot[]
  zones: ZoneMetricsRow[]
  ariaLabel: string
  assistStatusByShotKey: ReadonlyMap<string, AssistStatus>
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  // Zones is the DEFAULT view: the zone-shaded court is the argument (the
  // verdict painted on the floor); the raw made/missed scatter is the
  // secondary, look-closer view.
  const [view, setView] = useState<CourtView>('zones')
  const [hovered, setHovered] = useState<Hovered | null>(null)
  const [selected, setSelected] = useState<SelectedZone | null>(null)
  const selectedRow = selected ? (zones.find((z) => z.zone === selected.zone) ?? null) : null

  // The toggle dismisses both the shot tooltip and the zone card. No focus
  // juggling here — the toggle itself holds focus.
  function switchView(next: CourtView) {
    setView(next)
    setHovered(null)
    setSelected(null)
  }

  function closeDetail() {
    const trigger = selected?.trigger
    setSelected(null)
    if (trigger?.isConnected) trigger.focus()
  }

  function anchorInWrapper(clientAnchor: { x: number; y: number }) {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: clientAnchor.x - rect.left,
      y: clientAnchor.y - rect.top,
      wrapperWidth: rect.width,
      wrapperHeight: rect.height,
    }
  }

  return (
    <div className="chart-panel">
      {/* Legend beside the toggle, ABOVE the court: the legend is the key to
          reading the hero visual, so it is read before the fills, not after. */}
      <div className="chart-controls">
        <fieldset className="court-view-toggle">
          <legend className="visually-hidden">Court view</legend>
          {(['zones', 'shots'] as const).map((v) => (
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
        {/* BOTH legends stay mounted, stacked in one cell: the zones legend
            is the tallest thing in the controls row — if the inactive legend
            unmounted, the row would shrink and the court below it would jump
            ~20px on every toggle. The inactive layer is visibility-hidden,
            never removed. */}
        <div className="chart-legend-slot">
          <div className={`chart-legend-layer${view === 'zones' ? '' : ' legend-inactive'}`}>
            <ZonesLegend />
          </div>
          <div className={`chart-legend-layer${view === 'shots' ? '' : ' legend-inactive'}`}>
            <div className="chart-legend" aria-hidden="true">
              <span className="legend-item">
                <span className="legend-swatch legend-made" /> Made
              </span>
              <span className="legend-item">
                <span className="legend-swatch legend-missed" /> Missed
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="chart-wrapper" ref={wrapperRef}>
        {view === 'shots' ? (
          <ShotChart
            shots={shots}
            ariaLabel={ariaLabel}
            onShotEnter={(shot, clientAnchor) => {
              const pos = anchorInWrapper(clientAnchor)
              if (pos) setHovered({ shot, ...pos })
            }}
            onShotLeave={() => setHovered(null)}
          />
        ) : (
          <ZoneOverlay
            zones={zones}
            ariaLabel="Zone-shaded half court: shot making vs league average by zone"
            onZoneSelect={(row, trigger) => setSelected({ zone: row.zone, trigger })}
          />
        )}
        {hovered && (
          <TooltipBox
            x={hovered.x}
            y={hovered.y}
            wrapperWidth={hovered.wrapperWidth}
            wrapperHeight={hovered.wrapperHeight}
          >
            <ShotTooltipContent
              shot={hovered.shot}
              assistStatus={assistStatusByShotKey.get(shotIdentity(hovered.shot))}
            />
          </TooltipBox>
        )}
        {/* Out of flow inside the wrapper: opening/closing the card never
            moves the page (ADR-0026's companion invariant). */}
        {view === 'zones' && selectedRow && (
          <ZoneDetailCard
            row={selectedRow}
            onClose={closeDetail}
            // outside press: dismiss without the focus return — the reader
            // pressed elsewhere on purpose (the Term contract)
            onOutsidePress={() => setSelected(null)}
            trigger={selected?.trigger ?? null}
          />
        )}
      </div>
      {/* One interaction cue per view, a caption under the court. Both cues
          stay mounted, stacked in one cell (the legend-slot recipe), so the
          toggle never changes the panel's height. aria-hidden: the zone
          fills are real buttons (aria-haspopup) and the hover cue is
          mouse-only (ADR-0027) — AT and touch users get every number in
          the table. */}
      <div className="chart-hint-slot" aria-hidden="true">
        <p className={`chart-hint${view === 'zones' ? '' : ' hint-inactive'}`}>
          <span className="hint-verb-click">Click</span>
          <span className="hint-verb-tap">Tap</span> any zone for its full numbers
        </p>
        <p className={`chart-hint chart-hint-hover${view === 'shots' ? '' : ' hint-inactive'}`}>
          Hover over any shot for its date, distance, and result
        </p>
      </div>
    </div>
  )
}
