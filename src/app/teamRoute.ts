// Team route parsing (docs/plans/jazz-first-site.md, URL contract): what the
// segment after a reserved team slug names. parseRoute resolves the
// reserved first segment and hands the second here. The segment patterns
// never collide: a season is \d{4}-\d{2}, a game slug
// \d{4}-\d{2}-\d{2}-[a-z]{2,3}, a game id ten digits (the links the first
// team page published, kept working), and a player slug, later, starts
// with a letter.

import { seasonOfGameId } from '../domain/aggregateTeam'
import { GAME_ID, SEASON } from '../teams/registry'
import { seasonOfGameDate } from './routes'

export const GAME_SLUG = /^(\d{4}-\d{2}-\d{2})-([a-z]{2,3})$/

export type TeamRoute =
  | { kind: 'canonical' }
  | { kind: 'season'; season: string }
  | { kind: 'game'; season: string; slug: string }
  | { kind: 'gameId'; season: string; gameId: string }
  | { kind: 'unknown' }

/** The team route for the segment after the team slug (undefined for the
 * bare /<team>). A season, game, or game id names a season by its own
 * grammar; whether that season is on file is the caller's question. */
export function parseTeamRoute(segment: string | undefined): TeamRoute {
  if (segment === undefined) return { kind: 'canonical' }
  if (SEASON.test(segment)) return { kind: 'season', season: segment }
  const slug = GAME_SLUG.exec(segment)
  if (slug !== null) return { kind: 'game', season: seasonOfGameDate(slug[1]!), slug: segment }
  if (GAME_ID.test(segment)) return { kind: 'gameId', season: seasonOfGameId(segment), gameId: segment }
  return { kind: 'unknown' }
}
