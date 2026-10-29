// Guards every deployed player season page (ADR-0095) over every team season
// published on disk: the shooters' slugs are unique, every one of his shots
// lands in a game he has a box line for, his season's games are exactly the
// games he appeared in, and each game's priced numbers equal his line on that
// game's report card, so a reader moving between the two pages never sees a
// number change. Skips on clean clones.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { publishedSeasons, TEAMS_ROOT as teamsRoot } from '../teams/published'
import { TEAMS } from '../teams/registry'
import { parseGamePayload } from './gamePayload'
import { buildPlayerSeason, seasonShooters } from './playerSeason'
import { buildReportCard } from './reportCard'
import type { PlayerNight } from './reportCard'
import { parseTeamSeasonIndex } from './teamSeasonIndex'
import { parseTeamShotPayload } from './teamShotPayload'

const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf-8')) as unknown

const published = TEAMS.flatMap((team) =>
  publishedSeasons(team).map((season) => ({ team, season, root: path.join(teamsRoot, team.tricode.toLowerCase()) })),
)

describe.skipIf(published.length === 0)('deployed player seasons', () => {
  for (const { team, season, root } of published) {
    it(`${team.slug} ${season}: every shooter's games equal his report card lines`, () => {
      const index = parseTeamSeasonIndex(readJson(path.join(root, season, 'index.json')))
      const payload = parseTeamShotPayload(readJson(path.join(root, `${season}.json`)))
      const nights = new Map<string, PlayerNight[]>()
      for (const g of index.games) {
        const game = parseGamePayload(readJson(path.join(root, season, 'games', `${g.gameId}.json`)))
        nights.set(g.gameId, buildReportCard(game, index, payload).subject.players)
      }
      const shooters = seasonShooters(payload)
      expect(shooters.length).toBeGreaterThan(0)
      for (const p of shooters) {
        const s = buildPlayerSeason(p.slug, payload, index)!
        const appeared = index.games.filter((g) => g.players.some((l) => l.playerId === p.playerId))
        expect(s.games.map((r) => r.gameId), p.slug).toEqual(appeared.map((g) => g.gameId))
        expect(s.metrics.totalAttempts, p.slug).toBe(p.shots)
        expect(s.zoneConflicts, p.slug).toBeGreaterThanOrEqual(0)
        for (const row of s.games) {
          const night = nights.get(row.gameId)!.find((n) => n.playerId === p.playerId)
          if (night === undefined) {
            // The card lists players with an attempt; a box line with none
            // has nothing to price.
            expect([row.line.fga, row.line.fta, row.expected], `${p.slug} ${row.slug}`).toEqual([0, 0, null])
            continue
          }
          expect([row.expected, row.scored], `${p.slug} ${row.slug}`).toEqual([night.expected, night.scored])
          expect([row.line.points, row.line.fga, row.line.fta], `${p.slug} ${row.slug}`).toEqual([night.points, night.fga, night.fta])
        }
      }
    })
  }
})
