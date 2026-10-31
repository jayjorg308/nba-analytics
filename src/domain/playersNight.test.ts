// The player's night module (ADR-0096) over the game and index goldens (the
// fixture game 0022500492): a night equals his dot and his line on the card,
// the receipt runs in game order down to his box points, the line and the
// credit read off the file, and a free-throw-only appearance is a night with
// no season page behind it.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseGamePayload } from './gamePayload'
import { buildPlayerSeason, playerSlug } from './playerSeason'
import { buildPlayersNight } from './playersNight'
import type { ReceiptLine } from './playersNight'
import { buildReportCard } from './reportCard'
import { relabelIndex, teamPayloadFromGame } from './teamPayloadFromGame.testutil'
import { parseTeamSeasonIndex } from './teamSeasonIndex'

const read = (rel: string) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf-8')) as unknown
const game = parseGamePayload(read('../../tests/fixtures/game.golden.json'))
const index = parseTeamSeasonIndex(read('../../tests/fixtures/team-index.golden.json'))
const payload = teamPayloadFromGame(game)

const points = (r: ReceiptLine) =>
  r.kind === 'shot' ? (r.shot.made ? r.shot.pointValue : 0) : r.kind === 'conflict' ? (r.made ? r.pointValue : 0) : r.trip.ftm

describe('buildPlayersNight', () => {
  const night = buildPlayersNight('keyonte-george', game, index, payload)!

  it('prices his night exactly as his dot, his game-log row, and his card line', () => {
    const season = buildPlayerSeason('keyonte-george', payload, index)!
    const card = buildReportCard(game, index, payload).subject.players.find((p) => p.name === 'Keyonte George')!
    expect(night.tonight).toEqual(season.dots[0])
    expect(night.metrics!.selection.selectionDelta).toBe(night.tonight!.metrics.selection.selectionDelta)
    expect([night.expected, night.scored]).toEqual([season.games[0]!.expected, season.games[0]!.scored])
    expect([night.expected, night.scored, night.evalAttempts]).toEqual([card.expected, card.scored, card.evalAttempts])
    expect(night.slug).toBe('2026-01-03-gsw')
    expect([night.won, night.teamScore, night.opponentScore]).toEqual([false, index.games[0]!.teamScore, index.games[0]!.opponentScore])
  })

  it('runs the receipt in game order down to his box points', () => {
    const order = night.receipt.map((r) => [r.period, -r.clock])
    expect(order).toEqual([...order].sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!))
    const total = night.receipt.reduce((n, r) => n + points(r), 0) + night.line.technicalFtm + night.line.splitFtm
    expect(total).toBe(night.line.points)
    expect(night.receipt.filter((r) => r.kind === 'shot')).toHaveLength(night.shots.length)
    expect(night.receipt.filter((r) => r.kind === 'conflict')).toHaveLength(1)
    expect(night.zoneConflicts).toBe(1)
    expect(night.receipt.filter((r) => r.kind === 'trip')).toHaveLength(3)
  })

  it('puts an and-one after the make that drew it', () => {
    const andOne = night.receipt.findIndex((r) => r.kind === 'trip' && r.trip.tripClass === 'andOne')
    const before = night.receipt[andOne - 1]!
    expect(before.kind).toBe('shot')
    expect(before.kind === 'shot' && before.shot.made).toBe(true)
  })

  it('prices each shot at its zone’s league rate, and the prices sum to his expected points', () => {
    for (const r of night.receipt) {
      if (r.kind !== 'shot') continue
      const zone = night.metrics!.zones.find((z) => z.zone === r.shot.zoneBasic)
      expect(r.price).toBe(zone === undefined ? null : zone.leaguePps)
    }
    const sum = night.receipt.reduce((n, r) => n + (r.kind === 'shot' && r.price !== null ? r.price : 0), 0)
    expect(sum).toBeCloseTo(night.expected!, 10)
  })

  it('reads the line and the credit off the file', () => {
    expect(night.trips).toEqual({
      count: 3,
      points: 4,
      byClass: [
        { tripClass: 'shootingFoul2', count: 2 },
        { tripClass: 'andOne', count: 1 },
      ],
    })
    const makes = night.shots.filter((s) => s.made)
    expect(night.credit.makes).toBe(makes.length)
    expect(night.credit.assisted + night.credit.unassisted + night.credit.unknown).toBe(makes.length)
  })

  it('gives a free-throw-only appearance a night, with no dot and no season page', () => {
    const hendricks = buildPlayersNight('taylor-hendricks', game, index, payload)!
    expect([hendricks.line.fga, hendricks.line.fta, hendricks.line.points]).toEqual([0, 2, 1])
    expect([hendricks.metrics, hendricks.expected, hendricks.tonight]).toEqual([null, null, null])
    expect(hendricks.hasSeasonPage).toBe(false)
    expect(hendricks.dots).toEqual([])
    expect(hendricks.receipt.map((r) => r.kind)).toEqual(['trip'])
  })

  it('has no night for a player outside the subject’s box', () => {
    expect(buildPlayersNight('nobody', game, index, payload)).toBeNull()
    expect(buildPlayersNight(playerSlug(game.sides[1].players[0]!.name), game, index, payload)).toBeNull()
  })

  it('carries his prior season behind only when it is given', () => {
    expect([night.priorDots, night.priorSeason]).toEqual([[], null])
    const prior = { index: relabelIndex(index, '2024-25'), payload: teamPayloadFromGame(game, '2024-25') }
    const withPrior = buildPlayersNight('keyonte-george', game, index, payload, prior)!
    expect(withPrior.priorSeason).toBe('2024-25')
    expect(withPrior.priorDots).toHaveLength(1)
  })

  it('refuses a game outside the index, and a night that disagrees with his dot', () => {
    const other = { ...index, games: [{ ...index.games[0]!, gameId: '0022500493' }] }
    expect(() => buildPlayersNight('keyonte-george', game, other, payload)).toThrow(/not in the season index/)
    const moved = {
      ...payload,
      shots: payload.shots.map((s, i) => (i === payload.shots.findIndex((x) => x.playerName === 'Keyonte George' && !x.made) ? { ...s, made: true } : s)),
    }
    expect(() => buildPlayersNight('keyonte-george', game, index, moved)).toThrow(/disagree/)
  })
})
