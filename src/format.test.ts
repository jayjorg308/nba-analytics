import { describe, expect, it } from 'vitest'
import {
  formatClock,
  formatGameDate,
  formatPercent1,
  formatPeriod,
  formatPps2,
  formatSignedPp1,
  formatSignedPps2,
  withSmallSampleMark,
} from './format'

describe('format', () => {
  it('formats percentages to 1 dp', () => {
    expect(formatPercent1(0.34775)).toBe('34.8%')
    expect(formatPercent1(0.675)).toBe('67.5%')
    expect(formatPercent1(0)).toBe('0.0%')
    expect(formatPercent1(null)).toBe('—')
  })

  it('formats PPS to 2 dp', () => {
    expect(formatPps2(1.0986346)).toBe('1.10')
    expect(formatPps2(0.8335073)).toBe('0.83')
    expect(formatPps2(null)).toBe('—')
  })

  it('always signs PPS deltas, with a typographic minus', () => {
    expect(formatSignedPps2(0.0074)).toBe('+0.01')
    expect(formatSignedPps2(-0.02)).toBe('−0.02')
    expect(formatSignedPps2(0)).toBe('+0.00')
    expect(formatSignedPps2(null)).toBe('—')
  })

  it('formats making deltas as signed percentage points', () => {
    expect(formatSignedPp1(-0.061)).toBe('−6.1')
    expect(formatSignedPp1(0.15)).toBe('+15.0')
    expect(formatSignedPp1(null)).toBe('—')
  })

  it('appends the dagger only when flagged', () => {
    expect(withSmallSampleMark('−6.1', true)).toBe('−6.1†')
    expect(withSmallSampleMark('−6.1', false)).toBe('−6.1')
  })

  it('formats the game clock with zero-padded seconds', () => {
    expect(formatClock(1, 19)).toBe('1:19')
    expect(formatClock(7, 5)).toBe('7:05')
    expect(formatClock(0, 0)).toBe('0:00')
    expect(formatClock(11, 59)).toBe('11:59')
  })

  it('formats periods including overtimes', () => {
    expect(formatPeriod(1)).toBe('Q1')
    expect(formatPeriod(4)).toBe('Q4')
    expect(formatPeriod(5)).toBe('OT')
    expect(formatPeriod(6)).toBe('2OT')
  })

  it('formats game dates without locale APIs', () => {
    expect(formatGameDate('2025-11-07')).toBe('Nov 7, 2025')
    expect(formatGameDate('2026-01-01')).toBe('Jan 1, 2026')
    expect(formatGameDate('2025-12-23')).toBe('Dec 23, 2025')
  })
})
