// The creation section of the hero report (ADR-0031): the v2.0 creation
// story as plain text, rendered from a creation payload. The verdict's
// why-sentence (ADR-0029) is authored from these numbers — which is why PPS
// prints at 3 decimals here: the guard bands sit inside what the UI's
// 2-decimal rounding hides.
//
// Presentation only (ADR-0011): every number comes off
// aggregateCreationMetrics or the payload _meta — nothing is recomputed
// here. The aggregation call is tooling-side, like heroReport's; HeroPage
// keeps the single production call site.

import { aggregateCreationMetrics } from '../domain/aggregateCreation'
import { SMALL_SAMPLE_MAKING_ATTEMPTS } from '../domain/constants'
import type { CreationPayload } from '../domain/creationPayload'
import { formatPercent1, withSmallSampleMark } from '../format'

const EM_DASH = '—'

/** 1.1875 -> "1.188" — verdict-authoring precision (see header comment). */
function formatPps3(x: number | null): string {
  if (x === null) return EM_DASH
  return x.toFixed(3)
}

const LABEL_WIDTH = 24

interface CreationCells {
  attempts: number
  attemptShare: number | null
  leagueAttemptShare: number
  pps: number | null
  leaguePps: number | null
  smallSamplePps: boolean
}

function tableHeader(labelName: string): string {
  return [
    labelName.padEnd(LABEL_WIDTH),
    'FGA'.padStart(4),
    'share'.padStart(8),
    'lg'.padStart(7),
    'PPS'.padStart(9),
    'lg'.padStart(7),
  ].join('')
}

function metricLine(label: string, r: CreationCells): string {
  return [
    label.padEnd(LABEL_WIDTH),
    String(r.attempts).padStart(4),
    formatPercent1(r.attemptShare).padStart(8),
    formatPercent1(r.leagueAttemptShare).padStart(7),
    // The † rides the PPS claim — same constant, same meaning as the zone
    // table's flag (ADR-0031).
    withSmallSampleMark(formatPps3(r.pps), r.smallSamplePps).padStart(9),
    formatPps3(r.leaguePps).padStart(7),
  ].join('')
}

export function renderCreationReport(payload: CreationPayload): string {
  const meta = payload._meta
  const m = aggregateCreationMetrics(payload)
  const lines: string[] = []

  lines.push(
    `CREATION (ADR-0030) — vs league average · shares on the season denominator (${m.seasonFga} attempts)`,
    `  pulled ${meta.pullDate} · schema v${meta.schemaVersion} · source ${meta.sourceSnapshot}`,
    `  league baseline ${meta.leagueSourceSnapshot} (${m.leagueFga} FGA)`,
  )

  lines.push('', '  HOW THE SHOT ARRIVED (General)')
  lines.push(`  ${tableHeader('context')}`)
  for (const row of m.general) {
    lines.push(`  ${metricLine(row.context, row)}`)
  }

  lines.push(
    '',
    '  SHOT CLOCK — product grain (the NBA\'s six bands, summed to three — ADR-0030)',
  )
  lines.push(`  ${tableHeader('band')}`)
  for (const row of m.shotClock) {
    lines.push(`  ${metricLine(`${row.band} (${row.seconds}s)`, row)}`)
  }

  // The coverage counters, always printed: the UI reports them when nonzero;
  // the authoring surface shows them unconditionally so a nonzero season is
  // never a surprise (ADR-0019 pattern).
  lines.push(
    '',
    `  unattributed shot-clock attempts: ${m.shotClockUnattributed} (player) · ` +
      `${m.leagueShotClockUnattributed} (league)`,
    `  † PPS on <${SMALL_SAMPLE_MAKING_ATTEMPTS} FGA — small-sample flag (flagged, never suppressed)`,
  )

  return lines.join('\n')
}
