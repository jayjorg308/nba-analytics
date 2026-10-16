// The team seasons a checkout has published: every season directory under
// public/data/_teams/<tricode>/ holding a committed season index (ADR-0088).
// Node-only (it reads the filesystem; the app never imports it).
//
// The deployed-pair guards and the card generator read this, not the
// registry's seasons, because the season loop publishes a living season's
// games before the registry lists that season (ADR-0091): the registry
// gains a season by config change once its first payloads deploy, and a
// data commit must be guarded, and its cards drawn, from its first game.

import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { SEASON, type TeamConfig } from './registry'

export const TEAMS_ROOT = path.resolve(process.cwd(), 'public/data/_teams')

/** The team's published seasons, oldest first. */
export function publishedSeasons(team: TeamConfig, teamsRoot: string = TEAMS_ROOT): string[] {
  const dir = path.join(teamsRoot, team.tricode.toLowerCase())
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => SEASON.test(name) && existsSync(path.join(dir, name, 'index.json')))
    .sort()
}
