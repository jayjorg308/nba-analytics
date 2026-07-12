import { describe, expect, it } from 'vitest'
import {
  formatClock,
  formatGameDate,
  formatPercent1,
  formatPeriod,
  formatPps2,
  formatSignedGap,
  formatSignedPp1,
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

  it('displayed gaps subtract the anchors AS DISPLAYED, not the raw delta (ADR-0023)', () => {
    // George's making block: the raw delta (+0.0442) rounds to +0.04, but
    // the anchors display as 1.07 and 1.02 — the gap must say +0.05.
    expect(formatSignedGap(1.0664, 1.0222, 2)).toBe('+0.05')
    // Cody's: anchors 0.99 and 1.10 — the gap −0.11 matches the raw delta.
    expect(formatSignedGap(0.9902, 1.0986, 2)).toBe('−0.11')
    expect(formatSignedGap(1.0912, 1.0912, 2)).toBe('+0.00') // never −0.00
    expect(formatSignedGap(1.0222, 1.0912, 3)).toBe('−0.069') // report ladder, 3dp
    expect(formatSignedGap(71.9, 67.1, 1)).toBe('+4.8') // report Δ pp, 1dp
    expect(formatSignedGap(null, 1, 2)).toBe('—')
    expect(formatSignedGap(1, null, 2)).toBe('—')
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
