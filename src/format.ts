// Presentation formatting — the ONLY place numbers are rounded (ADR-0007:
// the aggregation returns raw floats; presentation formats). Null means
// "no attempts to compute from" and always renders as an em dash.

const EM_DASH = '—'
const MINUS = '−' // typographic minus, not hyphen

/** 0.34775 -> "34.8%" */
export function formatPercent1(x: number | null): string {
  if (x === null) return EM_DASH
  return `${(x * 100).toFixed(1)}%`
}

/** 1.0986 -> "1.10" */
export function formatPps2(x: number | null): string {
  if (x === null) return EM_DASH
  return x.toFixed(2)
}

/**
 * A displayed delta between two displayed anchors (ADR-0023): computed from
 * the SAME fixed-decimal roundings the anchors render with — in integer
 * display units, so no float residue — never from the raw delta. Three
 * independently correct roundings need not agree (1.0664 − 1.0222 shows
 * 1.07 / 1.02 / +0.04 and fails the reader's subtraction); the numbers on
 * screen must subtract exactly. The cost, accepted: the gap can differ from
 * the raw delta by one display unit when the anchors round apart. Use this
 * whenever a delta renders beside both its anchors; a delta shown without
 * anchors still rounds from the raw value (e.g. formatSignedPp1).
 */
export function formatSignedGap(
  minuend: number | null,
  subtrahend: number | null,
  decimals: number,
): string {
  if (minuend === null || subtrahend === null) return EM_DASH
  const scale = 10 ** decimals
  const units =
    Math.round(Number(minuend.toFixed(decimals)) * scale) -
    Math.round(Number(subtrahend.toFixed(decimals)) * scale)
  return `${units < 0 ? MINUS : '+'}${(Math.abs(units) / scale).toFixed(decimals)}`
}

/** FG% delta as signed percentage points, 1 dp: -0.061 -> "−6.1" (unit in header) */
export function formatSignedPp1(x: number | null): string {
  if (x === null) return EM_DASH
  const abs = (Math.abs(x) * 100).toFixed(1)
  return `${x < 0 ? MINUS : '+'}${abs}`
}

/** Appends the small-sample marker (ADR-0008: flagged, never suppressed). */
export function withSmallSampleMark(s: string, flagged: boolean): string {
  return flagged ? `${s}†` : s
}

/**
 * ("UTA", true) -> "vs UTA"; ("PHX", false) -> "@ PHX". House style: "vs"
 * without a period, a space before the abbreviation. Opponent/home arrive
 * derived from the payload — this only formats them (ADR-0011).
 */
export function formatMatchup(opponent: string, home: boolean): string {
  return `${home ? 'vs' : '@'} ${opponent}`
}

// Product display labels for the NBA's creation-context literals: the data
// keeps the literals verbatim (ADR-0030); the page speaks the product's
// words. Unmapped literals pass through.
const CREATION_CONTEXT_LABEL: Record<string, string> = {
  'Catch and Shoot': 'Catch and shoot',
  'Pull Ups': 'Pull-ups',
  // The rim/short bucket, named as the counterpart of the jumper parent —
  // the NBA literal reads like a distance stat, not a tier.
  'Less than 10 ft': 'Inside 10 ft',
}

export function formatCreationContext(context: string): string {
  return CREATION_CONTEXT_LABEL[context] ?? context
}

/** The jumper parent's one label everywhere (table, chart, report): the
 * summed 10-ft-and-out rollup over catch-and-shoot / pull-ups / other. */
export const JUMPERS_LABEL = 'Jumpers (10 ft and out)'

/** ("Early", "24-15") -> "Early (24-15s)" — the product clock grain's label. */
export function formatClockBand(band: string, seconds: string): string {
  return `${band} (${seconds}s)`
}

/** (1, 19) -> "1:19"; (7, 5) -> "7:05" */
export function formatClock(minutes: number, seconds: number): string {
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** 1..4 -> "Q1".."Q4"; 5 -> "OT"; 6 -> "2OT"... */
export function formatPeriod(period: number): string {
  if (period <= 4) return `Q${period}`
  const ot = period - 4
  return ot === 1 ? 'OT' : `${ot}OT`
}

// Fixed English month lookup — no locale APIs, so tests are deterministic
// across machines.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2025-11-07" -> "Nov 7, 2025" */
export function formatGameDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`
}
