// The derived-payload contract and its load boundary (ADR-0007).
//
// Python (ingestion/derive_payload.py) persists { enriched per-shot rows +
// rolled-up zone baseline }; this schema validates it at the boundary. The
// payload deliberately contains NO headline metrics — those are computed by
// aggregateShotMetrics. Schemas are strict: an unknown key is a contract
// violation, which is what makes the cross-language golden handshake bite
// (tests/fixtures/README.md).

import { z } from 'zod'
import {
  BASIC_ZONES,
  EVAL_ZONES,
  MID_RANGE_BANDS,
  ZONE_AREAS,
  ZONE_POINT_VALUE,
  ZONE_RANGES,
} from './constants'

// Must match SCHEMA_VERSION in ingestion/derive_payload.py; bump both on any
// breaking payload change. v2: _meta.zoneConflictsDropped (ADR-0019).
// v3: per-shot opponent/home (matchup context, derived in Python — ADR-0028).
// v4: _meta.dataThrough/gamesIncluded — the reconciled frontier as contract
//     metadata (ADR-0058; v3 Phase 2). This payload computes them from its
//     own rows (verified below); the three siblings copy them, and four-way
//     equality is guarded at derive and at the deployed-pair tests.
export const SCHEMA_VERSION = 4

const isoDate = /^\d{4}-\d{2}-\d{2}$/

const enrichedShotSchema = z
  .strictObject({
    gameId: z.string().min(1),
    gameEventId: z.number().int(),
    gameDate: z.string().regex(isoDate),
    opponent: z.string().regex(/^[A-Z]{2,3}$/), // team abbreviation (e.g. PHX)
    home: z.boolean(),
    period: z.number().int().min(1), // >4 legal (overtime)
    minutesRemaining: z.number().int().min(0).max(11),
    secondsRemaining: z.number().int().min(0).max(59),
    made: z.boolean(),
    pointValue: z.union([z.literal(2), z.literal(3)]),
    zoneBasic: z.enum(BASIC_ZONES),
    zoneArea: z.enum(ZONE_AREAS),
    zoneRange: z.enum(ZONE_RANGES), // period-free; '16-24 ft.' must not parse
    distanceFt: z.number().int().min(0),
    locX: z.number().int(),
    locY: z.number().int(),
  })
  .refine((s) => s.pointValue === ZONE_POINT_VALUE[s.zoneBasic], {
    message: 'pointValue inconsistent with zoneBasic',
  })

const fga = z.number().int().min(0)
const fgm = z.number().int().min(0)

// Two grains only: SHOT_ZONE_BASIC already separates the two corners, so the
// corner split reads straight off the basic grain (see the plan's grain note).
const basicEntrySchema = z
  .strictObject({ grain: z.literal('basic'), zone: z.enum(BASIC_ZONES), fga, fgm })
  .refine((e) => e.fgm <= e.fga, { message: 'fgm exceeds fga' })

const midRangeBandEntrySchema = z
  .strictObject({ grain: z.literal('midRangeBand'), band: z.enum(MID_RANGE_BANDS), fga, fgm })
  .refine((e) => e.fgm <= e.fga, { message: 'fgm exceeds fga' })

const zoneBaselineEntrySchema = z.union([basicEntrySchema, midRangeBandEntrySchema])

export const derivedPayloadSchema = z
  .strictObject({
    _meta: z.strictObject({
      schemaVersion: z.literal(SCHEMA_VERSION),
      player: z.string().min(1),
      playerId: z.number().int(),
      season: z.string().regex(/^\d{4}-\d{2}$/),
      seasonType: z.string().min(1),
      pullDate: z.string().regex(isoDate),
      /** The reconciled frontier (ADR-0058): the latest game date this
       * payload's data runs through. Equals the max of shots[].gameDate —
       * verified below, so the frontier can never overstate the rows. */
      dataThrough: z.string().regex(isoDate),
      /** Games included through the frontier (distinct gameIds — verified
       * below). */
      gamesIncluded: z.number().int().min(1),
      sourceSnapshot: z.string().min(1),
      totalShots: z.number().int().min(0),
      /** Rows dropped at derive because the NBA's SHOT_TYPE contradicted the
       * zone's point value — reported in the UI whenever nonzero (ADR-0019). */
      zoneConflictsDropped: z.number().int().min(0),
    }),
    shots: z.array(enrichedShotSchema),
    zoneBaseline: z.array(zoneBaselineEntrySchema),
  })
  .superRefine((p, ctx) => {
    if (p._meta.totalShots !== p.shots.length) {
      ctx.addIssue({
        code: 'custom',
        message: `_meta.totalShots (${p._meta.totalShots}) != shots.length (${p.shots.length})`,
      })
    }
    // The frontier is the rows' own truth (ADR-0058): a stated dataThrough
    // or gamesIncluded that disagrees with the shots is a stale or forged
    // frontier, never accepted at the load boundary.
    if (p.shots.length > 0) {
      const maxDate = p.shots.reduce((m, s) => (s.gameDate > m ? s.gameDate : m), '')
      if (p._meta.dataThrough !== maxDate) {
        ctx.addIssue({
          code: 'custom',
          message: `_meta.dataThrough (${p._meta.dataThrough}) != max shot gameDate (${maxDate})`,
        })
      }
      const games = new Set(p.shots.map((s) => s.gameId)).size
      if (p._meta.gamesIncluded !== games) {
        ctx.addIssue({
          code: 'custom',
          message: `_meta.gamesIncluded (${p._meta.gamesIncluded}) != distinct game count (${games})`,
        })
      }
    }
    // The aggregation needs a populated baseline for every evaluation zone.
    for (const zone of EVAL_ZONES) {
      const n = p.zoneBaseline.filter((e) => e.grain === 'basic' && e.zone === zone).length
      if (n !== 1) {
        ctx.addIssue({
          code: 'custom',
          message: `zoneBaseline must contain '${zone}' at basic grain exactly once, got ${n}`,
        })
      }
    }
  })

export type EnrichedShot = z.infer<typeof enrichedShotSchema>
export type ZoneBaselineEntry = z.infer<typeof zoneBaselineEntrySchema>
export type DerivedPayload = z.infer<typeof derivedPayloadSchema>

/**
 * The load boundary (ADR-0007): every payload the app consumes passes through
 * here. Nothing else touches raw JSON.
 */
export function parseDerivedPayload(json: unknown): DerivedPayload {
  return derivedPayloadSchema.parse(json)
}
