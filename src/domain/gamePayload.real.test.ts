// Guards the committed game payloads and season indexes (ADR-0088/0089):
// for every team season with an index, the index's game set equals the
// game files on disk and the team shot payload's game set; every game file
// strict-parses (its receipt identities with it) and agrees with its index
// row; the subject's shots equal the team shot payload's slice for the
// game; and each file's ruler equals the index's, so a quadrant dot and its
// card price the same rows against the same pairs. "Every team season with
// an index" is read from disk, registered or not: the season loop publishes
// a living season before the registry lists it (ADR-0091), and its data
// commits are guarded from the first game. Skips on clean clones.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { publishedSeasons, TEAMS_ROOT as teamsRoot } from '../teams/published'
import { TEAMS } from '../teams/registry'
import { type GamePayload, parseGamePayload } from './gamePayload'
import { parseTeamSeasonIndex } from './teamSeasonIndex'
import { parseTeamShotPayload } from './teamShotPayload'

const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf-8')) as unknown

/** A copy without one key: the fields two contracts share. */
function omit<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const copy = { ...obj }
  delete copy[key]
  return copy
}

const published = TEAMS.flatMap((team) =>
  publishedSeasons(team).map((season) => ({
    team,
    season,
    dir: path.join(teamsRoot, team.tricode.toLowerCase(), season),
  })),
)

describe.skipIf(published.length === 0)('deployed game payloads', () => {
  it('cover every registered team season', () => {
    for (const team of TEAMS) {
      for (const season of team.seasons) {
        const index = path.join(teamsRoot, team.tricode.toLowerCase(), season, 'index.json')
        expect(existsSync(index), `${team.slug} ${season} has no season index`).toBe(true)
      }
    }
  })

  for (const { team, season, dir } of published) {
    describe(`${team.slug} ${season}`, () => {
      const index = parseTeamSeasonIndex(readJson(path.join(dir, 'index.json')))
      const payload = parseTeamShotPayload(
        readJson(path.join(teamsRoot, team.tricode.toLowerCase(), `${season}.json`)),
      )
      const games = new Map<string, GamePayload>(
        readdirSync(path.join(dir, 'games')).map((file) => {
          const game = parseGamePayload(readJson(path.join(dir, 'games', file)))
          return [game._meta.gameId, game]
        }),
      )

      it('has one game file per index row, and the team payload has the same games', () => {
        const indexIds = index.games.map((g) => g.gameId).sort()
        expect([...games.keys()].sort()).toEqual(indexIds)
        expect([...new Set(payload.shots.map((s) => s.gameId))].sort()).toEqual(indexIds)
        expect(index._meta.dataThrough).toBe(payload._meta.dataThrough)
        expect(index._meta.teamId).toBe(team.teamId)
      })

      it('agrees with its index row, game by game', () => {
        for (const row of index.games) {
          const game = games.get(row.gameId)!
          const [subject, opponent] = game.sides
          expect(game._meta.teamId, row.gameId).toBe(team.teamId)
          expect(
            [game._meta.gameDate, game._meta.opponentTricode, game._meta.home],
            row.gameId,
          ).toEqual([row.gameDate, row.opponent, row.home])
          expect([subject.box, opponent.box.points], row.gameId).toEqual([row.box, row.opponentScore])
          const ruler = omit(game._meta.ruler, 'sourceSnapshot')
          expect({ ...ruler, zoneBaseline: game.zoneBaseline }, row.gameId).toEqual(row.ruler)
        }
      })

      it("carries the subject's shots exactly as the team shot payload does", () => {
        for (const [gameId, game] of games) {
          const ours = game.sides[0].shots.map((s) => omit(s, 'assistStatus'))
          const theirs = payload.shots.filter((s) => s.gameId === gameId).map((s) => omit(s, 'playerName'))
          expect(ours, gameId).toEqual(theirs)
        }
      })

      it('prices every game against its own pre-game ruler', () => {
        for (const row of index.games) {
          if (row.ruler.kind === 'pre-game') expect(row.ruler.season).toBe(season)
        }
      })
    })
  }
})
