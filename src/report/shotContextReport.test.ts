import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseDerivedPayload } from '../domain/payload'
import { parseShotContextPayload } from '../domain/shotContextPayload'
import { renderShotContextReport } from './shotContextReport'

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../tests/fixtures/${name}`, import.meta.url), 'utf-8'))
const shots = parseDerivedPayload(fixture('derived.golden.json'))
const context = parseShotContextPayload(fixture('shot-context.golden.json'))

describe('renderShotContextReport', () => {
  it('prints coverage, classified share, bounds, and the zone hierarchy', () => {
    const report = renderShotContextReport(shots, context)
    expect(report).toContain('ASSISTED MAKES')
    expect(report).toContain('coverage 14.3%')
    expect(report).toContain('assisted share 100.0%')
    expect(report).toContain('bounds 14.3%–100.0%')
    expect(report).toContain('3 Pointers')
    expect(report).toContain('unknown makes are not classified')
  })
})
