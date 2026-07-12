// Path-based routing without a router (ADR-0022): the directory of arguments
// is real pages at real URLs — the index at BASE_URL, each hero page at
// BASE_URL<slug>. Navigation is plain <a> full-page loads, so the app reads
// the path once at mount; there is no history handling to do.

/**
 * The route segment after BASE_URL: '' for the index, 'cody-williams' for a
 * hero page. Tolerates trailing slashes; never throws on odd input — an
 * unknown or malformed path is the caller's "no such hero" case, not an error.
 */
export function routeSlug(pathname: string, baseUrl: string): string {
  const rest = pathname.startsWith(baseUrl)
    ? pathname.slice(baseUrl.length)
    : pathname.replace(/^\//, '')
  return rest.replace(/\/+$/, '')
}
