// Normalized Case 3 shot-context contract (ADR-0032). Raw play-by-play text
// stops at the Python derive boundary; the app receives only conservative,
// auditable status/evidence categories keyed one-to-one to the shot payload.

import { z } from 'zod'

// v2: _meta.dataThrough/gamesIncluded — the reconciled frontier, copied from
//     the sibling shot payload at derive (ADR-0058; v3 Phase 2).
export const SHOT_CONTEXT_SCHEMA_VERSION = 2

export const ASSIST_STATUSES = [
  'assisted',
  'unassisted',
  'notApplicable',
  'unknown',
] as const
export type AssistStatus = (typeof ASSIST_STATUSES)[number]

export const EVENT_MATCHES = [
  'matched',
  'missingGame',
  'missingEvent',
  'duplicateEvent',
  'contradiction',
] as const
export type EventMatch = (typeof EVENT_MATCHES)[number]

const FAILURE_BY_MATCH = {
  matched: null,
  missingGame: 'missingGame',
  missingEvent: 'missingEvent',
  duplicateEvent: 'duplicateEvent',
  contradiction: 'identityContradiction',
} as const

const countShape = <T extends readonly [string, ...string[]]>(values: T) =>
  z.strictObject(Object.fromEntries(values.map((value) => [value, z.number().int().min(0)])))

const contextShotSchema = z
  .strictObject({
    gameId: z.string().min(1),
    gameEventId: z.number().int(),
    eventMatch: z.enum(EVENT_MATCHES),
    assistStatus: z.enum(ASSIST_STATUSES),
    assistEvidence: z.enum([
      'descriptionCredit',
      'validatedAbsence',
      'notApplicable',
      'unavailable',
    ]),
    failureReason: z.enum([
      'missingGame',
      'missingEvent',
      'duplicateEvent',
      'identityContradiction',
    ]).nullable(),
  })
  .superRefine((row, ctx) => {
    if (row.failureReason !== FAILURE_BY_MATCH[row.eventMatch]) {
      ctx.addIssue({ code: 'custom', message: 'failureReason inconsistent with eventMatch' })
    }
    const expectedEvidence = {
      assisted: 'descriptionCredit',
      unassisted: 'validatedAbsence',
      notApplicable: 'notApplicable',
      unknown: 'unavailable',
    } as const
    if (row.assistEvidence !== expectedEvidence[row.assistStatus]) {
      ctx.addIssue({ code: 'custom', message: 'assistEvidence inconsistent with assistStatus' })
    }
    if ((row.assistStatus === 'assisted' || row.assistStatus === 'unassisted') && row.eventMatch !== 'matched') {
      ctx.addIssue({ code: 'custom', message: 'classified makes require an exact event match' })
    }
  })

export const shotContextPayloadSchema = z
  .strictObject({
    _meta: z.strictObject({
      schemaVersion: z.literal(SHOT_CONTEXT_SCHEMA_VERSION),
      player: z.string().min(1),
      playerId: z.number().int().positive(),
      season: z.string().regex(/^\d{4}-\d{2}$/),
      /** The reconciled frontier (ADR-0058), copied from the sibling shot
       * payload; gamesIncluded must agree with this contract's own
       * gamesExpected (both count the sibling's distinct games — verified
       * below). */
      dataThrough: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      gamesIncluded: z.number().int().min(1),
      sourceShotPayload: z.string().min(1),
      totalShots: z.number().int().min(0),
      gamesExpected: z.number().int().min(0),
      gamesLoaded: z.number().int().min(0),
      eventMatchCounts: countShape(EVENT_MATCHES),
      assistStatusCounts: countShape(ASSIST_STATUSES),
      sourceGames: z.array(
        z.strictObject({
          gameId: z.string().min(1),
          playByPlayPullDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          boxScorePullDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        }),
      ),
    }),
    shots: z.array(contextShotSchema),
  })
  .superRefine((payload, ctx) => {
    if (payload._meta.totalShots !== payload.shots.length) {
      ctx.addIssue({ code: 'custom', message: '_meta.totalShots must equal shots.length' })
    }
    if (payload._meta.gamesLoaded > payload._meta.gamesExpected) {
      ctx.addIssue({ code: 'custom', message: 'gamesLoaded exceeds gamesExpected' })
    }
    if (payload._meta.gamesIncluded !== payload._meta.gamesExpected) {
      ctx.addIssue({
        code: 'custom',
        message: 'gamesIncluded (frontier) disagrees with gamesExpected (corpus)',
      })
    }
    const keys = payload.shots.map((row) => `${row.gameId}:${row.gameEventId}`)
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({ code: 'custom', message: 'shot context identities must be unique' })
    }
    const sourceGameIds = payload._meta.sourceGames.map((game) => game.gameId)
    if (new Set(sourceGameIds).size !== sourceGameIds.length) {
      ctx.addIssue({ code: 'custom', message: 'source game identities must be unique' })
    }
    const shotGameIds = [...new Set(payload.shots.map((row) => row.gameId))]
    if (shotGameIds.length !== payload._meta.gamesExpected) {
      ctx.addIssue({ code: 'custom', message: 'gamesExpected disagrees with shot rows' })
    }
    const loadedGameIds = [
      ...new Set(
        payload.shots
          .filter((row) => row.eventMatch !== 'missingGame')
          .map((row) => row.gameId),
      ),
    ]
    for (const gameId of loadedGameIds) {
      if (payload.shots.some((row) => row.gameId === gameId && row.eventMatch === 'missingGame')) {
        ctx.addIssue({ code: 'custom', message: `game ${gameId} mixes loaded and missingGame rows` })
      }
    }
    if (
      loadedGameIds.length !== payload._meta.gamesLoaded ||
      sourceGameIds.length !== loadedGameIds.length ||
      loadedGameIds.some((gameId) => !sourceGameIds.includes(gameId))
    ) {
      ctx.addIssue({ code: 'custom', message: 'sourceGames identities must equal loaded shot games' })
    }
    for (const sourceGame of payload._meta.sourceGames) {
      if (sourceGame.playByPlayPullDate !== sourceGame.boxScorePullDate) {
        ctx.addIssue({ code: 'custom', message: `game ${sourceGame.gameId} source pull dates disagree` })
      }
    }
    for (const match of EVENT_MATCHES) {
      const actual = payload.shots.filter((row) => row.eventMatch === match).length
      if (payload._meta.eventMatchCounts[match] !== actual) {
        ctx.addIssue({ code: 'custom', message: `eventMatchCounts.${match} disagrees with rows` })
      }
    }
    for (const status of ASSIST_STATUSES) {
      const actual = payload.shots.filter((row) => row.assistStatus === status).length
      if (payload._meta.assistStatusCounts[status] !== actual) {
        ctx.addIssue({ code: 'custom', message: `assistStatusCounts.${status} disagrees with rows` })
      }
    }
  })

export type ShotContext = z.infer<typeof contextShotSchema>
export type ShotContextPayload = z.infer<typeof shotContextPayloadSchema>

export function parseShotContextPayload(json: unknown): ShotContextPayload {
  return shotContextPayloadSchema.parse(json)
}
