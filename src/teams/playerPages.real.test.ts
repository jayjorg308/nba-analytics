// The argument-to-tool links (ADR-0095), guarded both ways over the deployed
// team payloads: a season argument names a team page exactly when its
// player shot for that team in that season, so "Game by game" never leads
// to a missing page, and no Jazz argument goes without it. Skips on clean
// clones.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { seasonShooters } from '../domain/playerSeason'
import { parseTeamShotPayload } from '../domain/teamShotPayload'
import { HEROES } from '../heroes/registry'
import { TEAMS_ROOT } from './published'
import { TEAMS } from './registry'

const seasons = TEAMS.flatMap((team) =>
  team.seasons
    .map((season) => ({ team, season, file: path.join(TEAMS_ROOT, team.tricode.toLowerCase(), `${season}.json`) }))
    .filter(({ file }) => existsSync(file)),
)

describe.skipIf(seasons.length === 0)('argument to player page links', () => {
  it('name a team page exactly when the player shot for that team that season', () => {
    const pages = new Set<string>()
    for (const { team, season, file } of seasons) {
      for (const p of seasonShooters(parseTeamShotPayload(JSON.parse(readFileSync(file, 'utf-8'))))) {
        pages.add(`${team.slug}/${season}/${p.slug}`)
      }
    }
    for (const hero of HEROES) {
      for (const s of hero.seasons) {
        const expected = TEAMS.filter((t) => pages.has(`${t.slug}/${s.season}/${hero.slug}`)).map((t) => t.slug)
        expect(s.teamPage === undefined ? [] : [s.teamPage], `${hero.slug} ${s.season}`).toEqual(expected)
      }
    }
  })
})
