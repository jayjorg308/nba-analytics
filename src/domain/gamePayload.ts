// The game payload contract and its load boundary (ADR-0088): one immutable
// file per game, both teams, the subject team first — everything a report
// card and a player's night read. Born DB-native: exported from the record
// store (ingestion/export_game_payload.py), no file derive exists.
// Metric-free per the house rule: diet, conversion, and every rank are
// aggregateShotMetrics over a side's shots and the file's own ruler
// (ADR-0009), computed in the browser.
//
// The export's oracles are re-asserted here, so a file that would break a
// receipt never parses: per player, pre-drop rows (shots plus dropped
// zone-point conflicts) equal box FGA, trips plus technicals plus splits
// equal the box free-throw line, and every field-goal and free-throw point
// sums to his box points; per side, the players sum to the box team line
// and assist statuses bound the official team assists.

import { z } from 'zod'
import { BASIC_ZONES, EVAL_ZONES, ZONE_POINT_VALUE } from './constants'
import { checkTrip, tripShape } from './freethrowPayload'
import { enrichedShotShape, zoneBaselineEntrySchema } from './payload'

// Must match SCHEMA_VERSION in ingestion/export_game_payload.py.
export const GAME_SCHEMA_VERSION = 1

const isoDate = /^\d{4}-\d{2}-\d{2}$/
const count = z.number().int().min(0)
const tricode = z.string().regex(/^[A-Z]{2,3}$/)

export const ASSIST_STATUSES = ['assisted', 'unassisted', 'notApplicable', 'unknown'] as const

const gameShotSchema = z
  .strictObject({
    ...enrichedShotShape,
    playerId: z.number().int(),
    /** The Case 3 status by the shot-context grammar (ADR-0032/0046). */
    assistStatus: z.enum(ASSIST_STATUSES),
  })
  .refine((s) => s.pointValue === ZONE_POINT_VALUE[s.zoneBasic], {
    message: 'pointValue inconsistent with zoneBasic (conflicts belong in zoneConflicts)',
  })
  .refine((s) => (s.made ? s.assistStatus !== 'notApplicable' : s.assistStatus === 'notApplicable'), {
    message: 'a make carries an assist status, a miss is notApplicable',
  })

/** A zone-point conflict (ADR-0019): dropped from shots[] and listed so a
 * receipt can strike it. Its points are real and count toward the box. */
const zoneConflictSchema = z
  .strictObject({
    gameEventId: z.number().int(),
    playerId: z.number().int(),
    period: z.number().int().min(1),
    minutesRemaining: z.number().int().min(0).max(12),
    secondsRemaining: z.number().int().min(0).max(59),
    made: z.boolean(),
    pointValue: z.union([z.literal(2), z.literal(3)]),
    zoneBasic: z.enum(BASIC_ZONES),
  })
  .refine((c) => c.pointValue !== ZONE_POINT_VALUE[c.zoneBasic], {
    message: 'a listed conflict must disagree with its zone',
  })

const gameTripSchema = z
  .strictObject({ ...tripShape, playerId: z.number().int() })
  .superRefine(checkTrip)

/** A box line of a player who appeared, plus the technical and split free
 * throws the trip grammar counted for him (never trips, ADR-0053/0055). */
const gamePlayerSchema = z
  .strictObject({
    playerId: z.number().int(),
    name: z.string().min(1),
    minutes: z.string(),
    points: count,
    fgm: count,
    fga: count,
    tpm: count,
    tpa: count,
    ftm: count,
    fta: count,
    reb: count,
    ast: count,
    technicalFtm: count,
    technicalFta: count,
    splitFtm: count,
    splitFta: count,
  })
  .refine((p) => p.fgm <= p.fga && p.tpm <= p.tpa && p.ftm <= p.fta, {
    message: 'makes exceed attempts',
  })

const boxTeamLineSchema = z.strictObject({
  points: count,
  fgm: count,
  fga: count,
  tpm: count,
  tpa: count,
  ftm: count,
  fta: count,
  /** The official team assists (the box team line, ADR-0046). */
  ast: count,
})

const gameSideSchema = z
  .strictObject({
    teamId: z.number().int(),
    tricode,
    /** stats.nba.com's TEAM_NAME form. */
    team: z.string().min(1),
    home: z.boolean(),
    box: boxTeamLineSchema,
    sourceShotSnapshot: z.string().min(1),
    players: z.array(gamePlayerSchema).min(1),
    shots: z.array(gameShotSchema).min(1),
    zoneConflicts: z.array(zoneConflictSchema),
    trips: z.array(gameTripSchema),
  })
  .superRefine((side, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: 'custom', message: `${side.tricode}: ${message}` })
    const players = new Map(side.players.map((p) => [p.playerId, p]))
    if (players.size !== side.players.length) issue('a player is listed twice')
    for (const row of [...side.shots, ...side.zoneConflicts, ...side.trips]) {
      if (!players.has(row.playerId)) issue(`player ${row.playerId} has rows but no box line`)
    }
    for (const p of side.players) {
      const rows = [...side.shots, ...side.zoneConflicts].filter((r) => r.playerId === p.playerId)
      const trips = side.trips.filter((t) => t.playerId === p.playerId)
      const fgPoints = rows.reduce((s, r) => s + (r.made ? r.pointValue : 0), 0)
      const tripFtm = trips.reduce((s, t) => s + t.ftm, 0)
      const tripFta = trips.reduce((s, t) => s + t.fta, 0)
      if (rows.length !== p.fga) issue(`player ${p.playerId}: ${rows.length} rows != box FGA ${p.fga}`)
      if (tripFtm + p.technicalFtm + p.splitFtm !== p.ftm || tripFta + p.technicalFta + p.splitFta !== p.fta) {
        issue(`player ${p.playerId}: free-throw line does not reconcile`)
      }
      if (fgPoints + tripFtm + p.technicalFtm + p.splitFtm !== p.points) {
        issue(`player ${p.playerId}: receipt identity broken`)
      }
      if (p.technicalFtm > p.technicalFta || p.splitFtm > p.splitFta) {
        issue(`player ${p.playerId}: technical or split makes exceed attempts`)
      }
    }
    const sum = (key: 'points' | 'fgm' | 'fga' | 'tpm' | 'tpa' | 'ftm' | 'fta') =>
      side.players.reduce((s, p) => s + p[key], 0)
    for (const key of ['points', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta'] as const) {
      if (sum(key) !== side.box[key]) issue(`box ${key} (${side.box[key]}) != players (${sum(key)})`)
    }
    const assisted = side.shots.filter((s) => s.assistStatus === 'assisted').length
    const unknown =
      side.shots.filter((s) => s.made && s.assistStatus === 'unknown').length +
      side.zoneConflicts.filter((c) => c.made).length
    if (side.box.ast < assisted || side.box.ast > assisted + unknown) {
      issue(`assist statuses (${assisted} assisted, ${unknown} unknown) cannot reconcile to ${side.box.ast}`)
    }
    for (let i = 1; i < side.shots.length; i++) {
      const a = side.shots[i - 1]!
      const b = side.shots[i]!
      const ka = [a.period, -a.minutesRemaining, -a.secondsRemaining, a.gameEventId]
      const kb = [b.period, -b.minutesRemaining, -b.secondsRemaining, b.gameEventId]
      const k = ka.findIndex((v, j) => v !== kb[j])
      if (k !== -1 && ka[k]! > kb[k]!) {
        issue(`shots[] not chronological at index ${i}`)
        break
      }
    }
  })

const rulerSchema = z.strictObject({
  /** ADR-0089: the league as it stood entering the game's day, or the prior
   * season's full baseline when no league game had been played yet. */
  kind: z.enum(['pre-game', 'prior-season']),
  season: z.string().regex(/^\d{4}-\d{2}$/),
  /** The last date the ruler's league attempts cover, inclusive. */
  through: z.string().regex(isoDate),
  /** League games the ruler covers (the league game log through `through`). */
  games: z.number().int().min(1),
  sourceSnapshot: z.string().min(1),
})

/** The day before an ISO date — the pre-game ruler's through-date. */
export function dayBefore(date: string): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
}

function priorSeason(season: string): string {
  const start = Number(season.slice(0, 4)) - 1
  return `${start}-${String(start + 1).slice(-2)}`
}

export const gamePayloadSchema = z
  .strictObject({
    _meta: z.strictObject({
      schemaVersion: z.literal(GAME_SCHEMA_VERSION),
      gameId: z.string().regex(/^\d{10}$/),
      gameDate: z.string().regex(isoDate),
      season: z.string().regex(/^\d{4}-\d{2}$/),
      seasonType: z.string().min(1),
      /** The subject team: sides[0]. */
      teamId: z.number().int(),
      tricode,
      opponentTeamId: z.number().int(),
      opponentTricode: tricode,
      /** The subject was home. */
      home: z.boolean(),
      ruler: rulerSchema,
      sourcePlayByPlay: z.string().min(1),
      sourceBoxScore: z.string().min(1),
    }),
    sides: z.tuple([gameSideSchema, gameSideSchema]),
    zoneBaseline: z.array(zoneBaselineEntrySchema),
  })
  .superRefine((g, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message })
    const m = g._meta
    const [subject, opponent] = g.sides
    if (subject.teamId !== m.teamId || subject.tricode !== m.tricode || subject.home !== m.home) {
      issue('sides[0] is not the subject team')
    }
    if (opponent.teamId !== m.opponentTeamId || opponent.tricode !== m.opponentTricode || opponent.home === m.home) {
      issue('sides[1] is not the opponent')
    }
    if (subject.box.points === opponent.box.points) issue('an NBA game has no ties')
    for (const [side, other] of [
      [subject, opponent],
      [opponent, subject],
    ] as const) {
      for (const s of side.shots) {
        if (s.gameId !== m.gameId || s.gameDate !== m.gameDate || s.home !== side.home || s.opponent !== other.tricode) {
          ctx.addIssue({ code: 'custom', message: `${side.tricode}: shot ${s.gameEventId} disagrees with the game` })
          break
        }
      }
      if (side.trips.some((t) => t.gameId !== m.gameId)) issue(`${side.tricode}: a trip from another game`)
    }
    const r = m.ruler
    if (r.kind === 'pre-game' && (r.season !== m.season || r.through !== dayBefore(m.gameDate))) {
      issue(`a pre-game ruler is the day before the game in its season (got ${r.season} through ${r.through})`)
    }
    if (r.kind === 'prior-season' && r.season !== priorSeason(m.season)) {
      issue(`a prior-season ruler is ${priorSeason(m.season)} (got ${r.season})`)
    }
    for (const zone of EVAL_ZONES) {
      const entry = g.zoneBaseline.find((e) => e.grain === 'basic' && e.zone === zone)
      if (!entry || entry.fga === 0) issue(`ruler has no league attempts in ${zone}`)
    }
  })

export type GameShot = z.infer<typeof gameShotSchema>
export type GameTrip = z.infer<typeof gameTripSchema>
export type GamePlayer = z.infer<typeof gamePlayerSchema>
export type GameSide = z.infer<typeof gameSideSchema>
export type GameRuler = z.infer<typeof rulerSchema>
export type GamePayload = z.infer<typeof gamePayloadSchema>

/** Parse at the load boundary; throws a ZodError on any contract violation. */
export function parseGamePayload(json: unknown): GamePayload {
  return gamePayloadSchema.parse(json)
}
