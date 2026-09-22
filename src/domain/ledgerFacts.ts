// The game ledger facts contract and its load boundary (ADR-0084): exact
// box facts per game for the Jazz surface's ledger — matchup, both scores,
// the team's field-goal and free-throw lines, and the per-player lines of
// everyone who attempted a field goal. Python (ingestion/ledger_facts.py,
// fed by derive_ledger_facts.py or export_ledger_facts.py) persists it beside
// the team shot payload; the per-game DECOMPOSITION is never in here — it is
// aggregateShotMetrics over that game's slice of the team payload's rows,
// computed in the browser (ADR-0007/0084).

import { z } from 'zod'

// Must match SCHEMA_VERSION in ingestion/ledger_facts.py.
export const LEDGER_SCHEMA_VERSION = 1

const isoDate = /^\d{4}-\d{2}-\d{2}$/
const count = z.number().int().min(0)

const ledgerPlayerSchema = z
  .strictObject({
    /** Identity only — the name lives in the sibling team shot payload,
     * where every ledger player has rows (only players with a field-goal
     * attempt appear here). */
    playerId: z.number().int(),
    fgm: count,
    fga: z.number().int().min(1),
    ftm: count,
    fta: count,
    points: count,
  })
  .refine((p) => p.fgm <= p.fga && p.ftm <= p.fta, { message: 'makes exceed attempts' })

const ledgerGameSchema = z
  .strictObject({
    gameId: z.string().regex(/^\d{10}$/),
    gameDate: z.string().regex(isoDate),
    opponent: z.string().regex(/^[A-Z]{2,3}$/),
    home: z.boolean(),
    teamScore: count,
    opponentScore: count,
    fgm: count,
    fga: count,
    ftm: count,
    fta: count,
    players: z.array(ledgerPlayerSchema),
  })
  .refine((g) => g.fgm <= g.fga && g.ftm <= g.fta, { message: 'makes exceed attempts' })
  .refine((g) => g.teamScore !== g.opponentScore, { message: 'an NBA game has no ties' })

export const ledgerFactsSchema = z
  .strictObject({
    _meta: z.strictObject({
      schemaVersion: z.literal(LEDGER_SCHEMA_VERSION),
      team: z.string().min(1),
      teamId: z.number().int(),
      tricode: z.string().regex(/^[A-Z]{2,3}$/),
      season: z.string().regex(/^\d{4}-\d{2}$/),
      seasonType: z.string().min(1),
      dataThrough: z.string().regex(isoDate),
      gamesIncluded: z.number().int().min(1),
      /** The team shot payload whose game set this ledger covers. */
      sourceTeamPayload: z.string().min(1),
    }),
    games: z.array(ledgerGameSchema).min(1),
  })
  .superRefine((l, ctx) => {
    if (l._meta.gamesIncluded !== l.games.length) {
      ctx.addIssue({
        code: 'custom',
        message: `_meta.gamesIncluded (${l._meta.gamesIncluded}) != games.length (${l.games.length})`,
      })
    }
    const last = l.games[l.games.length - 1]!
    if (l._meta.dataThrough !== last.gameDate) {
      ctx.addIssue({
        code: 'custom',
        message: `_meta.dataThrough (${l._meta.dataThrough}) != last game date (${last.gameDate})`,
      })
    }
    const ids = new Set<string>()
    for (let i = 0; i < l.games.length; i++) {
      const g = l.games[i]!
      if (ids.has(g.gameId)) ctx.addIssue({ code: 'custom', message: `game ${g.gameId} listed twice` })
      ids.add(g.gameId)
      if (i > 0) {
        const prev = l.games[i - 1]!
        if (prev.gameDate > g.gameDate || (prev.gameDate === g.gameDate && prev.gameId > g.gameId)) {
          ctx.addIssue({ code: 'custom', message: `games[] not chronological at index ${i}` })
        }
      }
    }
  })

export type LedgerGame = z.infer<typeof ledgerGameSchema>
export type LedgerPlayer = z.infer<typeof ledgerPlayerSchema>
export type LedgerFacts = z.infer<typeof ledgerFactsSchema>

/** Parse at the load boundary; throws a ZodError on any contract violation. */
export function parseLedgerFacts(json: unknown): LedgerFacts {
  return ledgerFactsSchema.parse(json)
}
