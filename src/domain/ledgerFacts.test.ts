// Load-boundary tests for the game ledger facts (ADR-0084): the committed
// golden strict-parses; contract violations are rejected.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LEDGER_SCHEMA_VERSION, ledgerFactsSchema, parseLedgerFacts } from './ledgerFacts'

const golden = JSON.parse(
  readFileSync(new URL('../../tests/fixtures/team-ledger.golden.json', import.meta.url), 'utf-8'),
) as unknown

type Json = Record<string, unknown>
interface Mutable extends Json {
  _meta: Json
  games: (Json & { players: Json[] })[]
}
const clone = (): Mutable => structuredClone(golden) as Mutable
const rejected = (p: unknown) => expect(ledgerFactsSchema.safeParse(p).success).toBe(false)

describe('parseLedgerFacts', () => {
  it('strict-parses the committed golden', () => {
    const ledger = parseLedgerFacts(golden)
    expect(ledger._meta.schemaVersion).toBe(LEDGER_SCHEMA_VERSION)
    expect(ledger.games).toHaveLength(1)
    expect(ledger.games[0]!.players.length).toBeGreaterThan(5)
  })

  it('rejects a persisted metric (the decomposition is computed, never stored)', () => {
    const p = clone()
    p.games[0]!.selectionDelta = 0.02
    rejected(p)
  })

  it('rejects a player name (identity is the id; names live in the team payload)', () => {
    const p = clone()
    p.games[0]!.players[0]!.playerName = 'Lauri Markkanen'
    rejected(p)
  })

  it('rejects a player without a field-goal attempt', () => {
    const p = clone()
    p.games[0]!.players[0]!.fga = 0
    rejected(p)
  })

  it('rejects a tie, makes over attempts, and a frontier that disagrees', () => {
    const tie = clone()
    tie.games[0]!.opponentScore = tie.games[0]!.teamScore
    rejected(tie)
    const makes = clone()
    makes.games[0]!.fgm = (makes.games[0]!.fga as number) + 1
    rejected(makes)
    const frontier = clone()
    frontier._meta.dataThrough = '2026-04-12'
    rejected(frontier)
  })
})
