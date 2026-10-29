// The player season module (ADR-0095) over the game and index goldens (the
// fixture game 0022500492): the slug rule, who has a page, and that a game
// row prices his slice exactly as his line on the report card does.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseGamePayload } from './gamePayload'
import { buildPlayerSeason, playerSlug, seasonShooters } from './playerSeason'
import { buildReportCard } from './reportCard'
import { relabelIndex, teamPayloadFromGame } from './teamPayloadFromGame.testutil'
import { parseTeamSeasonIndex } from './teamSeasonIndex'

const read = (rel: string) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf-8')) as unknown
const game = parseGamePayload(read('../../tests/fixtures/game.golden.json'))
const index = parseTeamSeasonIndex(read('../../tests/fixtures/team-index.golden.json'))
const payload = teamPayloadFromGame(game)

describe('playerSlug', () => {
  it('folds names into URL segments that survive the feed’s renames', () => {
    expect(playerSlug('Keyonte George')).toBe('keyonte-george')
    expect(playerSlug('Moussa Cissé')).toBe('moussa-cisse')
    expect(playerSlug('Moussa Cisse')).toBe('moussa-cisse')
    expect(playerSlug('Terrence Shannon Jr.')).toBe('terrence-shannon-jr')
    expect(playerSlug('Terrence Shannon Jr')).toBe('terrence-shannon-jr')
    expect(playerSlug("D'Angelo Russell")).toBe('dangelo-russell')
    expect(playerSlug('Kelly Oubre  Jr.')).toBe('kelly-oubre-jr')
  })
})

describe('seasonShooters', () => {
  it('lists every player with a shot, most shots first', () => {
    const shooters = seasonShooters(payload)
    expect(shooters.map((p) => p.slug)).toEqual(['keyonte-george', 'kyle-filipowski'])
    expect(shooters.reduce((n, p) => n + p.shots, 0)).toBe(payload.shots.length)
  })

  it('refuses two shooters sharing a slug', () => {
    const twin = { ...payload, shots: [...payload.shots, { ...payload.shots[0]!, playerId: 1, playerName: 'Keyonte George' }] }
    expect(() => seasonShooters(twin)).toThrow(/share the slug keyonte-george/)
  })
})

describe('buildPlayerSeason', () => {
  it('prices each game as the report card prices his line', () => {
    const season = buildPlayerSeason('keyonte-george', payload, index)!
    const card = buildReportCard(game, index, payload)
    const night = card.subject.players.find((p) => p.playerId === season.player.playerId)!
    expect(season.games).toHaveLength(1)
    const row = season.games[0]!
    expect([row.expected, row.scored]).toEqual([night.expected, night.scored])
    expect([row.line.points, row.line.fgm, row.line.fga]).toEqual([night.points, night.fgm, night.fga])
    expect(season.dots).toHaveLength(1)
    expect(season.metrics.totalAttempts).toBe(payload.shots.filter((s) => s.playerId === season.player.playerId).length)
  })

  it('counts his zone-point conflicts as box FGA less his shot rows', () => {
    const season = buildPlayerSeason('keyonte-george', payload, index)!
    const conflicts = game.sides[0].zoneConflicts.filter((c) => c.playerId === season.player.playerId).length
    expect(season.zoneConflicts).toBe(conflicts)
  })

  it('has no page for a player without a shot, and draws his prior season behind when he shot in it', () => {
    expect(buildPlayerSeason('taylor-hendricks', payload, index)).toBeNull()
    expect(buildPlayerSeason('nobody', payload, index)).toBeNull()
    const prior = { index: relabelIndex(index, '2024-25'), payload: teamPayloadFromGame(game, '2024-25') }
    const season = buildPlayerSeason('kyle-filipowski', payload, index, prior)!
    expect(season.priorSeason).toBe('2024-25')
    expect(season.priorDots).toHaveLength(1)
  })
})
