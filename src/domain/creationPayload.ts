// The creation-payload contract and its load boundary (ADR-0030).
//
// The parallel typed contract to payload.ts: Python (ingestion/
// derive_creation.py) persists per-family creation contexts — player and
// rolled-up league baseline side by side — and this schema validates it at
// the boundary. Deliberately a SEPARATE contract with its own version
// counter and its own golden (tests/fixtures/creation.golden.json): the two
// payloads evolve on different clocks, and a creation change must never
// churn the locked shot contract. Metric-free per ADR-0007's rule — creation
// PPS and diet shares are computed by the (separate, pure)
// aggregateCreationMetrics, never persisted.

import { z } from 'zod'

// Must match SCHEMA_VERSION in ingestion/derive_creation.py; bump both on any
// breaking payload change. v1: General + Shot Clock families (ADR-0030).
// v2: Closest Defender family (the ADR-0030 fast-follow, ROADMAP v2.1).
export const CREATION_SCHEMA_VERSION = 2

// NBA row literals, verbatim (the spike catalogued them — ADR-0030 closures).
// The payload always carries every context of a shipped family exactly once:
// the dashboards emit SPARSE rows (a zero-attempt context is an absent row),
// and the derive fills the zeros so a partition is never silently punctured.
export const GENERAL_CONTEXTS = [
  'Catch and Shoot',
  'Pull Ups',
  'Less than 10 ft',
  'Other',
] as const

// The NBA's six-band grain, persisted verbatim; the three-band product grain
// (Early 24-15 / Average 15-7 / Late 7-0) is an aggregation rollup, never a
// payload shape (the ADR-0016 combined-threes pattern).
export const SHOT_CLOCK_BANDS = [
  '24-22',
  '22-18 Very Early',
  '18-15 Early',
  '15-7 Average',
  '7-4 Late',
  '4-0 Very Late',
] as const

// The NBA's four defender distances, persisted verbatim (v2); the product
// grain (Tight 0-4 / Open 4-6 / Wide open 6+) is likewise an aggregation
// rollup — chosen so every band clears the small-sample bar for the current
// heroes ('Very Tight' alone sits just under it at 44/48 attempts).
export const DEFENDER_RANGES = [
  '0-2 Feet - Very Tight',
  '2-4 Feet - Tight',
  '4-6 Feet - Open',
  '6+ Feet - Wide Open',
] as const

export type GeneralContext = (typeof GENERAL_CONTEXTS)[number]
export type ShotClockBand = (typeof SHOT_CLOCK_BANDS)[number]
export type DefenderRange = (typeof DEFENDER_RANGES)[number]

const count = z.number().int().min(0)

// Counts only — no rates, frequencies, or PPS (ADR-0004/0007). The 2PT/3PT
// split is what makes true creation PPS computable downstream (ADR-0001:
// PPS, never eFG%).
function contextEntrySchema<const T extends readonly [string, ...string[]]>(contexts: T) {
  return z
    .strictObject({
      context: z.enum(contexts),
      fga: count,
      fgm: count,
      fg2a: count,
      fg2m: count,
      fg3a: count,
      fg3m: count,
    })
    .refine((e) => e.fgm <= e.fga, { message: 'fgm exceeds fga' })
    .refine((e) => e.fg2m <= e.fg2a, { message: 'fg2m exceeds fg2a' })
    .refine((e) => e.fg3m <= e.fg3a, { message: 'fg3m exceeds fg3a' })
    .refine((e) => e.fga === e.fg2a + e.fg3a, { message: 'fga != fg2a + fg3a' })
    .refine((e) => e.fgm === e.fg2m + e.fg3m, { message: 'fgm != fg2m + fg3m' })
}

const generalEntrySchema = contextEntrySchema(GENERAL_CONTEXTS)
const shotClockEntrySchema = contextEntrySchema(SHOT_CLOCK_BANDS)
const defenderEntrySchema = contextEntrySchema(DEFENDER_RANGES)

// One family: the player's contexts and the league baseline side by side —
// the baseline rides inside the payload exactly as zoneBaseline does in the
// shot payload (ADR-0030; it is NOT a free passenger of the player pull).
const familySchema = <S extends z.ZodType>(entry: S) =>
  z.strictObject({ player: z.array(entry), league: z.array(entry) })

export const creationPayloadSchema = z
  .strictObject({
    _meta: z.strictObject({
      schemaVersion: z.literal(CREATION_SCHEMA_VERSION),
      player: z.string().min(1),
      playerId: z.number().int(),
      season: z.string().regex(/^\d{4}-\d{2}$/),
      seasonType: z.string().min(1),
      pullDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      sourceSnapshot: z.string().min(1),
      leagueSourceSnapshot: z.string().min(1),
      /** The shot payload's pre-drop season FGA (totalShots +
       * zoneConflictsDropped) that the derive reconciled against — the
       * General family sums to exactly this (ADR-0030 hard identity). */
      seasonFga: count,
      /** Attempts the Shot Clock family does not cover (tracking gaps) —
       * counted and reported in the UI whenever nonzero, never guessed
       * into a band (ADR-0019 pattern; zero in launch data). */
      shotClockUnattributed: count,
      /** Same coverage counter for the Closest Defender family (v2). */
      defenderUnattributed: count,
      /** League Overall FGA — the league-side diet denominator. */
      leagueFga: count,
      leagueShotClockUnattributed: count,
      leagueDefenderUnattributed: count,
    }),
    general: familySchema(generalEntrySchema),
    shotClock: familySchema(shotClockEntrySchema),
    closestDefender: familySchema(defenderEntrySchema),
  })
  .superRefine((p, ctx) => {
    // Every context of a shipped family, exactly once, on both sides — a
    // family is a partition display (ADR-0031); a missing or doubled context
    // corrupts every share computed from it.
    const sides: [string, readonly string[], { context: string }[]][] = [
      ['general.player', GENERAL_CONTEXTS, p.general.player],
      ['general.league', GENERAL_CONTEXTS, p.general.league],
      ['shotClock.player', SHOT_CLOCK_BANDS, p.shotClock.player],
      ['shotClock.league', SHOT_CLOCK_BANDS, p.shotClock.league],
      ['closestDefender.player', DEFENDER_RANGES, p.closestDefender.player],
      ['closestDefender.league', DEFENDER_RANGES, p.closestDefender.league],
    ]
    for (const [label, contexts, entries] of sides) {
      for (const context of contexts) {
        const n = entries.filter((e) => e.context === context).length
        if (n !== 1) {
          ctx.addIssue({
            code: 'custom',
            message: `${label} must contain '${context}' exactly once, got ${n}`,
          })
        }
      }
    }
    // The partition identities, as persisted (the cross-payload half — that
    // seasonFga really equals the sibling shot payload's pre-drop total —
    // lives in the reconciliation guards, which can see both files).
    const sum = (entries: { fga: number }[]) => entries.reduce((t, e) => t + e.fga, 0)
    const identities: [string, number, number][] = [
      ['general.player', sum(p.general.player), p._meta.seasonFga],
      [
        'shotClock.player',
        sum(p.shotClock.player),
        p._meta.seasonFga - p._meta.shotClockUnattributed,
      ],
      [
        'closestDefender.player',
        sum(p.closestDefender.player),
        p._meta.seasonFga - p._meta.defenderUnattributed,
      ],
      ['general.league', sum(p.general.league), p._meta.leagueFga],
      [
        'shotClock.league',
        sum(p.shotClock.league),
        p._meta.leagueFga - p._meta.leagueShotClockUnattributed,
      ],
      [
        'closestDefender.league',
        sum(p.closestDefender.league),
        p._meta.leagueFga - p._meta.leagueDefenderUnattributed,
      ],
    ]
    for (const [label, actual, expected] of identities) {
      if (actual !== expected) {
        ctx.addIssue({
          code: 'custom',
          message: `${label} FGA sums to ${actual}, expected ${expected}`,
        })
      }
    }
  })

export type CreationContextEntry = z.infer<typeof generalEntrySchema>
export type CreationPayload = z.infer<typeof creationPayloadSchema>

/**
 * The creation load boundary (ADR-0030): every creation payload the app
 * consumes passes through here. Nothing else touches its raw JSON.
 */
export function parseCreationPayload(json: unknown): CreationPayload {
  return creationPayloadSchema.parse(json)
}
