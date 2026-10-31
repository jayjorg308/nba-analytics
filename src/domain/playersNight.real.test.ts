// Guards every deployed player's night (ADR-0096) over every team season
// published on disk: every subject box line of every game has a night that
// builds (buildPlayersNight throws when a night disagrees with his dot or his
// game-log row, so building is the identity check), every shooter's game-log
// row names a night that resolves under his season page's slug, and every
// report card's player line names one too. Skips on clean clones.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTeamRoute } from '../app/teamRoute'
import { publishedSeasons, TEAMS_ROOT as teamsRoot } from '../teams/published'
import { TEAMS } from '../teams/registry'
import { parseGamePayload } from './gamePayload'
import type { GamePayload } from './gamePayload'
import { buildPlayerSeason, playerSlug, seasonShooters } from './playerSeason'
import { buildPlayersNight } from './playersNight'
import type { PlayersNight } from './playersNight'
import { buildReportCard } from './reportCard'
import { parseTeamSeasonIndex } from './teamSeasonIndex'
import { parseTeamShotPayload } from './teamShotPayload'

const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf-8')) as unknown

const published = TEAMS.flatMap((team) =>
  publishedSeasons(team).map((season) => ({ team, season, root: path.join(teamsRoot, team.tricode.toLowerCase()) })),
)

describe.skipIf(published.length === 0)('deployed player nights', () => {
  for (const { team, season, root } of published) {
    // A full season is about 800 nights, each building his season to check
    // itself against: about 1s alone, 3s under the full suite's parallel
    // load (2026-10-31), so the default 5s would flake on a slower runner.
    it(`${team.slug} ${season}: every appearance has a night equal to his season page`, { timeout: 30_000 }, () => {
      const index = parseTeamSeasonIndex(readJson(path.join(root, season, 'index.json')))
      const payload = parseTeamShotPayload(readJson(path.join(root, `${season}.json`)))
      const games = new Map<string, GamePayload>()
      for (const g of index.games) {
        games.set(g.gameId, parseGamePayload(readJson(path.join(root, season, 'games', `${g.gameId}.json`))))
      }

      // Each night once, keyed by the slug its URL carries.
      const nights = new Map<string, PlayersNight>()
      for (const g of index.games) {
        const game = games.get(g.gameId)!
        for (const p of g.players) {
          const night = buildPlayersNight(playerSlug(p.name), game, index, payload)
          expect(night, `${g.slug} ${p.name}`).not.toBeNull()
          expect([night!.line.points, night!.line.fga, night!.line.fta], `${g.slug} ${p.name}`).toEqual([p.points, p.fga, p.fta])
          nights.set(`${g.slug}/${night!.player.slug}`, night!)
        }
        // The report card's player names open nights (decision 6).
        for (const p of buildReportCard(game, index, payload).subject.players) {
          expect(nights.get(`${g.slug}/${playerSlug(p.name)}`)?.player.playerId, `${g.slug} ${p.name}`).toBe(p.playerId)
        }
      }
      expect(nights.size).toBe(index.games.reduce((n, g) => n + g.players.length, 0))

      // Every game-log row links his night under his season page's slug, and
      // that URL parses as a night of this season (decision 6).
      for (const shooter of seasonShooters(payload)) {
        const ps = buildPlayerSeason(shooter.slug, payload, index)!
        for (const row of ps.games) {
          const url = `${row.slug}/${shooter.slug}`
          expect(parseTeamRoute(row.slug, shooter.slug), url).toEqual({ kind: 'night', season, game: row.slug, slug: shooter.slug })
          const night = nights.get(url)
          expect(night?.player.playerId, url).toBe(shooter.playerId)
          expect([night!.expected, night!.scored], url).toEqual([row.expected, row.scored])
        }
      }
    })
  }
})
