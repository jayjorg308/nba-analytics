// The game route family (ADR-0086): /game resolves to the landing,
// /game/<slug>/<date> to a card, and everything malformed to nobody's page.
// 'game' is reserved beside methodology and compare (registry.test.ts holds
// hero slugs away from RESERVED_ROUTES).

import { describe, expect, it } from 'vitest'
import { GAME_ROUTE, RESERVED_ROUTES, parseGameRoute, seasonOfGameDate } from './routes'

describe('parseGameRoute', () => {
  it('resolves the landing and card shapes', () => {
    expect(parseGameRoute('/game', '/')).toEqual({ kind: 'landing' })
    expect(parseGameRoute('/game/', '/')).toEqual({ kind: 'landing' })
    expect(parseGameRoute('/game/cody-williams/2026-03-15', '/')).toEqual({
      kind: 'card',
      slug: 'cody-williams',
      date: '2026-03-15',
    })
  })

  it('rejects malformed shapes (they fall to the unknown-path note)', () => {
    expect(parseGameRoute('/game/cody-williams', '/')).toBeUndefined()
    expect(parseGameRoute('/game/cody-williams/march-15', '/')).toBeUndefined()
    expect(parseGameRoute('/game/cody-williams/2026-03-15/extra', '/')).toBeUndefined()
    expect(parseGameRoute('/cody-williams/2025-26', '/')).toBeUndefined()
  })

  it('is a reserved route', () => {
    expect(RESERVED_ROUTES).toContain(GAME_ROUTE)
  })
})

describe('seasonOfGameDate', () => {
  it('maps dates to the season they belong to (October–June, August boundary)', () => {
    expect(seasonOfGameDate('2025-10-23')).toBe('2025-26')
    expect(seasonOfGameDate('2026-03-15')).toBe('2025-26')
    expect(seasonOfGameDate('2026-06-19')).toBe('2025-26')
    expect(seasonOfGameDate('2026-10-21')).toBe('2026-27')
    expect(seasonOfGameDate('2029-12-31')).toBe('2029-30')
  })
})
