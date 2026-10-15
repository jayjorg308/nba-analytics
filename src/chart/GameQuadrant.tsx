// The game quadrant (docs/plans/jazz-first-site.md, the team report card):
// selection delta across, making delta up, one dot per game from its card,
// this game highlighted, every dot a link to its own card. The prior
// season's games sit behind as faded dots, so the chart is full from
// opening night; the seasons share these axes because every dot is priced
// against its own pre-game ruler (ADR-0089).
//
// Text is HTML over the SVG, never SVG text: the plot scales to the phone's
// width, and a corner label scaled with it was illegible at 375px. The hint
// line follows the input device (CSS media queries), so a phone never reads
// "hover". Formats only; every number arrives computed (reportCard.ts).

import { useState } from 'react'
import type { GameDot } from '../domain/reportCard'
import { formatGameDate, formatMatchup, formatSignedGap } from '../format'
import { REPORT_COPY } from '../teams/copy'
import { CORNER_LABELS } from '../teams/computedCopy'

const W = 600
const H = 460
const PAD = 16

function dotGaps(dot: GameDot): { diet: string; conversion: string } {
  const { selection, making } = dot.metrics
  return {
    diet: formatSignedGap(selection.playerDietExpectedPps, selection.leagueDietExpectedPps, 2),
    conversion: formatSignedGap(making.actualPps, selection.playerDietExpectedPps, 2),
  }
}

function describe(dot: GameDot): string {
  const { diet, conversion } = dotGaps(dot)
  const result = `${dot.won ? 'W' : 'L'} ${dot.teamScore}–${dot.opponentScore}`
  return REPORT_COPY.dotLabel(formatGameDate(dot.gameDate), formatMatchup(dot.opponent, dot.home), result, diet, conversion)
}

export function GameQuadrant({
  dots,
  tonight,
  priorDots,
  season,
  priorSeason,
  hrefOf,
  ariaLabel,
}: {
  dots: readonly GameDot[]
  tonight: GameDot
  priorDots: readonly GameDot[]
  season: string
  priorSeason: string | null
  hrefOf: (dot: GameDot) => string
  ariaLabel: string
}) {
  const [readout, setReadout] = useState<GameDot | null>(null)
  const sel = (d: GameDot) => d.metrics.selection.selectionDelta!
  const mak = (d: GameDot) => d.metrics.making.makingPpsDelta!
  const all = [...dots, ...priorDots]
  // Symmetric about zero so the axes cross at the center and each corner is
  // a quadrant; floors keep a quiet season from magnifying noise.
  const xMax = Math.max(0.1, ...all.map((d) => Math.abs(sel(d)))) * 1.15
  const yMax = Math.max(0.3, ...all.map((d) => Math.abs(mak(d)))) * 1.1
  const x = (v: number) => PAD + ((v + xMax) / (2 * xMax)) * (W - 2 * PAD)
  const y = (v: number) => H - PAD - ((v + yMax) / (2 * yMax)) * (H - 2 * PAD)

  const dot = (d: GameDot, kind: 'prior' | 'season' | 'tonight') => (
    <a
      key={`${kind}-${d.gameId}`}
      href={hrefOf(d)}
      aria-label={describe(d)}
      // Mouse only (ShotChart's rule, ADR-0027): a tap fires pointerenter
      // with no leave to follow, and on a phone the tap opens the card.
      onPointerEnter={(e) => e.pointerType === 'mouse' && setReadout(d)}
      onPointerLeave={() => setReadout(null)}
      onFocus={() => setReadout(d)}
      onBlur={() => setReadout(null)}
    >
      {/* A finger-sized target behind each drawn dot. */}
      <circle cx={x(sel(d))} cy={y(mak(d))} r={14} className="quadrant-hit" />
      <circle cx={x(sel(d))} cy={y(mak(d))} r={kind === 'tonight' ? 9 : 6} className={`quadrant-dot quadrant-dot-${kind}`} />
    </a>
  )

  return (
    <figure className="quadrant">
      <p className="quadrant-axis quadrant-axis-y">{REPORT_COPY.yAxis}</p>
      <div className="quadrant-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={ariaLabel}>
          <line x1={x(0)} x2={x(0)} y1={PAD} y2={H - PAD} className="quadrant-zero" />
          <line x1={PAD} x2={W - PAD} y1={y(0)} y2={y(0)} className="quadrant-zero" />
          {priorDots.map((d) => dot(d, 'prior'))}
          {dots.filter((d) => d.gameId !== tonight.gameId).map((d) => dot(d, 'season'))}
          {dot(tonight, 'tonight')}
        </svg>
        <span className="quadrant-corner quadrant-corner-tl">{CORNER_LABELS['down-up']}</span>
        <span className="quadrant-corner quadrant-corner-tr">{CORNER_LABELS['up-up']}</span>
        <span className="quadrant-corner quadrant-corner-bl">{CORNER_LABELS['down-down']}</span>
        <span className="quadrant-corner quadrant-corner-br">{CORNER_LABELS['up-down']}</span>
      </div>
      <p className="quadrant-axis quadrant-axis-x">{REPORT_COPY.xAxis}</p>
      <figcaption className="quadrant-caption">
        <span className="quadrant-legend">
          <span className="quadrant-legend-item">
            <span className="quadrant-key quadrant-key-tonight" aria-hidden="true" />
            {REPORT_COPY.legendTonight}
          </span>
          <span className="quadrant-legend-item">
            <span className="quadrant-key quadrant-key-season" aria-hidden="true" />
            {REPORT_COPY.legendSeason(season)}
          </span>
          {priorSeason !== null && priorDots.length > 0 && (
            <span className="quadrant-legend-item">
              <span className="quadrant-key quadrant-key-prior" aria-hidden="true" />
              {REPORT_COPY.legendPrior(priorSeason)}
            </span>
          )}
        </span>
        <span className="quadrant-readout" aria-live="polite">
          {readout !== null ? (
            describe(readout)
          ) : (
            <>
              <span className="quadrant-hint-pointer">{REPORT_COPY.hintPointer}</span>
              <span className="quadrant-hint-touch">{REPORT_COPY.hintTouch}</span>
            </>
          )}
        </span>
      </figcaption>
    </figure>
  )
}
