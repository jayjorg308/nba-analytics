// Path-based routing without a router (ADR-0022/0060/0087): real pages at
// real URLs — the home team's canonical season at BASE_URL, the directory
// of arguments at BASE_URL<arguments>, each hero's canonical alias at
// BASE_URL<slug>, each season argument at its BASE_URL<slug>/<season>
// permalink. Navigation is plain <a> full-page
// loads, so the app reads the path once at mount; there is no history
// handling to do.

export interface HeroRoute {
  /** '' for the site root; otherwise the first segment (a hero's, or a
   * reserved route's). */
  slug: string
  /** The season permalink segment, when the path carries one (ADR-0060). */
  season?: string
}

/** The one static page route (ADR-0071): the site's self-explanation
 * surface, resolved by the app before any registry lookup. */
export const METHODOLOGY_ROUTE = 'methodology'

/** The directory of arguments (ADR-0087): the site root until the Jazz home
 * took it, now a reserved route of its own. */
export const ARGUMENTS_ROUTE = 'arguments'

/** The comparison page (ADR-0076): comparison state is owned by the URL's
 * query string; this reserves the path segment. Query interpretation lives
 * in comparisonRoute.ts, not here. */
export const COMPARE_ROUTE = 'compare'

/** The retired game cards (ADR-0086, retired by ADR-0096): no page renders
 * here any more. vercel.json forwards /game to the site root and the three
 * Jazz heroes' cards to their nights; the segment stays reserved so no hero
 * slug can sit under those redirects. */
export const GAME_ROUTE = 'game'

/** Single-segment paths owned by static pages. A hero slug may never
 * collide with one — guarded by the registry coherence tests, so a future
 * hero:add for a colliding name fails loudly instead of shadowing a page. */
/** The team surface (ADR-0081/0082): /jazz renders the canonical team
 * season, /jazz/<season> a season, /jazz/<gameId> one game row expanded.
 * Team slugs are reserved like the static routes. */
export const TEAM_ROUTES: readonly string[] = ['jazz']

export const RESERVED_ROUTES: readonly string[] = [
  METHODOLOGY_ROUTE,
  ARGUMENTS_ROUTE,
  COMPARE_ROUTE,
  GAME_ROUTE,
  ...TEAM_ROUTES,
]

/**
 * The route after BASE_URL: { slug: '' } for the root, { slug } for a
 * canonical alias, { slug, season } for a season permalink. Tolerates
 * trailing and doubled slashes; never throws on odd input — an unknown or
 * malformed path is the caller's "no such page" case, not an error. A path
 * deeper than two segments stays whole in `slug`, so the directory's
 * unknown-path note names what the reader typed.
 */
export function parseRoute(pathname: string, baseUrl: string): HeroRoute {
  const rest = pathname.startsWith(baseUrl)
    ? pathname.slice(baseUrl.length)
    : pathname.replace(/^\//, '')
  const segments = rest.split('/').filter((s) => s !== '')
  if (segments.length === 0) return { slug: '' }
  if (segments.length === 1) return { slug: segments[0]! }
  if (segments.length === 2) return { slug: segments[0]!, season: segments[1]! }
  return { slug: segments.join('/') }
}

/** The NBA season a game date belongs to: seasons run October–June, so
 * August is the boundary that never splits one. '2026-03-15' -> '2025-26'. */
export function seasonOfGameDate(date: string): string {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const start = month >= 8 ? year : year - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}
