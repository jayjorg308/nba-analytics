// CLAIM HEADROOM (ADR-0059): the authoring aid for verdicts on data that
// moves — every verdict-grade gap, printed with its distance from the house
// threshold vocabulary, so claims get written with deliberate margin. An
// authoring input only, never a guard input: each hero's guard still declares
// its own thresholds with its own rationale (ADR-0017).
//
// Reuses the production aggregations (ADR-0009 — never a second
// implementation); consumes whatever sibling payloads the report resolved.

import { aggregateShotMetrics, type ShotMetrics } from '../domain/aggregate'
import {
  aggregateCreationMetrics,
  type CreationMetrics,
} from '../domain/aggregateCreation'
import {
  aggregateFreethrowMetrics,
  type FreethrowMetrics,
} from '../domain/aggregateFreethrow'
import type { GrowthMetrics } from '../domain/aggregateGrowth'
import type { CreationPayload } from '../domain/creationPayload'
import { LONG_TWO_BAND } from '../domain/constants'
import type { FreethrowPayload } from '../domain/freethrowPayload'
import type { DerivedPayload } from '../domain/payload'

// The house threshold vocabulary — the recurring guard bars (each guard
// still declares its own, with rationale; these label the report columns).
const NEUTRAL_PPS = 0.02
const MATERIAL_PPS = 0.05
const STRONG_PPS = 0.1

const sign = (v: number, dp = 3) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(dp)}`

function ppsBandNote(gap: number): string {
  const a = Math.abs(gap)
  if (a < NEUTRAL_PPS) return 'inside the neutral band'
  if (a < MATERIAL_PPS) return 'past neutral, short of material'
  if (a < STRONG_PPS) return 'material'
  return 'strong'
}

function line(label: string, gap: number, extra = ''): string {
  return `  ${label.padEnd(42)}${sign(gap).padStart(8)}  ${ppsBandNote(gap)}${extra}`
}

export function renderClaimHeadroom(
  shot: DerivedPayload,
  creation: CreationPayload | null,
  freethrow: FreethrowPayload | null,
  /** The growth aggregation over a prior argued season (ADR-0061), when the
   * report resolved one — growth-sentences are authored with headroom too. */
  growth: GrowthMetrics | null = null,
): string {
  const m: ShotMetrics = aggregateShotMetrics(shot.shots, shot.zoneBaseline)
  const lines: string[] = []
  lines.push(
    'CLAIM HEADROOM (ADR-0059) — verdict-grade gaps vs the house bars ' +
      `(neutral ±${NEUTRAL_PPS} · material ${MATERIAL_PPS} · strong ${STRONG_PPS} PPS); ` +
      'a live claim should clear its bar with margin',
  )

  lines.push('', '  TWO-AXIS (PPS)')
  if (m.selection.selectionDelta !== null) {
    lines.push(line('selection Δ', m.selection.selectionDelta))
  }
  if (m.making.makingPpsDelta !== null) {
    lines.push(line('making Δ', m.making.makingPpsDelta))
  }

  lines.push('', '  DIET SHARE RATIOS (his share ÷ lg share — the double/triple claims)')
  for (const z of m.zones) {
    if (z.attemptShare === null || z.leagueAttemptShare <= 0) continue
    const ratio = z.attemptShare / z.leagueAttemptShare
    lines.push(`  ${z.zone.padEnd(42)}${ratio.toFixed(2).padStart(8)}x`)
  }
  const longTwo = m.midRangeSplit.bands.find((b) => b.band === LONG_TWO_BAND)
  if (m.midRangeSplit.visible && longTwo?.attemptShare != null) {
    const ratio = longTwo.attemptShare / longTwo.leagueAttemptShare
    lines.push(`  ${'16-24 ft (long two)'.padEnd(42)}${ratio.toFixed(2).padStart(8)}x`)
  }

  if (creation) {
    const c: CreationMetrics = aggregateCreationMetrics(creation)
    lines.push('', '  CREATION PPS vs LG († = under the sample bar; do not state unhedged)')
    const rows: [string, CreationMetrics['general']['jumpers']][] = [
      ['Inside 10 ft', c.general.inside],
      ['Jumpers (10 ft and out)', c.general.jumpers],
      ...c.general.jumperContexts.map(
        (r): [string, CreationMetrics['general']['jumpers']] => [`  ${r.context}`, r],
      ),
      ...c.shotClock.map(
        (r): [string, CreationMetrics['general']['jumpers']] => [`${r.band} (clock)`, r],
      ),
      ...c.closestDefender.map(
        (r): [string, CreationMetrics['general']['jumpers']] => [`${r.band} (defender)`, r],
      ),
    ]
    for (const [label, row] of rows) {
      if (row.pps === null || row.leaguePps === null) continue
      lines.push(line(label, row.pps - row.leaguePps, row.smallSamplePps ? ' †' : ''))
    }
  }

  if (freethrow) {
    const f: FreethrowMetrics = aggregateFreethrowMetrics(freethrow)
    lines.push(
      '',
      '  FREE THROW vs LG — both technical cuts (a claim must hold on BOTH; ADR-0055)',
    )
    const metrics: [string, { value: number | null; withoutTechnicals: number | null; league: number }][] = [
      ['conversion (FT%)', f.seasonLine.conversion],
      ['FTA rate', f.seasonLine.ftaRate],
      ['FT points share', f.seasonLine.ftPointsShare],
    ]
    for (const [label, cut] of metrics) {
      if (cut.value === null || cut.withoutTechnicals === null) continue
      const ratio = (v: number) => (cut.league > 0 ? `${(v / cut.league).toFixed(2)}x lg` : '')
      lines.push(
        `  ${label.padEnd(42)}${sign(cut.value - cut.league).padStart(8)} / ` +
          `${sign(cut.withoutTechnicals - cut.league)}  (${ratio(cut.value)} / ` +
          `${ratio(cut.withoutTechnicals)})`,
      )
    }
    if (f.seasonLine.smallSampleConversion) {
      lines.push('  † season conversion is under the sample bar — flag any conversion claim')
    }
  }

  if (growth) {
    lines.push(
      '',
      `  GROWTH MOVEMENT (ADR-0061) — ${growth.priorSeason} → ${growth.currentSeason}; ` +
        'spine movement vs the PPS bars, diet-gap movement in share points',
    )
    const spine: [string, number | null, number | null][] = [
      ['selection Δ movement', growth.spine.prior.selectionDelta, growth.spine.current.selectionDelta],
      ['making Δ movement', growth.spine.prior.makingPpsDelta, growth.spine.current.makingPpsDelta],
    ]
    for (const [label, prior, current] of spine) {
      if (prior === null || current === null) continue
      lines.push(line(label, current - prior))
    }
    for (const z of growth.zones) {
      if (z.prior.dietGap === null || z.current.dietGap === null) continue
      const moved = (z.current.dietGap - z.prior.dietGap) * 100
      lines.push(
        `  ${`${z.zone} diet gap`.padEnd(42)}${`${sign(moved, 1)} pp`.padStart(11)}`,
      )
    }
  }

  return lines.join('\n')
}
