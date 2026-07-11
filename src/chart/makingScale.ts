// Binned diverging scale for the Zones view: making delta -> fill bin.
//
// This is a PRESENTATION MAPPING over an existing aggregation output
// (ShotMetrics.zones[].makingDelta) — the case ADR-0011 explicitly blesses;
// no quantity is computed here and no rounding happens here (bins compare
// raw floats; display rounding stays in src/format.ts). Accepted edge: a
// delta of −2.54pp displays as "−2.5" but bins cold-1 — display rounding
// and binning both consume the raw float independently.
//
// Scale shape (dataviz method): diverging = two hues + a NEUTRAL GRAY
// midpoint anchored at 0 = league average, symmetric arms, outer bins
// open-ended. Warm = above league, cool = below (basketball hot/cold).

/** |delta| arm edges in fractional FG% (percentage points / 100). */
export const MAKING_BIN_EDGES_PP = [0.025, 0.1, 0.175] as const

/** Negative = cold arm (below league), 0 = neutral, positive = warm arm. */
export type MakingBin = -3 | -2 | -1 | 0 | 1 | 2 | 3

/**
 * null delta (zero-attempt zone) stays null: absence of data is rendered as
 * absence of paint, semantically distinct from neutral gray ("at league
 * average").
 */
export function makingDeltaBin(delta: number | null): MakingBin | null {
  if (delta === null) return null
  const magnitude = Math.abs(delta)
  const arm =
    magnitude <= MAKING_BIN_EDGES_PP[0]
      ? 0
      : magnitude <= MAKING_BIN_EDGES_PP[1]
        ? 1
        : magnitude <= MAKING_BIN_EDGES_PP[2]
          ? 2
          : 3
  if (arm === 0) return 0 // avoid JS -0 (a negative delta in the neutral band)
  return (delta < 0 ? -arm : arm) as MakingBin
}

const BIN_CLASS: Record<MakingBin, string> = {
  [-3]: 'zone-fill-cold-3',
  [-2]: 'zone-fill-cold-2',
  [-1]: 'zone-fill-cold-1',
  0: 'zone-fill-neutral',
  1: 'zone-fill-warm-1',
  2: 'zone-fill-warm-2',
  3: 'zone-fill-warm-3',
}

export function makingBinClass(bin: MakingBin | null): string {
  return bin === null ? 'zone-fill-nodata' : BIN_CLASS[bin]
}

/** CSS custom-property name for a bin's fill — for HTML swatches (the svg
 * fills go through makingBinClass). */
export function makingBinVar(bin: MakingBin): string {
  const arm = bin === 0 ? 'neutral' : bin < 0 ? `cold-${-bin}` : `warm-${bin}`
  return `--making-${arm}`
}

/** Legend entries, cold -> warm. Labels are edge annotations in pp. */
export const MAKING_LEGEND: { bin: MakingBin; label: string }[] = [
  { bin: -3, label: '< −17.5' },
  { bin: -2, label: '−17.5 to −10' },
  { bin: -1, label: '−10 to −2.5' },
  { bin: 0, label: '−2.5 to +2.5' },
  { bin: 1, label: '+2.5 to +10' },
  { bin: 2, label: '+10 to +17.5' },
  { bin: 3, label: '> +17.5' },
]
