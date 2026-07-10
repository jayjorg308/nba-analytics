import { useRef, useState } from 'react'
import type { EnrichedShot } from '../domain/payload'
import { formatClock, formatGameDate, formatPeriod } from '../format'
import { ShotChart } from './ShotChart'

interface Hovered {
  shot: EnrichedShot
  x: number // px, relative to the chart wrapper
  y: number
  wrapperWidth: number // snapshotted at hover time (refs can't be read in render)
}

// One controlled HTML tooltip for the whole chart — not 509 <title> elements
// (delay-gated, unstylable, still invisible to touch). Content is descriptive
// facts only: date, quarter, clock, zone, distance, result (ADR-0005 — no
// creation language anywhere).
function ShotTooltip({ hovered }: { hovered: Hovered }) {
  const { shot, x, y, wrapperWidth } = hovered
  const clampedX = Math.min(Math.max(x, 80), Math.max(wrapperWidth - 80, 80))
  return (
    <div className="shot-tooltip" style={{ left: clampedX, top: y - 12 }}>
      <div className="shot-tooltip-when">
        {formatGameDate(shot.gameDate)} · {formatPeriod(shot.period)} ·{' '}
        {formatClock(shot.minutesRemaining, shot.secondsRemaining)}
      </div>
      <div>
        {shot.zoneBasic} — {shot.distanceFt} ft
      </div>
      <div className="shot-tooltip-result">{shot.made ? 'Made' : 'Missed'}</div>
    </div>
  )
}

export function ChartPanel({ shots, ariaLabel }: { shots: EnrichedShot[]; ariaLabel: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState<Hovered | null>(null)

  return (
    <div className="chart-panel">
      <div className="chart-wrapper" ref={wrapperRef}>
        <ShotChart
          shots={shots}
          ariaLabel={ariaLabel}
          onShotEnter={(shot, clientAnchor) => {
            const rect = wrapperRef.current?.getBoundingClientRect()
            if (!rect) return
            setHovered({
              shot,
              x: clientAnchor.x - rect.left,
              y: clientAnchor.y - rect.top,
              wrapperWidth: rect.width,
            })
          }}
          onShotLeave={() => setHovered(null)}
        />
        {hovered && <ShotTooltip hovered={hovered} />}
      </div>
      <div className="chart-legend" aria-hidden="true">
        <span className="legend-item">
          <span className="legend-swatch legend-made" /> Made
        </span>
        <span className="legend-item">
          <span className="legend-swatch legend-missed" /> Missed
        </span>
      </div>
    </div>
  )
}
