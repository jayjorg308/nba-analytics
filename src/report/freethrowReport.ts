// THE LINE section of the hero report (ADR-0053/0055): the free-throw story
// as plain text, rendered from a free-throw payload. A future line-sentence
// in a verdict is authored from these numbers — hence 3-decimal precision
// (the guard bands sit inside what UI rounding hides) and the both-cuts
// columns printed side by side (a claim must hold on both).
//
// Presentation only (ADR-0011): every number comes off
// aggregateFreethrowMetrics or the payload _meta — nothing is recomputed
// here. The aggregation call is tooling-side; HeroPage will hold the single
// production call site when THE LINE act ships.

import { aggregateFreethrowMetrics } from '../domain/aggregateFreethrow'
import type { BothCutsMetric, TripClassRow, TierRollup } from '../domain/aggregateFreethrow'
import { SMALL_SAMPLE_MAKING_ATTEMPTS } from '../domain/constants'
import type { FreethrowPayload } from '../domain/freethrowPayload'
import { formatTripClass, withSmallSampleMark } from '../format'

const EM_DASH = '—'

/** 0.7833... -> "0.783" — authoring precision (see header comment). */
function format3(x: number | null): string {
  if (x === null) return EM_DASH
  return x.toFixed(3)
}

const LABEL_WIDTH = 24

function seasonMetricLine(label: string, metric: BothCutsMetric, mark = false): string {
  return [
    label.padEnd(LABEL_WIDTH),
    withSmallSampleMark(format3(metric.value), mark).padStart(9),
    format3(metric.withoutTechnicals).padStart(10),
    format3(metric.league).padStart(8),
  ].join('')
}

function tripHeader(): string {
  return [
    'class'.padEnd(LABEL_WIDTH),
    'trips'.padStart(6),
    'FTM/FTA'.padStart(9),
    'conv'.padStart(8),
    'pts/trip'.padStart(10),
    'lg trip'.padStart(9),
  ].join('')
}

function tripLine(label: string, row: TripClassRow): string {
  return [
    label.padEnd(LABEL_WIDTH),
    String(row.trips).padStart(6),
    `${row.ftm}/${row.fta}`.padStart(9),
    // The † rides the conversion claim — same constant, same meaning as
    // every other flag on the page (ADR-0031/0055); a null conversion makes
    // no claim, so it carries no flag.
    withSmallSampleMark(
      format3(row.conversion),
      row.smallSampleConversion && row.conversion !== null,
    ).padStart(8),
    format3(row.pointsPerTrip).padStart(10),
    format3(row.leagueExpectedPointsPerTrip).padStart(9),
  ].join('')
}

function tierLine(label: string, tier: TierRollup): string {
  return [
    label.padEnd(LABEL_WIDTH),
    String(tier.trips).padStart(6),
    `${tier.ftm}/${tier.fta}`.padStart(9),
    withSmallSampleMark(
      format3(tier.conversion),
      tier.smallSampleConversion && tier.conversion !== null,
    ).padStart(8),
  ].join('')
}

export function renderFreethrowReport(payload: FreethrowPayload): string {
  const meta = payload._meta
  const m = aggregateFreethrowMetrics(payload)
  const s = m.seasonLine
  const lines: string[] = []

  lines.push(
    `THE LINE (ADR-0053) — vs league average · endpoint-parity semantics: technicals included both sides (ADR-0055)`,
    `  league totals pulled ${meta.leagueTotalsPullDate} · schema v${meta.schemaVersion} · corpus ${meta.gamesLoaded}/${meta.gamesExpected} games`,
    `  season line: ${s.ftm}/${s.fta} FT · ${s.technicalFtm}/${s.technicalFta} technical · ` +
      `${s.seasonFga} FGA (pre-drop) · ${s.seasonPoints} PTS`,
  )

  lines.push(
    '',
    `  ${'metric'.padEnd(LABEL_WIDTH)}${'his'.padStart(9)}${'w/o tech'.padStart(10)}${'lg'.padStart(8)}`,
  )
  lines.push(`  ${seasonMetricLine('conversion (FT%)', s.conversion, s.smallSampleConversion)}`)
  lines.push(`  ${seasonMetricLine('FTA rate (FTA/FGA)', s.ftaRate)}`)
  lines.push(`  ${seasonMetricLine('FT share of points', s.ftPointsShare)}`)

  // The taxonomy is a partition of trips and renders whole — zero classes
  // stay visible (ADR-0031's discipline); its statements are
  // hero-descriptive, never league-comparative (ADR-0038/0055).
  lines.push(
    '',
    '  HOW THE TRIPS AROSE (trip taxonomy — hero-descriptive; lg trip = a league shooter\'s expected points on that trip)',
    `  ${tripHeader()}`,
  )
  const byTier = (tier: TripClassRow['tier']) => m.tripClasses.filter((row) => row.tier === tier)
  lines.push(`  ${tierLine('Attempt-equivalent', m.attemptEquivalent)}`)
  for (const row of byTier('attemptEquivalent')) {
    lines.push(`  ${tripLine(`  ${formatTripClass(row.tripClass)}`, row)}`)
  }
  lines.push(`  ${tierLine('Add-on', m.addOn)}`)
  for (const row of byTier('addOn')) {
    lines.push(`  ${tripLine(`  ${formatTripClass(row.tripClass)}`, row)}`)
  }

  lines.push(
    '',
    `  technical free throws: ${s.technicalFtm}/${s.technicalFta} — never trips, never evaluation (counted and reported)`,
    `  league FT% ${format3(m.leagueFreeThrowPct)} · a league shooter's 2-shot trip expects ` +
      `${format3(2 * m.leagueFreeThrowPct)} points, a 3-shot trip ${format3(3 * m.leagueFreeThrowPct)}`,
    `  † conversion on <${SMALL_SAMPLE_MAKING_ATTEMPTS} FTA — small-sample flag (flagged, never suppressed)`,
  )

  return lines.join('\n')
}
