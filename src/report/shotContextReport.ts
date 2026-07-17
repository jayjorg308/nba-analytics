import {
  aggregateShotContextMetrics,
  type AssistMetricsRow,
} from '../domain/aggregateShotContext'
import type { DerivedPayload } from '../domain/payload'
import type { ShotContextPayload } from '../domain/shotContextPayload'
import { formatPercent1 } from '../format'

function line(label: string, row: AssistMetricsRow): string {
  const bounds =
    row.minAssistedShare === null || row.maxAssistedShare === null
      ? '—'
      : `${formatPercent1(row.minAssistedShare)}–${formatPercent1(row.maxAssistedShare)}`
  return (
    `  ${label.padEnd(25)} ${String(row.makes).padStart(4)} FGM · ` +
    `${row.assistedMakes} ast · ${row.unassistedMakes} unast · ${row.unknownMakes} unknown · ` +
    `assisted share ${formatPercent1(row.assistedShare)} · ` +
    `coverage ${formatPercent1(row.coverage)} · bounds ${bounds}`
  )
}

export function renderShotContextReport(
  shots: DerivedPayload,
  context: ShotContextPayload,
): string {
  const metrics = aggregateShotContextMetrics(shots, context)
  const lines = [
    'ASSISTED MAKES — scorer-credit classification',
    line('All makes', metrics.all),
    '',
    'BY SHOOTING AREA',
    ...metrics.zones.slice(0, 3).map((row) => line(row.zone, row)),
    line('3 Pointers', metrics.threes),
    ...metrics.zones.slice(3).map((row) => line(`  ${row.zone.replace(/ 3$/, '')}`, row)),
    '',
    '  unknown makes are not classified; they remain in the conservative bounds',
    '  unassisted means no scorer assist was credited, not necessarily self-created',
  ]
  return lines.join('\n')
}
