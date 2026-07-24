// The GROWTH section (ADR-0061): season-over-season movement in the
// vs-league residuals, printed report-first so a growth-sentence is authored
// from this output (the hero-swap recipe, extended to the flip). Reuses the
// production growth aggregation (ADR-0009 — never a second implementation).

import type { GrowthMetrics } from '../domain/aggregateGrowth'

const sign = (v: number, dp: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(dp)}`
const pp = (v: number) => sign(v * 100, 1)

function movementLine(
  label: string,
  prior: number | null,
  current: number | null,
  fmt: (v: number) => string,
  flag = '',
): string {
  if (prior === null || current === null) {
    return `  ${label.padEnd(28)}—`
  }
  const arrow = `${fmt(prior)} → ${fmt(current)}`
  return `  ${label.padEnd(28)}${arrow.padEnd(22)}moved ${fmt(current - prior)}${flag}`
}

export function renderGrowthReport(growth: GrowthMetrics): string {
  const lines: string[] = []
  lines.push(
    `GROWTH (ADR-0061) — ${growth.priorSeason} → ${growth.currentSeason}, ` +
      'movement in the vs-league residuals (each season vs its own league; raw values, not display roundings)',
  )

  lines.push('', '  TWO-AXIS (PPS)')
  lines.push(
    movementLine(
      'selection Δ',
      growth.spine.prior.selectionDelta,
      growth.spine.current.selectionDelta,
      (v) => sign(v, 3),
    ),
  )
  lines.push(
    movementLine(
      'making Δ',
      growth.spine.prior.makingPpsDelta,
      growth.spine.current.makingPpsDelta,
      (v) => sign(v, 3),
    ),
  )

  lines.push('', '  DIET GAP vs LG SHARE (share points, his share − lg share)')
  for (const z of growth.zones) {
    lines.push(movementLine(z.zone, z.prior.dietGap, z.current.dietGap, pp))
  }

  lines.push('', '  MAKING Δ vs LG (FG pp; † = a season under the 50-FGA sample bar)')
  for (const z of growth.zones) {
    const flag = z.prior.smallSampleMaking || z.current.smallSampleMaking ? ' †' : ''
    lines.push(movementLine(z.zone, z.prior.makingDelta, z.current.makingDelta, pp, flag))
  }

  return lines.join('\n')
}
