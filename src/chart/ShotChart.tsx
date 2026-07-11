import type { EnrichedShot } from '../domain/payload'
import { CourtLines } from './CourtLines'
import { DOT_R, HIT_R, isOnCourt, statsToSvg, VIEWBOX } from './geometry'

export interface ShotChartProps {
  shots: EnrichedShot[]
  ariaLabel: string
  /** Anchor is the dot center in CLIENT (viewport) pixels — the tooltip owner
   * converts to its own coordinate space. */
  onShotEnter?: (shot: EnrichedShot, clientAnchor: { x: number; y: number }) => void
  onShotLeave?: () => void
}

/**
 * Pure half-court chart: court line-work + one dot per shot.
 *
 * Off-frame shots (e.g. backcourt heaves) are SKIPPED, never clamped — a
 * clamped dot would lie about where the shot happened, and the attempts are
 * already reported in the metrics table ("never hidden", ADR-0008). A caption
 * notes the omission whenever it occurs.
 *
 * A11y: the svg is a labeled image; dots are aria-hidden. The zone table is
 * the accessible data representation — 509 tab stops would help no one.
 * Tooltips are pointer-hover only; touch/keyboard users get every number in
 * the table.
 */
export function ShotChart({ shots, ariaLabel, onShotEnter, onShotLeave }: ShotChartProps) {
  const visible = shots.filter(isOnCourt)
  const skipped = shots.length - visible.length
  // Missed rings render first, made fills on top: made shots are the minority
  // and the visual payoff, and this keeps the restricted-area pileup legible.
  const ordered = [...visible].sort((a, b) => Number(a.made) - Number(b.made))

  return (
    <>
      <svg className="shot-chart" viewBox={VIEWBOX} role="img" aria-label={ariaLabel}>
        <CourtLines />
        <g aria-hidden="true">
          {ordered.map((shot) => {
            const p = statsToSvg(shot.locX, shot.locY)
            return (
              <g key={`${shot.gameId}-${shot.gameEventId}`} className="shot-dot">
                <circle
                  className={shot.made ? 'dot-made' : 'dot-missed'}
                  cx={p.x}
                  cy={p.y}
                  r={DOT_R}
                />
                <circle
                  className="dot-hit"
                  cx={p.x}
                  cy={p.y}
                  r={HIT_R}
                  onPointerEnter={(e) => {
                    const r = e.currentTarget.getBoundingClientRect()
                    onShotEnter?.(shot, { x: r.x + r.width / 2, y: r.y + r.height / 2 })
                  }}
                  onPointerLeave={() => onShotLeave?.()}
                />
              </g>
            )
          })}
        </g>
      </svg>
      {skipped > 0 && (
        <p className="chart-skip-note">
          {skipped} shot{skipped === 1 ? '' : 's'} beyond half-court not shown (reported in the
          table).
        </p>
      )}
    </>
  )
}
