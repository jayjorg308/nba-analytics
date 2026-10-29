// The team season index and its load boundary (ADR-0088): one row per
// published game of a team season — slug, date, opponent, both scores, the
// subject's box team line, the box line of every subject player who
// appeared (v2, ADR-0088 as amended 2026-10-29, for the player season
// page's game log), and that game's ruler with its rolled-up zones
// (ADR-0089). Small and living, beside the immutable game files. The
// quadrant and the season views read per-game values from here plus the
// team shot payload: each dot is aggregateShotMetrics over that game's
// slice under that game's own ruler, so a dot always equals its card.

import { z } from 'zod'
import { zoneBaselineEntrySchema } from './payload'

// Must match INDEX_SCHEMA_VERSION in ingestion/export_game_payload.py.
export const INDEX_SCHEMA_VERSION = 2

const isoDate = /^\d{4}-\d{2}-\d{2}$/
const count = z.number().int().min(0)

/** A subject player's box line for the game: the game file's line without
 * the technical and split free-throw counts only a receipt itemizes
 * (src/domain/gamePayload.real.test.ts holds the two equal). */
const indexPlayerSchema = z
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
  })
  .refine((p) => p.fgm <= p.fga && p.tpm <= p.tpa && p.ftm <= p.fta, {
    message: 'makes exceed attempts',
  })

/** The box line the players sum to: the game payload's own boundary set.
 * Never assists: the team's official count reconciles against the shots'
 * assist statuses (ADR-0046), not against the players' credited assists. */
const BOX_SUMS = ['points', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta'] as const

const indexGameSchema = z
  .strictObject({
    gameId: z.string().regex(/^\d{10}$/),
    /** The URL segment: date plus the opponent's lowercase tricode. */
    slug: z.string().regex(/^\d{4}-\d{2}-\d{2}-[a-z]{2,3}$/),
    gameDate: z.string().regex(isoDate),
    opponent: z.string().regex(/^[A-Z]{2,3}$/),
    home: z.boolean(),
    teamScore: count,
    opponentScore: count,
    box: z.strictObject({
      points: count,
      fgm: count,
      fga: count,
      tpm: count,
      tpa: count,
      ftm: count,
      fta: count,
      ast: count,
    }),
    players: z.array(indexPlayerSchema).min(1),
    ruler: z.strictObject({
      kind: z.enum(['pre-game', 'prior-season']),
      season: z.string().regex(/^\d{4}-\d{2}$/),
      through: z.string().regex(isoDate),
      games: z.number().int().min(1),
      zoneBaseline: z.array(zoneBaselineEntrySchema),
    }),
  })
  .refine((g) => g.slug === `${g.gameDate}-${g.opponent.toLowerCase()}`, {
    message: 'slug is the date plus the opponent tricode',
  })
  .refine((g) => g.box.points === g.teamScore, { message: 'box points != team score' })
  .refine((g) => g.teamScore !== g.opponentScore, { message: 'an NBA game has no ties' })
  .refine((g) => new Set(g.players.map((p) => p.playerId)).size === g.players.length, {
    message: 'a player is listed twice',
  })
  .refine((g) => BOX_SUMS.every((k) => g.players.reduce((s, p) => s + p[k], 0) === g.box[k]), {
    message: 'the player lines do not sum to the box team line',
  })

export const teamSeasonIndexSchema = z
  .strictObject({
    _meta: z.strictObject({
      schemaVersion: z.literal(INDEX_SCHEMA_VERSION),
      team: z.string().min(1),
      teamId: z.number().int(),
      tricode: z.string().regex(/^[A-Z]{2,3}$/),
      season: z.string().regex(/^\d{4}-\d{2}$/),
      seasonType: z.string().min(1),
      dataThrough: z.string().regex(isoDate),
      gamesIncluded: z.number().int().min(1),
    }),
    games: z.array(indexGameSchema).min(1),
  })
  .superRefine((index, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message })
    if (index._meta.gamesIncluded !== index.games.length) {
      issue(`_meta.gamesIncluded (${index._meta.gamesIncluded}) != games.length (${index.games.length})`)
    }
    if (index._meta.dataThrough !== index.games[index.games.length - 1]!.gameDate) {
      issue('_meta.dataThrough is not the last game date')
    }
    for (let i = 1; i < index.games.length; i++) {
      if (index.games[i - 1]!.gameDate >= index.games[i]!.gameDate) {
        issue(`games[] not chronological (one game per date) at index ${i}`)
      }
    }
  })

export type IndexPlayer = z.infer<typeof indexPlayerSchema>
export type IndexGame = z.infer<typeof indexGameSchema>
export type TeamSeasonIndex = z.infer<typeof teamSeasonIndexSchema>

export function parseTeamSeasonIndex(json: unknown): TeamSeasonIndex {
  return teamSeasonIndexSchema.parse(json)
}
