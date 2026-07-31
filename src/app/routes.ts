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

/** Single-segment paths owned by static pages. A hero slug may never
 * collide with one — guarded by the registry coherence tests, so a future
 * hero:add for a colliding name fails loudly instead of shadowing a page. */
export const RESERVED_ROUTES: readonly string[] = [METHODOLOGY_ROUTE]

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
