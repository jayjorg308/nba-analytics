// The one call-decision rule for every comparison surface (ADR-0078's
// grammar, reused by THE LINE — ADR-0079), in its own module so component
// files keep component-only exports. A call decides and prices on the gap
// of its two DISPLAYED anchors (ADR-0023), so a chip and the numbers
// beneath it always subtract; it inherits † whenever either side carries
// the corresponding flag (ADR-0075).

import { displayGapUnits, formatUnsignedUnits } from '../format'

/** Margins under 1.0 display units read as even: a call is a claim, and a
 * sub-point gap between two displayed numbers is not evidence of one. */
const EVEN_UNDER_UNITS = 10

export type ComparisonCall =
  | { kind: 'none' }
  | { kind: 'even'; flagged: boolean }
  | { kind: 'call'; side: 'left' | 'right'; margin: string; flagged: boolean }

/** Anchors arrive rescaled to their display units (percentage points for
 * shares and percentages), decided at 1 dp — the grain every comparison
 * margin renders at. */
export function comparisonCall(
  left: number | null,
  right: number | null,
  flagged: boolean,
): ComparisonCall {
  const units = displayGapUnits(right, left, 1)
  if (units === null) return { kind: 'none' }
  if (Math.abs(units) < EVEN_UNDER_UNITS) return { kind: 'even', flagged }
  return {
    kind: 'call',
    side: units > 0 ? 'right' : 'left',
    margin: formatUnsignedUnits(units, 1),
    flagged,
  }
}
