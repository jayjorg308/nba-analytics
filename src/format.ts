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

/** 0.0074 -> "+0.01"; -0.02 -> "−0.02" (sign always shown) */
export function formatSignedPps2(x: number | null): string {
  if (x === null) return EM_DASH
  const abs = Math.abs(x).toFixed(2)
  return `${x < 0 ? MINUS : '+'}${abs}`
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
