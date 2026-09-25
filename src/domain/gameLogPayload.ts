// The game-log typed contract (ADR-0086): the game-log payload behind game
// cards — one committed file per card-roster player-season, per-game shots,
// trips, technical free throws, and a box-line subset, with the season's
// league zone pairs embedded (every payload carries its baseline). Born
// DB-native: exported from the record store (ingestion/
// export_gamelog_payload.py), no file derive exists. Metric-free per the
// house rule — pricing (expected from diet, conversion) is computed by the
// page from the pairs, never persisted. Strict schemas: an unknown key is a
// contract violation (tests/fixtures/README.md).

import { z } from 'zod'
import { BASIC_ZONES, EVAL_ZONES, ZONE_POINT_VALUE } from './constants'
import { TRIP_CLASSES } from './freethrowPayload'

// v2: per-game splitFtm/splitFta (ADR-0053 as amended): split free throws
//     — one foul's award divided between players — counted on the receipt
//     beside technicals, never trips; the receipt identity includes them.
export const GAMELOG_SCHEMA_VERSION = 2

const isoDate = /^\d{4}-\d{2}-\d{2}$/

/** A card shot prices iff the scorer's value agrees with the zone's and the
 * zone evaluates — the ADR-0019 boundary at game grain: a Backcourt heave or
 * a zone-point conflict appears in the receipt (its made points are real and
 * the receipt must sum to the box line) but is never priced into the
 * expected-from-diet number. */
export function shotPrices(shot: { zone: string; value: number }): boolean {
  return (
    shot.zone !== 'Backcourt' &&
    ZONE_POINT_VALUE[shot.zone as (typeof BASIC_ZONES)[number]] === shot.value
  )
}

/** Game clock remaining in the period, "M:SS" — what interleaves shots and
 * trips into the game's actual flow on the receipt. */
const clock = z.string().regex(/^\d{1,2}:\d{2}$/)

const cardShotSchema = z.strictObject({
  zone: z.enum(BASIC_ZONES),
  value: z.union([z.literal(2), z.literal(3)]),
  made: z.boolean(),
  period: z.number().int().min(1),
  clock,
  /** The Case 3 status, copied from the shot-context contract. Null only
   * for a zone-point conflict row, which the context contract (total over
   * the sibling shot payload's post-drop rows) never carries. */
  assist: z.enum(['assisted', 'unassisted', 'notApplicable', 'unknown']).nullable(),
})

const cardTripSchema = z
  .strictObject({
    tripClass: z.enum(TRIP_CLASSES),
    period: z.number().int().min(1),
    clock,
    ftm: z.number().int().min(0),
    fta: z.number().int().min(1).max(3),
  })
  .refine((t) => t.ftm <= t.fta, { message: 'trip ftm exceeds fta' })

const cardGameSchema = z
  .strictObject({
    gameId: z.string().regex(/^\d{10}$/),
    date: z.string().regex(isoDate),
    opponent: z.string().regex(/^[A-Z]{2,3}$/),
    home: z.boolean(),
    box: z.strictObject({
      min: z.string().min(1),
      pts: z.number().int().min(0),
      reb: z.number().int().min(0),
      ast: z.number().int().min(0),
      ftm: z.number().int().min(0),
      fta: z.number().int().min(0),
    }),
    shots: z.array(cardShotSchema),
    trips: z.array(cardTripSchema),
    technicalFtm: z.number().int().min(0),
    technicalFta: z.number().int().min(0),
    splitFtm: z.number().int().min(0),
    splitFta: z.number().int().min(0),
  })
  .superRefine((game, ctx) => {
    // The receipt identity (ADR-0086): every point on the card's receipt —
    // field goals (priced or not), trip free throws, technicals — sums to
    // the official box line, per game, or the payload never parses.
    const fgPoints = game.shots.reduce((s, shot) => s + (shot.made ? shot.value : 0), 0)
    const tripFtm = game.trips.reduce((s, t) => s + t.ftm, 0)
    const tripFta = game.trips.reduce((s, t) => s + t.fta, 0)
    if (fgPoints + tripFtm + game.technicalFtm + game.splitFtm !== game.box.pts) {
      ctx.addIssue({
        code: 'custom',
        message: `game ${game.gameId}: FG points + trip, technical, and split FTM != box points`,
      })
    }
    if (tripFtm + game.technicalFtm + game.splitFtm !== game.box.ftm) {
      ctx.addIssue({ code: 'custom', message: `game ${game.gameId}: FTM does not reconcile` })
    }
    if (tripFta + game.technicalFta + game.splitFta !== game.box.fta) {
      ctx.addIssue({ code: 'custom', message: `game ${game.gameId}: FTA does not reconcile` })
    }
    if (game.technicalFtm > game.technicalFta) {
      ctx.addIssue({ code: 'custom', message: `game ${game.gameId}: technical FTM exceeds FTA` })
    }
    if (game.splitFtm > game.splitFta) {
      ctx.addIssue({ code: 'custom', message: `game ${game.gameId}: split FTM exceeds FTA` })
    }
    for (const shot of game.shots) {
      // Null assist iff the row is a zone-point conflict: the context
      // contract is total over the sibling payload's post-drop rows, and
      // conflicts are the only rows dropped there — a Backcourt heave is
      // unpriced but classified.
      const conflict = ZONE_POINT_VALUE[shot.zone] !== shot.value
      if ((shot.assist === null) !== conflict) {
        ctx.addIssue({
          code: 'custom',
          message: `game ${game.gameId}: assist status must be null iff the shot is a zone-point conflict`,
        })
      }
      if (shot.made === false && shot.assist === 'assisted') {
        ctx.addIssue({ code: 'custom', message: `game ${game.gameId}: a miss cannot be assisted` })
      }
    }
  })

const leaguePairSchema = z
  .strictObject({
    zone: z.enum(EVAL_ZONES),
    fga: z.number().int().positive(),
    fgm: z.number().int().min(0),
  })
  .refine((e) => e.fgm <= e.fga, { message: 'league fgm exceeds fga' })

export const gameLogPayloadSchema = z
  .strictObject({
    _meta: z.strictObject({
      schemaVersion: z.literal(GAMELOG_SCHEMA_VERSION),
      player: z.string().min(1),
      playerId: z.number().int().positive(),
      season: z.string().regex(/^\d{4}-\d{2}$/),
      seasonType: z.string().min(1),
      /** The latest game date on file — a card-navigation fact, not the
       * four siblings' reconciled frontier (a trailing shotless free-throw
       * game can put it past the shot payload's dataThrough). */
      dataThrough: z.string().regex(isoDate),
      totalGames: z.number().int().min(1),
      /** Pre-drop season FGA — the card-roster bar's measure and the
       * export's oracle against the league totals artifact. */
      seasonFga: z.number().int().min(0),
    }),
    leagueBaseline: z.array(leaguePairSchema),
    /** The league's season free-throw line (endpoint parity, ADR-0055:
     * technicals included — league totals cannot exclude them). What prices
     * a trip at league conversion (Points per trip's '(lg)'). */
    leagueFreeThrows: z
      .strictObject({
        ftm: z.number().int().min(0),
        fta: z.number().int().positive(),
      })
      .refine((l) => l.ftm <= l.fta, { message: 'league ftm exceeds fta' }),
    games: z.array(cardGameSchema),
  })
  .superRefine((payload, ctx) => {
    if (payload._meta.totalGames !== payload.games.length) {
      ctx.addIssue({ code: 'custom', message: '_meta.totalGames must equal games.length' })
    }
    const shotCount = payload.games.reduce((s, g) => s + g.shots.length, 0)
    if (payload._meta.seasonFga !== shotCount) {
      ctx.addIssue({
        code: 'custom',
        message: '_meta.seasonFga must equal the shots carried across games (pre-drop)',
      })
    }
    const dates = payload.games.map((g) => g.date)
    const sorted = [...dates].sort()
    if (dates.join(',') !== sorted.join(',') || new Set(dates).size !== dates.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'games must be date-ascending and date-unique (card prev/next order)',
      })
    }
    if (payload.games.length > 0 && payload._meta.dataThrough !== dates[dates.length - 1]) {
      ctx.addIssue({ code: 'custom', message: '_meta.dataThrough must equal the last game date' })
    }
    for (const zone of EVAL_ZONES) {
      const n = payload.leagueBaseline.filter((e) => e.zone === zone).length
      if (n !== 1) {
        ctx.addIssue({
          code: 'custom',
          message: `leagueBaseline must carry '${zone}' exactly once, got ${n}`,
        })
      }
    }
  })

/** The roster index the /game landing reads (`public/data/games/
 * index.json`) — regenerated whole with every export tranche, and guarded
 * to name exactly the files on disk. */
export const gameLogIndexSchema = z.strictObject({
  rosters: z.array(
    z.strictObject({
      slug: z.string().regex(/^[a-z0-9-]+$/),
      player: z.string().min(1),
      season: z.string().regex(/^\d{4}-\d{2}$/),
      totalGames: z.number().int().min(1),
      dataThrough: z.string().regex(isoDate),
    }),
  ),
})

export type GameLogIndex = z.infer<typeof gameLogIndexSchema>

export function parseGameLogIndex(json: unknown): GameLogIndex {
  return gameLogIndexSchema.parse(json)
}

export type CardShot = z.infer<typeof cardShotSchema>
export type CardTrip = z.infer<typeof cardTripSchema>
export type CardGame = z.infer<typeof cardGameSchema>
export type GameLogPayload = z.infer<typeof gameLogPayloadSchema>

/** The load boundary (ADR-0007's rule, the game-log contract): every game-log file
 * the app consumes passes through here. */
export function parseGameLogPayload(json: unknown): GameLogPayload {
  return gameLogPayloadSchema.parse(json)
}
