// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { aggregateShotContextMetrics } from '../domain/aggregateShotContext'
import type { AssistMetricsRow, ShotContextMetrics } from '../domain/aggregateShotContext'
import { parseDerivedPayload } from '../domain/payload'
import { parseShotContextPayload } from '../domain/shotContextPayload'
import { AssistedMakes } from './AssistedMakes'

const read = (name: string) =>
  JSON.parse(readFileSync(path.resolve(process.cwd(), 'tests/fixtures', name), 'utf-8')) as unknown
const metrics = aggregateShotContextMetrics(
  parseDerivedPayload(read('derived.golden.json')),
  parseShotContextPayload(read('shot-context.golden.json')),
)

function withCompleteCoverage<T extends AssistMetricsRow>(row: T): T {
  const assistedShare = row.makes > 0 ? row.assistedMakes / row.makes : null
  return {
    ...row,
    unassistedMakes: row.unassistedMakes + row.unknownMakes,
    unknownMakes: 0,
    classifiedMakes: row.makes,
    assistedShare,
    coverage: row.makes > 0 ? 1 : null,
    minAssistedShare: assistedShare,
    maxAssistedShare: assistedShare,
  }
}

const completeMetrics: ShotContextMetrics = {
  ...metrics,
  all: withCompleteCoverage(metrics.all),
  threes: withCompleteCoverage(metrics.threes),
  zones: metrics.zones.map(withCompleteCoverage),
  midRangeBands: metrics.midRangeBands.map(withCompleteCoverage),
}

afterEach(cleanup)

describe('AssistedMakes', () => {
  it('omits empty bands and redundant coverage columns when every make is classified', () => {
    render(<AssistedMakes metrics={completeMetrics} showMidRangeBands />)
    screen.getByRole('img', { name: /assisted share by shooting area/i })
    const table = screen.getByRole('table', { name: /assisted makes by shooting area/i })
    expect([...table.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual([
      'Area',
      'FGM',
      'Ast',
      'Unast',
      'Ast share',
    ])
    expect(screen.queryByRole('rowheader', { name: 'Less Than 8 ft' })).toBeNull()
    expect(screen.getAllByText('3 Pointers')).toHaveLength(2)
    expect(table.querySelectorAll('.zone-row-child').length).toBeGreaterThanOrEqual(3)
    expect(document.querySelectorAll('.assist-plot-row')).toHaveLength(
      table.querySelectorAll('tbody tr').length,
    )
    expect(document.querySelectorAll('.assist-plot-denominator')).toHaveLength(
      table.querySelectorAll('tbody tr').length,
    )
    expect(screen.queryByText(/unknown makes/i)).toBeNull()
  })

  it('restores coverage diagnostics when any make is unclassified', () => {
    render(<AssistedMakes metrics={metrics} showMidRangeBands />)
    screen.getByRole('img', { name: /assisted-share bounds/i })
    const table = screen.getByRole('table', { name: /assisted makes by shooting area/i })
    expect([...table.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual([
      'Area',
      'FGM',
      'Ast',
      'Unast',
      'Unknown',
      'Ast share',
      'Coverage',
      'Bounds',
    ])
    screen.getByText(/unknown makes stay in the denominator/i)
  })
})
