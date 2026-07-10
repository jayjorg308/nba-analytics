import { describe, expect, it } from 'vitest'
import { MAKING_LEGEND, makingBinClass, makingDeltaBin } from './makingScale'

describe('makingDeltaBin', () => {
  it('maps null (zero-attempt zone) to null, never neutral', () => {
    expect(makingDeltaBin(null)).toBeNull()
  })

  it('anchors the neutral bin at league average, edges inclusive', () => {
    expect(makingDeltaBin(0)).toBe(0)
    expect(makingDeltaBin(0.025)).toBe(0)
    expect(makingDeltaBin(-0.025)).toBe(0)
    expect(makingDeltaBin(0.0251)).toBe(1)
    expect(makingDeltaBin(-0.0251)).toBe(-1)
  })

  it('makes inner arm edges inclusive and the outer bin open-ended', () => {
    expect(makingDeltaBin(0.1)).toBe(1)
    expect(makingDeltaBin(0.1001)).toBe(2)
    expect(makingDeltaBin(-0.175)).toBe(-2)
    expect(makingDeltaBin(-0.1751)).toBe(-3)
    expect(makingDeltaBin(-0.3)).toBe(-3) // no clamp needed — outer bin absorbs
    expect(makingDeltaBin(0.5)).toBe(3)
  })

  it('is symmetric around zero', () => {
    for (const d of [0.01, 0.025, 0.05, 0.1, 0.15, 0.175, 0.2, 0.4]) {
      const mirrored = -(makingDeltaBin(d) as number) || 0 // normalize JS -0
      expect(makingDeltaBin(-d)).toBe(mirrored)
    }
  })

  it('bins the launch-hero zone deltas as expected', () => {
    expect(makingDeltaBin(-0.225)).toBe(-3) // Above the Break 3
    expect(makingDeltaBin(-0.183)).toBe(-3) // Left Corner 3
    expect(makingDeltaBin(-0.033)).toBe(-1) // Right Corner 3
    expect(makingDeltaBin(0.007)).toBe(0) // Restricted Area — neutral
    expect(makingDeltaBin(0.004)).toBe(0) // In The Paint (Non-RA) — neutral
    expect(makingDeltaBin(0.028)).toBe(1) // Mid-Range
  })
})

describe('makingBinClass', () => {
  it('maps bins to fill classes', () => {
    expect(makingBinClass(0)).toBe('zone-fill-neutral')
    expect(makingBinClass(-3)).toBe('zone-fill-cold-3')
    expect(makingBinClass(3)).toBe('zone-fill-warm-3')
    expect(makingBinClass(null)).toBe('zone-fill-nodata')
  })
})

describe('MAKING_LEGEND', () => {
  it('has seven entries in cold-to-warm order', () => {
    expect(MAKING_LEGEND).toHaveLength(7)
    expect(MAKING_LEGEND.map((e) => e.bin)).toEqual([-3, -2, -1, 0, 1, 2, 3])
  })
})
