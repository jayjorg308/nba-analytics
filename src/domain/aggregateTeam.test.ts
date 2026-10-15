// The team aggregation's contract (ADR-0081/0084) over the committed team
// goldens: identities between the two team contracts, no double counting
// across slices, and the box oracle re-run at the load boundary.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { aggregateShotMetrics } from './aggregate'
import { aggregateTeam, seasonOfGameId } from './aggregateTeam'
import { indexFromLedger } from './indexFromLedger.testutil'
import { parseLedgerFacts } from './ledgerFacts'
import { parseTeamShotPayload } from './teamShotPayload'

const read = (rel: string) =>
  JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf-8')) as unknown
const payload = parseTeamShotPayload(read('../../tests/fixtures/team-shot.golden.json'))
const ledger = parseLedgerFacts(read('../../tests/fixtures/team-ledger.golden.json'))
const index = indexFromLedger(payload, ledger)

describe('aggregateTeam', () => {
  it('computes the profile and one row per ledger game over the same rows', () => {
    const team = aggregateTeam(payload, ledger, index)
    expect(team.games).toBe(1)
    expect(team.shots).toBe(81)
    expect(team.ledger).toHaveLength(1)
    const row = team.ledger[0]!
    expect(row.gameId).toBe('0022500025')
    expect(row.won).toBe(false)
    expect(row.shots).toBe(81)
    // One game season: the game's metrics ARE the profile.
    expect(row.metrics).toEqual(team.profile)
    expect(team.gameById.get('0022500025')).toBe(row)
  })

  it('season totals equal the sum of game slices (no double counting)', () => {
    const team = aggregateTeam(payload, ledger, index)
    const summed = team.ledger.reduce((n, r) => n + r.metrics.totalAttempts, 0)
    expect(summed).toBe(team.profile.totalAttempts)
    expect(aggregateShotMetrics(payload.shots, payload.zoneBaseline).totalAttempts).toBe(summed)
  })

  it('resolves every ledger player to a name from the payload, scorers first', () => {
    const team = aggregateTeam(payload, ledger, index)
    const players = team.ledger[0]!.players
    expect(players.length).toBeGreaterThan(0)
    expect(players[0]!.playerName).toBe('Lauri Markkanen')
    expect(players.every((p) => p.playerName.length > 0 && p.fga > 0)).toBe(true)
  })

  it('flags a game under the making bar as thin, never hides it', () => {
    const team = aggregateTeam(payload, ledger, index)
    // 81 attempts clear the 50-attempt bar.
    expect(team.ledger[0]!.thinSample).toBe(false)
    const thinPayload = {
      ...payload,
      shots: payload.shots.slice(0, 20),
      _meta: { ...payload._meta, totalShots: 20 },
    }
    // The ledger's players narrow to the sliced rows' shooters; box FGA
    // becomes the 20 rows plus the one dropped conflict.
    const shooters = new Set(thinPayload.shots.map((s) => s.playerId))
    const thinLedger = {
      ...ledger,
      games: [
        {
          ...ledger.games[0]!,
          fga: 21,
          players: ledger.games[0]!.players.filter((p) => shooters.has(p.playerId)),
        },
      ],
    }
    const thin = aggregateTeam(thinPayload, thinLedger, index)
    expect(thin.ledger[0]!.thinSample).toBe(true)
    expect(thin.ledger[0]!.metrics.totalAttempts).toBe(20)
  })

  it('rejects a ledger that disagrees with the payload on identity or frontier', () => {
    expect(() =>
      aggregateTeam(payload, { ...ledger, _meta: { ...ledger._meta, season: '2024-25' } }, index),
    ).toThrow(/disagree on identity/)
    expect(() =>
      aggregateTeam(payload, { ...ledger, _meta: { ...ledger._meta, gamesIncluded: 2 } }, index),
    ).toThrow(/frontier/)
  })

  it('rejects a box FGA below the payload rows and a season total that disagrees', () => {
    const short = { ...ledger, games: [{ ...ledger.games[0]!, fga: 10 }] }
    expect(() => aggregateTeam(payload, short, index)).toThrow(/box FGA 10 </)
    const over = { ...ledger, games: [{ ...ledger.games[0]!, fga: 90 }] }
    expect(() => aggregateTeam(payload, over, index)).toThrow(/pre-drop total/)
  })

  it('prices each game row against its own ruler from the index, the profile against the season', () => {
    const shifted = structuredClone(index)
    for (const e of shifted.games[0]!.ruler.zoneBaseline) e.fgm = Math.max(0, e.fgm - 1)
    const team = aggregateTeam(payload, ledger, shifted)
    expect(team.ledger[0]!.slug).toBe('2025-10-31-phx')
    expect(team.ledger[0]!.metrics.selection.leagueDietExpectedPps).not.toBe(
      team.profile.selection.leagueDietExpectedPps,
    )
    expect(team.profile).toEqual(aggregateShotMetrics(payload.shots, payload.zoneBaseline))
  })

  it('rejects a season index whose games differ from the ledger', () => {
    expect(() =>
      aggregateTeam(payload, ledger, { ...index, games: [{ ...index.games[0]!, gameId: '0022500026' }] }),
    ).toThrow(/not the same set/)
  })

  it('reads the season off a game id', () => {
    expect(seasonOfGameId('0022500025')).toBe('2025-26')
    expect(seasonOfGameId('0022600001')).toBe('2026-27')
  })
})
