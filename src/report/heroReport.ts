// The hero report (ROADMAP v1.1 #2): a hero's computed story as plain text,
// rendered from a derived payload. Every hero swap starts by reading this —
// the verdict (ADR-0017) is authored from these numbers, which is why the
// decomposition block prints PPS at 3 decimals: the guard's semantic bands
// (a ±0.02 PPS league-average band, a 0.05 PPS materiality bar) sit inside
// what the UI's 2-decimal rounding hides.
//
// Presentation only (ADR-0011): every number comes off aggregateShotMetrics
// or the payload _meta — nothing is recomputed here. The aggregation call is
// tooling-side, like the verdict guard's; HeroPage keeps the single
// production call site (ADR-0007/0009).

import type { MakingBin } from '../chart/makingScale'
import { MAKING_LEGEND, makingDeltaBin } from '../chart/makingScale'
import { aggregateShotMetrics } from '../domain/aggregate'
import {
  LONG_TWO_BAND,
  SMALL_SAMPLE_MAKING_ATTEMPTS,
  ZONE_INCLUSION_MIN_ATTEMPTS,
} from '../domain/constants'
import type { DerivedPayload } from '../domain/payload'
import { formatPercent1, formatPps2, formatSignedGap, withSmallSampleMark } from '../format'

const EM_DASH = '—'

/** 1.0986 -> "1.099" — verdict-authoring precision (see header comment). */
function formatPps3(x: number | null): string {
  if (x === null) return EM_DASH
  return x.toFixed(3)
}

/** The making scale's bin, named the way the CSS arms name it (ADR-0013). */
function binName(bin: MakingBin | null): string {
  if (bin === null) return 'no data'
  if (bin === 0) return 'neutral'
  return bin < 0 ? `cold-${-bin}` : `warm-${bin}`
}

/** The fields ZoneMetricsRow, ThreesMetrics, and BandMetricsRow share — one
 * row renderer for all three, so columns can never drift between sections. */
interface MetricCells {
  attempts: number
  attemptShare: number | null
  leagueAttemptShare: number
  fgPct: number | null
  leagueFgPct: number
  pps: number | null
  leaguePps: number
  makingDelta: number | null
  smallSampleMaking: boolean
}

const LABEL_WIDTH = 24

function tableHeader(labelName: string): string {
  return [
    labelName.padEnd(LABEL_WIDTH),
    'FGA'.padStart(4),
    'share'.padStart(8),
    'lg'.padStart(7),
    'FG%'.padStart(8),
    'lg'.padStart(7),
    'PPS'.padStart(7),
    'lg'.padStart(6),
    'Δ pp'.padStart(9),
    '  bin',
  ].join('')
}

function metricLine(label: string, r: MetricCells, marker = ''): string {
  return [
    (label + marker).padEnd(LABEL_WIDTH),
    String(r.attempts).padStart(4),
    formatPercent1(r.attemptShare).padStart(8),
    formatPercent1(r.leagueAttemptShare).padStart(7),
    formatPercent1(r.fgPct).padStart(8),
    formatPercent1(r.leagueFgPct).padStart(7),
    formatPps2(r.pps).padStart(7),
    formatPps2(r.leaguePps).padStart(6),
    // Δ pp sits beside the FG% columns it relates, so it is their gap AS
    // DISPLAYED (ADR-0023); the bin still consumes the raw delta — the
    // documented makingScale edge, unchanged.
    withSmallSampleMark(
      formatSignedGap(r.fgPct === null ? null : r.fgPct * 100, r.leagueFgPct * 100, 1),
      r.smallSampleMaking,
    ).padStart(9),
    `  ${binName(makingDeltaBin(r.makingDelta))}`,
  ].join('')
}

export function renderHeroReport(payload: DerivedPayload): string {
  const meta = payload._meta
  const m = aggregateShotMetrics(payload.shots, payload.zoneBaseline)
  const lines: string[] = []

  lines.push(
    `${meta.player} · ${meta.season} · ${meta.seasonType}`,
    `pulled ${meta.pullDate} · schema v${meta.schemaVersion} · source ${meta.sourceSnapshot}`,
    // The honesty counters, all on one line: backcourt is excluded from
    // evaluation but always reported (ADR-0008), and zone-point conflicts are
    // dropped-and-counted, never guessed into a zone (ADR-0019).
    `${m.totalAttempts} shots · ${m.evalAttempts} evaluated · ` +
      `${m.backcourt.attempts} backcourt (reported, excluded) · ` +
      `${meta.zoneConflictsDropped} zone-point conflict${meta.zoneConflictsDropped === 1 ? '' : 's'} dropped`,
  )

  // Gates (ADR-0003/0008). Gate 1 is asserted by construction: the payload
  // strict-parsed (baseline present for all six zones) and the aggregation
  // did not throw (nonzero league FGA everywhere) — or we'd never get here.
  lines.push('', 'GATES')
  lines.push(
    `  Gate 1 · league baseline populated: PASS (all ${m.zones.length} evaluation zones, nonzero FGA)`,
  )
  lines.push(
    `  Gate 2 · volume — a zone joins the mix view at ≥${ZONE_INCLUSION_MIN_ATTEMPTS} FGA:`,
  )
  for (const z of m.zones) {
    lines.push(
      `      ${z.zone.padEnd(LABEL_WIDTH)}${String(z.attempts).padStart(4)} FGA  ${z.included ? 'included' : 'EXCLUDED'}`,
    )
  }
  const includedCount = m.zones.filter((z) => z.included).length
  lines.push(`      → ${includedCount}/${m.zones.length} zones clear the bar`)

  // The ADR-0016 decomposition, printed as the identity it is: league diet
  // + selection Δ + making Δ = actual PPS. The Δ lines are the gaps of the
  // printed anchors (ADR-0023), so the ladder always adds up as printed.
  lines.push('', 'DECOMPOSITION (ADR-0016) — PPS, verdict-authoring precision')
  lines.push(
    `  league diet at league shooting  ${formatPps3(m.selection.leagueDietExpectedPps).padStart(8)}`,
    `  + selection Δ                   ${formatSignedGap(m.selection.playerDietExpectedPps, m.selection.leagueDietExpectedPps, 3).padStart(8)}`,
    `  = expected from his diet        ${formatPps3(m.selection.playerDietExpectedPps).padStart(8)}`,
    `  + making (conversion) Δ         ${formatSignedGap(m.making.actualPps, m.selection.playerDietExpectedPps, 3).padStart(8)}`,
    `  = actual PPS                    ${formatPps3(m.making.actualPps).padStart(8)}`,
  )

  lines.push(
    '',
    `ZONES — vs league average · shares on the diet denominator (${m.evalAttempts} evaluation attempts)`,
  )
  lines.push(`  ${tableHeader('zone')}`)
  for (const z of m.zones) {
    lines.push(`  ${metricLine(z.zone, z, z.included ? '' : ' *')}`)
  }
  lines.push(`  ${metricLine('3 Pointers (combined)', m.threes)}`)
  lines.push(
    `  * below the ${ZONE_INCLUSION_MIN_ATTEMPTS}-FGA inclusion bar — suppressed in the mix view, still in the diet weighting`,
    `  † making Δ on <${SMALL_SAMPLE_MAKING_ATTEMPTS} FGA — small-sample flag (flagged, never suppressed)`,
    `  bins (pp vs league): ${MAKING_LEGEND.map((e) => `${binName(e.bin)} ${e.label}`).join(' | ')}`,
  )

  // ADR-0008 refinements: computed unconditionally, shipped on data-driven
  // visibility — the report prints the rows either way (that IS the story:
  // whether a different hero re-clears the gate).
  lines.push(
    '',
    `MID-RANGE SPLIT — ${m.midRangeSplit.visible ? 'VISIBLE' : 'hidden'} ` +
      `(ships when ${LONG_TWO_BAND} has ≥${ZONE_INCLUSION_MIN_ATTEMPTS} FGA)`,
  )
  lines.push(`  ${tableHeader('band')}`)
  for (const b of m.midRangeSplit.bands) {
    const label = b.band === LONG_TWO_BAND ? `${b.band} (long two)` : b.band
    lines.push(`  ${metricLine(label, b)}`)
  }

  const cs = m.cornerSplit
  lines.push(
    '',
    `CORNER SPLIT — ${cs.visible ? 'VISIBLE' : 'hidden'} ` +
      `(needs both corners ≥${ZONE_INCLUSION_MIN_ATTEMPTS} FGA; L ${cs.left.attempts}, R ${cs.right.attempts} — rows above)`,
  )

  return lines.join('\n')
}
