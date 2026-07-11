// The committed color guard for the Zones view scale: parses the ACTUAL CSS
// (src/App.css for --making-*, src/index.css for --text-h and surfaces) so
// there is no hex duplication to drift, and asserts:
//   1. every fill has >= 4.5:1 WCAG contrast against that mode's label ink
//   2. per-arm luminance is strictly monotone (fills recede toward the
//      surface at the neutral end: decreasing outward in light mode,
//      increasing outward in dark mode)
//   3. the neutral midpoint is chromatically gray (a hue at the diverging
//      midpoint would read as data)

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const appCss = readFileSync(path.resolve(process.cwd(), 'src/App.css'), 'utf-8')
const indexCss = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf-8')

/** Split a css file into (light = before the dark media query, dark = inside it). */
function modeBlocks(css: string): { light: string; dark: string } {
  const darkStart = css.indexOf('@media (prefers-color-scheme: dark)')
  if (darkStart === -1) return { light: css, dark: '' }
  // the dark block ends at the media query's closing brace; a coarse split on
  // the next top-level section is fine for variable extraction
  return { light: css.slice(0, darkStart), dark: css.slice(darkStart) }
}

function cssVar(block: string, name: string): string {
  const m = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!m) throw new Error(`variable ${name} with a hex value not found in block`)
  return m[1]!.toLowerCase()
}

// --- minimal WCAG relative luminance / contrast (local on purpose: the
// dataviz skill's validator lives at a machine-specific temp path and must
// not be imported by a committed test) --------------------------------------

function channel(v: number): number {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function rgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

// --- the fills under test ----------------------------------------------------

const FILL_VARS = [
  '--making-cold-3',
  '--making-cold-2',
  '--making-cold-1',
  '--making-neutral',
  '--making-warm-1',
  '--making-warm-2',
  '--making-warm-3',
]

const app = modeBlocks(appCss)
const index = modeBlocks(indexCss)

const modes = [
  { name: 'light', fills: app.light, ink: cssVar(index.light, '--text-h') },
  { name: 'dark', fills: app.dark, ink: cssVar(index.dark, '--text-h') },
] as const

describe.each(modes)('making scale in $name mode', ({ fills, ink }) => {
  const hex = Object.fromEntries(FILL_VARS.map((v) => [v, cssVar(fills, v)]))

  it('gives every fill >= 4.5:1 label contrast against the mode ink', () => {
    for (const v of FILL_VARS) {
      expect(contrast(hex[v]!, ink), `${v} (${hex[v]}) vs ink ${ink}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps each arm strictly monotone in luminance, receding toward neutral', () => {
    const cold = ['--making-cold-1', '--making-cold-2', '--making-cold-3'].map(
      (v) => luminance(hex[v]!),
    )
    const warm = ['--making-warm-1', '--making-warm-2', '--making-warm-3'].map(
      (v) => luminance(hex[v]!),
    )
    for (const arm of [cold, warm]) {
      for (let i = 1; i < arm.length; i++) {
        // light mode: darker outward (decreasing); dark mode: lighter outward
        if (ink === cssVar(index.light, '--text-h')) {
          expect(arm[i]!, `step ${i}`).toBeLessThan(arm[i - 1]!)
        } else {
          expect(arm[i]!, `step ${i}`).toBeGreaterThan(arm[i - 1]!)
        }
      }
    }
  })

  it('keeps the neutral midpoint chromatically gray', () => {
    const [r, g, b] = rgb(hex['--making-neutral']!)
    // tolerance 16 admits the app dark surface's slight cool tint
    // (#16171d itself is blue-leaning) while rejecting any real hue
    expect(Math.abs(r - g)).toBeLessThanOrEqual(16)
    expect(Math.abs(g - b)).toBeLessThanOrEqual(16)
  })
})
