// Zone taxonomy and evaluation thresholds (CONTEXT.md, ADR-0008).
// Mirrors the taxonomy constants in ingestion/derive_payload.py; the two are
// kept honest by the committed golden fixture (tests/fixtures/README.md).

export const BASIC_ZONES = [
  'Restricted Area',
  'In The Paint (Non-RA)',
  'Mid-Range',
  'Left Corner 3',
  'Right Corner 3',
  'Above the Break 3',
  'Backcourt',
] as const
export type BasicZone = (typeof BASIC_ZONES)[number]

// Backcourt is excluded from evaluation (heaves — nominal 3-zones with ~0 real
// value that would distort the diet weighting) but its count is always
// reported, never hidden (ADR-0008).
export const EVAL_ZONES = [
  'Restricted Area',
  'In The Paint (Non-RA)',
  'Mid-Range',
  'Left Corner 3',
  'Right Corner 3',
  'Above the Break 3',
] as const
export type EvalZone = (typeof EVAL_ZONES)[number]

export const ZONE_AREAS = [
  'Left Side(L)',
  'Left Side Center(LC)',
  'Center(C)',
  'Right Side Center(RC)',
  'Right Side(R)',
  'Back Court(BC)',
] as const
export type ZoneArea = (typeof ZONE_AREAS)[number]

// Normalized (period-free) range literals — the derive step strips the NBA's
// trailing period ('16-24 ft.'), so the dotted form is a contract violation
// here (ADR-0008 record correction).
export const ZONE_RANGES = [
  'Less Than 8 ft',
  '8-16 ft',
  '16-24 ft',
  '24+ ft',
  'Back Court Shot',
] as const
export type ZoneRange = (typeof ZONE_RANGES)[number]

export const MID_RANGE_BANDS = ['Less Than 8 ft', '8-16 ft', '16-24 ft'] as const
export type MidRangeBand = (typeof MID_RANGE_BANDS)[number]

// The long-two band — the lowest-value shot on the floor; the reason the
// mid-range split exists (selection transparency, ADR-0008).
export const LONG_TWO_BAND: MidRangeBand = '16-24 ft'

// PPS = zone FG% x point value (ADR-0001).
export const ZONE_POINT_VALUE: Record<BasicZone, 2 | 3> = {
  'Restricted Area': 2,
  'In The Paint (Non-RA)': 2,
  'Mid-Range': 2,
  'Left Corner 3': 3,
  'Right Corner 3': 3,
  'Above the Break 3': 3,
  Backcourt: 3,
}

// Gate-2-derived inclusion bar: a zone is included in the mix view at >= 15
// attempts (ADR-0008, set from the launch hero's real counts).
export const ZONE_INCLUSION_MIN_ATTEMPTS = 15

// TUNABLE. Below this many attempts the making delta carries a small-sample
// uncertainty flag — it is never suppressed (no second hard cutoff, ADR-0008).
// Rationale: ADR-0008 requires per-corner making at L49/R34 to carry the flag,
// so the bar must exceed 49; and at n=50, p~=0.40 the FG% standard error is
// ~ +/-6.9pp (95% CI ~ +/-13.6pp) — wider than almost any true making delta.
// Flags the making axis only; selection (attempt shares) is stable well below
// this and is never flagged by it.
export const SMALL_SAMPLE_MAKING_ATTEMPTS = 50
