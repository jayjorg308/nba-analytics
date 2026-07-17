// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { aggregateShotContextMetrics } from '../domain/aggregateShotContext'
import { parseDerivedPayload } from '../domain/payload'
import { parseShotContextPayload } from '../domain/shotContextPayload'
import { AssistedMakes } from './AssistedMakes'

const read = (name: string) =>
  JSON.parse(readFileSync(path.resolve(process.cwd(), 'tests/fixtures', name), 'utf-8')) as unknown
const metrics = aggregateShotContextMetrics(
  parseDerivedPayload(read('derived.golden.json')),
  parseShotContextPayload(read('shot-context.golden.json')),
)

afterEach(cleanup)

describe('AssistedMakes', () => {
  it('renders the bounded-share plot and an accessible zone-hierarchy table', () => {
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
    expect(screen.getAllByText('3 Pointers')).toHaveLength(2)
    expect(table.querySelectorAll('.zone-row-child').length).toBeGreaterThanOrEqual(3)
    expect(document.querySelectorAll('.assist-plot-row')).toHaveLength(
      table.querySelectorAll('tbody tr').length,
    )
    expect(document.querySelectorAll('.assist-plot-denominator')).toHaveLength(
      table.querySelectorAll('tbody tr').length,
    )
    screen.getByText(/unknown makes stay in the denominator/i)
  })
})
