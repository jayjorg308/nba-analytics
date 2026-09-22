// The team shot payload contract and its load boundary (ADR-0082): the
// fifth typed contract, with the TEAM as subject — behind the Jazz surface
// (docs/plans/jazz-surface.md). Python (ingestion/team_payload.py, fed by
// derive_team_payload.py or export_team_shot_payload.py) persists
// { _meta, roster, shots: TeamShot[], zoneBaseline }; this schema validates
// it at the boundary. Like the hero contract it carries NO metrics: the
// season-to-date profile, the player profiles, and the game rows are all
// aggregateShotMetrics over slices of shots[] (ADR-0009/0084).
//
// A TeamShot is the hero contract's EnrichedShot plus playerId/playerName,
// so the shape is shared, never duplicated. Rows are chronological by
// contract (game date, game, period, clock, event) — verified below.

import { z } from 'zod'
import { enrichedShotShape, zoneBaselineEntrySchema } from './payload'

// Must match SCHEMA_VERSION in ingestion/team_payload.py; bump both on any
// breaking payload change.
export const TEAM_SCHEMA_VERSION = 1

const isoDate = /^\d{4}-\d{2}-\d{2}$/

const teamShotSchema = z
  .strictObject({
    ...enrichedShotShape,
    playerId: z.number().int(),
    playerName: z.string().min(1),
  })
  .refine((s) => (s.zoneBasic.endsWith('3') || s.zoneBasic === 'Backcourt') === (s.pointValue === 3), {
    message: 'pointValue inconsistent with zoneBasic',
  })

// The roster as observed (commonteamroster, response order); labels are the
// source's own strings — number may be empty, experience is 'R' or a count.
const rosterEntrySchema = z.strictObject({
  playerId: z.number().int(),
  playerName: z.string().min(1),
  number: z.string(),
  position: z.string(),
  experience: z.string(),
})

export const teamShotPayloadSchema = z
  .strictObject({
    _meta: z.strictObject({
      schemaVersion: z.literal(TEAM_SCHEMA_VERSION),
      team: z.string().min(1),
      teamId: z.number().int(),
      /** The ADR-0028 static-map abbreviation — the deployment key
       * (public/data/_teams/<tricode lower>/). */
      tricode: z.string().regex(/^[A-Z]{2,3}$/),
      season: z.string().regex(/^\d{4}-\d{2}$/),
      seasonType: z.string().min(1),
      pullDate: z.string().regex(isoDate),
      /** The reconciled frontier (ADR-0058): equals the max shots[].gameDate
       * — verified below. */
      dataThrough: z.string().regex(isoDate),
      gamesIncluded: z.number().int().min(1),
      sourceSnapshot: z.string().min(1),
      rosterSnapshot: z.string().min(1),
      totalShots: z.number().int().min(0),
      zoneConflictsDropped: z.number().int().min(0),
    }),
    roster: z.array(rosterEntrySchema).min(1),
    shots: z.array(teamShotSchema).min(1),
    zoneBaseline: z.array(zoneBaselineEntrySchema),
  })
  .superRefine((p, ctx) => {
    if (p._meta.totalShots !== p.shots.length) {
      ctx.addIssue({
        code: 'custom',
        message: `_meta.totalShots (${p._meta.totalShots}) != shots.length (${p.shots.length})`,
      })
    }
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
        message: `_meta.gamesIncluded (${p._meta.gamesIncluded}) != distinct gameIds (${games})`,
      })
    }
    // Chronological order is the contract (ADR-0082), not a courtesy: the
    // ledger slices by game and a reader of shots[] may assume it.
    for (let i = 1; i < p.shots.length; i++) {
      const a = p.shots[i - 1]!
      const b = p.shots[i]!
      const ka = [a.gameDate, a.gameId, a.period, -a.minutesRemaining, -a.secondsRemaining, a.gameEventId]
      const kb = [b.gameDate, b.gameId, b.period, -b.minutesRemaining, -b.secondsRemaining, b.gameEventId]
      for (let k = 0; k < ka.length; k++) {
        if (ka[k]! < kb[k]!) break
        if (ka[k]! > kb[k]!) {
          ctx.addIssue({ code: 'custom', message: `shots[] not chronological at index ${i}` })
          return
        }
      }
    }
    const rosterIds = new Set(p.roster.map((e) => e.playerId))
    if (rosterIds.size !== p.roster.length) {
      ctx.addIssue({ code: 'custom', message: 'roster lists a player twice' })
    }
  })

export type TeamShot = z.infer<typeof teamShotSchema>
export type RosterEntry = z.infer<typeof rosterEntrySchema>
export type TeamShotPayload = z.infer<typeof teamShotPayloadSchema>

/** Parse at the load boundary; throws a ZodError on any contract violation. */
export function parseTeamShotPayload(json: unknown): TeamShotPayload {
  return teamShotPayloadSchema.parse(json)
}
