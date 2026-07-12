import { describe, expect, it } from 'vitest'
import { routeSlug } from './routes'

describe('routeSlug', () => {
  it('resolves the root to the index (empty slug)', () => {
    expect(routeSlug('/', '/')).toBe('')
  })

  it('resolves a hero path to its slug', () => {
    expect(routeSlug('/cody-williams', '/')).toBe('cody-williams')
  })

  it('tolerates trailing slashes', () => {
    expect(routeSlug('/cody-williams/', '/')).toBe('cody-williams')
    expect(routeSlug('/cody-williams///', '/')).toBe('cody-williams')
  })

  it('strips a subpath BASE_URL (Vite guarantees the trailing slash)', () => {
    expect(routeSlug('/nba/', '/nba/')).toBe('')
    expect(routeSlug('/nba/cody-williams', '/nba/')).toBe('cody-williams')
  })

  it('falls back to stripping the leading slash when the base does not match', () => {
    // A path outside BASE_URL should still resolve to something lookupable —
    // the registry miss then lands on the index, never a crash.
    expect(routeSlug('/keyonte-george', '/nba/')).toBe('keyonte-george')
  })
})
