// Path-based routing without a router (ADR-0022/0060): the directory of
// arguments is real pages at real URLs — the index at BASE_URL, each hero's
// canonical alias at BASE_URL<slug>, each season argument at its
// BASE_URL<slug>/<season> permalink. Navigation is plain <a> full-page
// loads, so the app reads the path once at mount; there is no history
// handling to do.

export interface HeroRoute {
  /** '' for the index; otherwise the hero segment. */
  slug: string
  /** The season permalink segment, when the path carries one (ADR-0060). */
  season?: string
}

/** The one static page route (ADR-0071): the site's self-explanation
 * surface, resolved by the app before any registry lookup. */
export const METHODOLOGY_ROUTE = 'methodology'

/** The comparison page (ADR-0076): comparison state is owned by the URL's
 * query string; this reserves the path segment. Query interpretation lives
 * in comparisonRoute.ts, not here. */
export const COMPARE_ROUTE = 'compare'

/** Game cards (ADR-0086): /game is the landing with the roster picker,
 * /game/<player-slug>/<date> a card — the season-permalink ordering (player,
 * then time qualifier). Card state is owned entirely by the path. */
export const GAME_ROUTE = 'game'

/** Single-segment paths owned by static pages. A hero slug may never
 * collide with one — guarded by the registry coherence tests, so a future
 * hero:add for a colliding name fails loudly instead of shadowing a page. */
export const RESERVED_ROUTES: readonly string[] = [
  METHODOLOGY_ROUTE,
  COMPARE_ROUTE,
  GAME_ROUTE,
]

/**
 * The route after BASE_URL: { slug: '' } for the index, { slug } for a
 * canonical alias, { slug, season } for a season permalink. Tolerates
 * trailing and doubled slashes; never throws on odd input — an unknown or
 * malformed path is the caller's "no such page" case, not an error. A path
 * deeper than two segments stays whole in `slug`, so the index's
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

export type GameRoute =
  | { kind: 'landing' }
  | { kind: 'card'; slug: string; date: string }

/**
 * The game routes (ADR-0086), resolved before the registry like every
 * reserved route: /game is the landing, /game/<slug>/<date> a card.
 * Undefined for anything else — including a malformed date or a deeper
 * path, which fall to the directory's unknown-path note like any bad URL.
 */
export function parseGameRoute(pathname: string, baseUrl: string): GameRoute | undefined {
  const rest = pathname.startsWith(baseUrl)
    ? pathname.slice(baseUrl.length)
    : pathname.replace(/^\//, '')
  const segments = rest.split('/').filter((s) => s !== '')
  if (segments[0] !== GAME_ROUTE) return undefined
  if (segments.length === 1) return { kind: 'landing' }
  if (segments.length === 3 && /^\d{4}-\d{2}-\d{2}$/.test(segments[2]!)) {
    return { kind: 'card', slug: segments[1]!, date: segments[2]! }
  }
  return undefined
}

/** The NBA season a game date belongs to: seasons run October–June, so
 * August is the boundary that never splits one. '2026-03-15' -> '2025-26'. */
export function seasonOfGameDate(date: string): string {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const start = month >= 8 ? year : year - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}
