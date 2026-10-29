import { describe, expect, it } from 'vitest'
import { ARGUMENTS_ROUTE, METHODOLOGY_ROUTE, parseRoute, RESERVED_ROUTES } from './routes'

describe('parseRoute', () => {
  it('resolves the root to the empty slug (the home team’s season, ADR-0087)', () => {
    expect(parseRoute('/', '/')).toEqual({ slug: '' })
  })

  it('parses the reserved methodology route like any single segment (ADR-0071)', () => {
    // The parser stays route-table-free: App.tsx resolves the reserved
    // slug before the registry lookup.
    expect(parseRoute('/methodology', '/')).toEqual({ slug: METHODOLOGY_ROUTE })
  })

  it('reserves the directory of arguments, moved off the root (ADR-0087)', () => {
    expect(parseRoute('/arguments', '/')).toEqual({ slug: ARGUMENTS_ROUTE })
    expect(RESERVED_ROUTES).toContain(ARGUMENTS_ROUTE)
  })

  it('resolves a hero path to its canonical alias (no season)', () => {
    expect(parseRoute('/cody-williams', '/')).toEqual({ slug: 'cody-williams' })
  })

  it('resolves a season permalink (ADR-0060)', () => {
    expect(parseRoute('/ace-bailey/2025-26', '/')).toEqual({
      slug: 'ace-bailey',
      season: '2025-26',
    })
  })

  it('tolerates trailing and doubled slashes', () => {
    expect(parseRoute('/cody-williams/', '/')).toEqual({ slug: 'cody-williams' })
    expect(parseRoute('/cody-williams///', '/')).toEqual({ slug: 'cody-williams' })
    expect(parseRoute('/ace-bailey/2025-26/', '/')).toEqual({
      slug: 'ace-bailey',
      season: '2025-26',
    })
    expect(parseRoute('/ace-bailey//2025-26', '/')).toEqual({
      slug: 'ace-bailey',
      season: '2025-26',
    })
  })

  it('strips a subpath BASE_URL (Vite guarantees the trailing slash)', () => {
    expect(parseRoute('/nba/', '/nba/')).toEqual({ slug: '' })
    expect(parseRoute('/nba/cody-williams', '/nba/')).toEqual({ slug: 'cody-williams' })
    expect(parseRoute('/nba/ace-bailey/2025-26', '/nba/')).toEqual({
      slug: 'ace-bailey',
      season: '2025-26',
    })
  })

  it('falls back to stripping the leading slash when the base does not match', () => {
    // A path outside BASE_URL should still resolve to something lookupable —
    // the registry miss then lands on the index, never a crash.
    expect(parseRoute('/keyonte-george', '/nba/')).toEqual({ slug: 'keyonte-george' })
  })

  it('keeps a too-deep path whole so the unknown-path note can name it', () => {
    expect(parseRoute('/a/b/c', '/')).toEqual({ slug: 'a/b/c' })
  })
})
