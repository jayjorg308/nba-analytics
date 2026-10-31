// Team route parsing (docs/plans/jazz-first-site.md, URL contract; the
// player routes, docs/plans/jazz-home-transition.md decision 18): what the
// segments after a reserved team slug name. parseRoute resolves the
// reserved first segment and hands the rest here. The segment patterns
// never collide: a season is \d{4}-\d{2}, a game slug
// \d{4}-\d{2}-\d{2}-[a-z]{2,3}, a game id ten digits (the links the first
// team page published, kept working), and a player slug starts with a
// letter. A player's canonical alias is /<team>/<player-slug> (his current
// season, rendered in place); his season permalink is
// /<team>/<season>/<player-slug>, ADR-0060's pattern at team grain. A
// player slug after a game slug is his night in that game,
// /<team>/<game-slug>/<player-slug> (ADR-0096).

import { seasonOfGameId } from '../domain/aggregateTeam'
import { GAME_ID, SEASON } from '../teams/registry'
import { seasonOfGameDate } from './routes'

export const GAME_SLUG = /^(\d{4}-\d{2}-\d{2})-([a-z]{2,3})$/
export const PLAYER_SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

export type TeamRoute =
  | { kind: 'canonical' }
  | { kind: 'season'; season: string }
  | { kind: 'game'; season: string; slug: string }
  | { kind: 'gameId'; season: string; gameId: string }
  | { kind: 'player'; slug: string }
  | { kind: 'seasonPlayer'; season: string; slug: string }
  | { kind: 'night'; season: string; game: string; slug: string }
  | { kind: 'unknown' }

/** The team route for the segments after the team slug (none for the bare
 * /<team>). A season, game, or game id names a season by its own grammar;
 * whether that season is on file is the caller's question. */
export function parseTeamRoute(segment: string | undefined, third?: string): TeamRoute {
  if (segment === undefined) return { kind: 'canonical' }
  if (third !== undefined) {
    if (!PLAYER_SLUG.test(third)) return { kind: 'unknown' }
    if (SEASON.test(segment)) return { kind: 'seasonPlayer', season: segment, slug: third }
    const game = GAME_SLUG.exec(segment)
    return game === null
      ? { kind: 'unknown' }
      : { kind: 'night', season: seasonOfGameDate(game[1]!), game: segment, slug: third }
  }
  if (SEASON.test(segment)) return { kind: 'season', season: segment }
  const slug = GAME_SLUG.exec(segment)
  if (slug !== null) return { kind: 'game', season: seasonOfGameDate(slug[1]!), slug: segment }
  if (GAME_ID.test(segment)) return { kind: 'gameId', season: seasonOfGameId(segment), gameId: segment }
  if (PLAYER_SLUG.test(segment)) return { kind: 'player', slug: segment }
  return { kind: 'unknown' }
}
