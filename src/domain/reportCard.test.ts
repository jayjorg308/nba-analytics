// The report card's pure module over the committed goldens (the fixture
// game 0022500492 and its one-game index): the card equals its quadrant dot,
// both sides price against the one ruler, no rank below the game count,
// the prior season's dots arrive only when given, and every player line
// carries his own expected and scored points.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { aggregateShotMetrics } from './aggregate'
import { parseGamePayload } from './gamePayload'
import { buildReportCard, gameSlug, SEASON_RANK_MIN_GAMES, seasonDots } from './reportCard'
import { relabelIndex, teamPayloadFromGame } from './teamPayloadFromGame.testutil'
import { parseTeamSeasonIndex } from './teamSeasonIndex'

const read = (rel: string) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf-8')) as unknown
const game = parseGamePayload(read('../../tests/fixtures/game.golden.json'))
const index = parseTeamSeasonIndex(read('../../tests/fixtures/team-index.golden.json'))
const payload = teamPayloadFromGame(game)

describe('buildReportCard', () => {
  const card = buildReportCard(game, index, payload)

  it('prices tonight exactly as its quadrant dot does', () => {
    expect(card.tonight.gameId).toBe('0022500492')
    expect(card.subject.metrics).toEqual(card.tonight.metrics)
    expect(card.slug).toBe('2026-01-03-gsw')
    expect(card.won).toBe(false)
  })

  it('prices both sides against the one ruler the file carries', () => {
    expect(card.subject.metrics).toEqual(aggregateShotMetrics(game.sides[0].shots, game.zoneBaseline))
    expect(card.opponent.metrics).toEqual(aggregateShotMetrics(game.sides[1].shots, game.zoneBaseline))
    expect(card.opponent.metrics.selection.leagueDietExpectedPps).toBe(
      card.subject.metrics.selection.leagueDietExpectedPps,
    )
  })

  it('states no rank below the minimum game count', () => {
    expect(card.dots).toHaveLength(1)
    expect(SEASON_RANK_MIN_GAMES).toBeGreaterThan(1)
    expect(card.ranks).toBeNull()
  })

  it('reads the line, the credit, and the unpriced rows off the file', () => {
    expect(card.subject.line).toMatchObject({ trips: 5, shooting: 3, bonus: 1, andOne: 1, other: 0 })
    expect(card.opponent.line.technicalFtm).toBe(1)
    expect(card.subject.zoneConflicts).toBe(1)
    const makes = game.sides[0].shots.filter((s) => s.made)
    expect(card.subject.credit).toEqual({
      makes: makes.length,
      assisted: makes.filter((s) => s.assistStatus === 'assisted').length,
      unknown: 0,
    })
  })

  it('lists every player with an attempt, scorers first, with his own expected and scored', () => {
    const names = card.subject.players.map((p) => p.name)
    expect(names).toEqual(['Keyonte George', 'Kyle Filipowski', 'Taylor Hendricks'])
    const hendricks = card.subject.players.find((p) => p.name === 'Taylor Hendricks')!
    expect([hendricks.fga, hendricks.trips, hendricks.expected, hendricks.scored]).toEqual([0, 1, null, null])
    const george = card.subject.players[0]!
    const own = aggregateShotMetrics(
      game.sides[0].shots.filter((s) => s.playerId === george.playerId),
      game.zoneBaseline,
    )
    expect(george.evalAttempts).toBe(own.evalAttempts)
    expect(george.expected).toBeCloseTo(own.selection.playerDietExpectedPps! * own.evalAttempts, 10)
    // The conflict row is his eighteenth attempt but never priced.
    expect(george.fga).toBe(george.evalAttempts + 1)
  })

  it('carries the prior season behind only when it is given', () => {
    expect(card.priorDots).toEqual([])
    expect(card.priorSeason).toBeNull()
    const prior = { index: relabelIndex(index, '2024-25'), payload: teamPayloadFromGame(game, '2024-25') }
    const withPrior = buildReportCard(game, index, payload, prior)
    expect(withPrior.priorSeason).toBe('2024-25')
    expect(withPrior.priorDots.map((d) => d.season)).toEqual(['2024-25'])
  })

  it('refuses a game outside the index, and an index that disagrees with the payload', () => {
    const other = { ...index, games: [{ ...index.games[0]!, gameId: '0022500493' }] }
    expect(() => buildReportCard(game, other, payload)).toThrow()
    expect(() => seasonDots(relabelIndex(index, '2024-25'), payload)).toThrow(/disagree/)
  })

  it('forms a slug from the date and the opponent', () => {
    expect(gameSlug('2026-10-21', 'MEM')).toBe('2026-10-21-mem')
  })
})
