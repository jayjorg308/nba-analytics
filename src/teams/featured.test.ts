// The featured-list guard (ADR-0087; docs/plans/jazz-home-transition.md,
// "Defaults taken"): a season home's featured players are exactly the
// season's arguments, living and frozen, so featuring and the arguments can
// never disagree. Living arguments are season.config.json's hero seasons for
// that season; frozen ones are registered season arguments that name this
// team's page (teamPage, ADR-0095). The config does not name a hero season's
// team, so its converse direction (every living Jazz argument is featured)
// reads the season's roster and shots, and skips where the team payload is
// absent; everything else runs on a clean clone.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { playerSlug } from '../domain/playerSeason'
import { parseTeamShotPayload } from '../domain/teamShotPayload'
import { HEROES } from '../heroes/registry'
import { photoFieldProblems, photoSentinelProblems } from './gamePhotoAuthoring'
import { TEAMS } from './registry'
import type { TeamConfig } from './registry'

interface LiveSeason {
  slug: string
  player: string
  playerId: number
  season: string
}

const CONFIG = JSON.parse(readFileSync(path.resolve(process.cwd(), 'season.config.json'), 'utf-8')) as {
  liveSeasons: LiveSeason[]
}
const PUBLIC = path.resolve(process.cwd(), 'public')

function living(season: string): LiveSeason[] {
  return CONFIG.liveSeasons.filter((e) => e.season === season)
}

/** Registered season arguments naming this team's page for the season. */
function frozen(team: TeamConfig, season: string): { slug: string; playerName: string }[] {
  return HEROES.filter((h) => h.seasons.some((s) => s.season === season && s.teamPage === team.slug)).map((h) => ({
    slug: h.slug,
    playerName: h.playerName,
  }))
}

describe('season homes (ADR-0087)', () => {
  it('every registered season has a home config, and nothing else does', () => {
    for (const team of TEAMS) {
      expect(Object.keys(team.homes).sort()).toEqual([...team.seasons].sort())
    }
  })

  it('features each player once, by the slug his name folds to, with a committed headshot', () => {
    for (const team of TEAMS) {
      for (const [season, home] of Object.entries(team.homes)) {
        const slugs = home.featured.map((p) => p.slug)
        expect(new Set(slugs).size, `${team.slug} ${season}`).toBe(slugs.length)
        for (const p of home.featured) {
          expect(p.slug).toBe(playerSlug(p.playerName))
          expect(existsSync(path.join(PUBLIC, 'img', `${p.slug}-headshot.png`)), `${p.slug} headshot`).toBe(true)
        }
      }
    }
  })

  it('features only the season’s arguments, living or frozen, under their listed names', () => {
    for (const team of TEAMS) {
      for (const [season, home] of Object.entries(team.homes)) {
        const names = new Map<string, string>([
          ...living(season).map((e) => [e.slug, e.player] as const),
          ...frozen(team, season).map((h) => [h.slug, h.playerName] as const),
        ])
        for (const p of home.featured) {
          expect(names.has(p.slug), `${team.slug} ${season} features ${p.slug}, no argument of the season`).toBe(true)
          expect(p.playerName).toBe(names.get(p.slug))
        }
      }
    }
  })

  it('features every frozen argument that names the team page', () => {
    for (const team of TEAMS) {
      for (const [season, home] of Object.entries(team.homes)) {
        const featured = new Set(home.featured.map((p) => p.slug))
        for (const h of frozen(team, season)) {
          expect(featured.has(h.slug), `${team.slug} ${season} omits ${h.slug}`).toBe(true)
        }
      }
    }
  })

  it('holds every season banner photograph to the house forms, the game photo tripwire’s checks', () => {
    const fileExists = (p: string) => existsSync(path.join(PUBLIC, p))
    for (const team of TEAMS) {
      for (const [season, home] of Object.entries(team.homes)) {
        if (home.banner === undefined) continue
        const label = `${team.slug} ${season} banner`
        expect(photoSentinelProblems(label, home.banner)).toEqual([])
        expect(photoFieldProblems(label, home.banner, fileExists)).toEqual([])
      }
    }
    // The checks fire: a stubbed banner is caught, so no banner on file is
    // never a vacuous pass.
    const stub = {
      imagePath: 'img/TODO(scaffold).jpg',
      imageAlt: 'TODO(scaffold)',
      imagePosition: '50% 50%',
      imagePositionWide: '50% 50%',
    }
    expect(photoSentinelProblems('stub', stub)).toHaveLength(2)
    expect(photoFieldProblems('stub', { ...stub, imagePath: 'img/missing.jpg', imageAlt: 'x' }, fileExists)).toEqual([
      'stub.imagePath img/missing.jpg is not under public/',
    ])
  })

  for (const team of TEAMS) {
    for (const season of team.seasons) {
      const file = path.join(PUBLIC, 'data', '_teams', team.tricode.toLowerCase(), `${season}.json`)
      describe.skipIf(!existsSync(file))(`${team.slug} ${season} (deployed roster and shots)`, () => {
        it('features every living argument of a player on the roster or with a shot for the team', () => {
          const payload = parseTeamShotPayload(JSON.parse(readFileSync(file, 'utf-8')))
          const ids = new Set([...payload.roster.map((r) => r.playerId), ...payload.shots.map((s) => s.playerId)])
          const featured = new Set(team.homes[season]!.featured.map((p) => p.slug))
          for (const e of living(season).filter((e) => ids.has(e.playerId))) {
            expect(featured.has(e.slug), `${team.slug} ${season} omits living ${e.slug}`).toBe(true)
          }
        })
      })
    }
  }
})
