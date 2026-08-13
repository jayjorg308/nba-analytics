// The comparison URL contract (ADR-0076): parse and serialize are pure and
// round-trip exactly; every invalid query resolves to the setup state with
// a specific plain message, never a throw and never the hero directory.

import { describe, expect, it } from 'vitest'
import type { HeroConfig } from '../heroes/types'
import {
  parseComparisonQuery,
  serializeComparison,
  validateComparisonQuery,
  type ComparisonRequest,
} from './comparisonRoute'
import { COMPARE_ROUTE, RESERVED_ROUTES } from './routes'

function hero(slug: string, playerName: string, seasons: string[]): HeroConfig {
  return {
    slug,
    playerName,
    thesis: 'Is he taking good shots?',
    hero: {
      imagePath: `img/${slug}.jpg`,
      headshotPath: `img/${slug}-headshot.png`,
      imageAlt: 'stub',
      imagePosition: '50% 50%',
      imagePositionWide: '50% 50%',
    },
    seasons: seasons.map((season) => ({
      season,
      kicker: `Stub · ${season}`,
      verdict: 'Stub verdict.',
    })),
    canonicalSeason: seasons[seasons.length - 1]!,
  }
}

const HEROES_STUB: readonly HeroConfig[] = [
  hero('donovan-mitchell', 'Donovan Mitchell', ['2025-26']),
  hero('jalen-brunson', 'Jalen Brunson', ['2025-26']),
  hero('cody-williams', 'Cody Williams', ['2024-25', '2025-26']),
]

const validate = (search: string) =>
  validateComparisonQuery(parseComparisonQuery(search), HEROES_STUB)

describe('the /compare route reservation', () => {
  it('is a reserved static route, so no hero slug can shadow it', () => {
    // registry.test.ts asserts no hero slug appears in RESERVED_ROUTES;
    // this pins that 'compare' actually rides that guard.
    expect(RESERVED_ROUTES).toContain(COMPARE_ROUTE)
  })
})

describe('parseComparisonQuery', () => {
  it('reads a bare query as no fields', () => {
    const fields = parseComparisonQuery('')
    expect(fields).toEqual({ unknownKeys: [] })
  })

  it('reads the recognized fields and collects unknown keys', () => {
    const fields = parseComparisonQuery('?mode=players&season=2025-26&left=a&utm_source=x')
    expect(fields.mode).toBe('players')
    expect(fields.season).toBe('2025-26')
    expect(fields.left).toBe('a')
    expect(fields.right).toBeUndefined()
    expect(fields.unknownKeys).toEqual(['utm_source'])
  })
})

describe('validateComparisonQuery', () => {
  it('resolves bare /compare to the setup state in Players mode with no message', () => {
    const state = validate('')
    expect(state).toEqual({
      kind: 'setup',
      mode: 'players',
      message: null,
      prefill: { unknownKeys: [] },
    })
  })

  it('accepts a complete player comparison', () => {
    const state = validate('?mode=players&season=2025-26&left=donovan-mitchell&right=jalen-brunson')
    expect(state).toEqual({
      kind: 'valid',
      request: {
        mode: 'players',
        season: '2025-26',
        left: 'donovan-mitchell',
        right: 'jalen-brunson',
      },
    })
  })

  it('accepts a complete split comparison', () => {
    const state = validate('?mode=split&season=2025-26&player=donovan-mitchell&split=2026-02-07')
    expect(state).toEqual({
      kind: 'valid',
      request: {
        mode: 'split',
        season: '2025-26',
        player: 'donovan-mitchell',
        split: '2026-02-07',
      },
    })
  })

  it('keeps an incomplete HeroPage link in setup, preselected, asking for the rest', () => {
    const state = validate('?mode=players&season=2025-26&left=donovan-mitchell')
    expect(state.kind).toBe('setup')
    if (state.kind !== 'setup') return
    expect(state.mode).toBe('players')
    expect(state.message).toBe('Pick a right player to compare.')
    expect(state.prefill.season).toBe('2025-26')
    expect(state.prefill.left).toBe('donovan-mitchell')
  })

  it('rejects the same player on both sides', () => {
    const state = validate(
      '?mode=players&season=2025-26&left=donovan-mitchell&right=donovan-mitchell',
    )
    expect(state).toMatchObject({
      kind: 'setup',
      message: 'Pick two different players to compare.',
    })
  })

  it('rejects an unregistered player by name', () => {
    const state = validate('?mode=players&season=2025-26&left=donovan-mitchell&right=luka-doncic')
    expect(state).toMatchObject({
      kind: 'setup',
      message: 'No player named "luka-doncic" is on file.',
    })
  })

  it('rejects a season a player does not carry', () => {
    const state = validate('?mode=players&season=2024-25&left=cody-williams&right=jalen-brunson')
    expect(state).toMatchObject({
      kind: 'setup',
      message: 'Jalen Brunson has no 2024-25 season on file.',
    })
  })

  it('rejects a malformed split date, and a fake calendar date', () => {
    expect(
      validate('?mode=split&season=2025-26&player=donovan-mitchell&split=02/07/2026'),
    ).toMatchObject({
      kind: 'setup',
      mode: 'split',
      message: '"02/07/2026" is not a real date. The split date takes YYYY-MM-DD form.',
    })
    expect(
      validate('?mode=split&season=2025-26&player=donovan-mitchell&split=2026-02-30'),
    ).toMatchObject({ kind: 'setup', mode: 'split' })
  })

  it('rejects contradictory cross-mode parameters', () => {
    expect(
      validate('?mode=players&season=2025-26&left=a&right=b&split=2026-02-07'),
    ).toMatchObject({ kind: 'setup', mode: 'players' })
    expect(
      validate('?mode=split&season=2025-26&player=donovan-mitchell&split=2026-02-07&left=a'),
    ).toMatchObject({ kind: 'setup', mode: 'split' })
  })

  it('rejects an unknown mode and unknown parameter names', () => {
    expect(validate('?mode=timeline')).toMatchObject({
      kind: 'setup',
      mode: 'players',
      message: '"timeline" is not a comparison mode.',
    })
    expect(validate('?mode=players&season=2025-26&left=a&right=b&foo=1')).toMatchObject({
      kind: 'setup',
      message: 'The comparison link carries parameters this page does not read (foo).',
    })
  })

  it('says a modeless link with fields is missing its mode', () => {
    expect(validate('?season=2025-26&left=donovan-mitchell')).toMatchObject({
      kind: 'setup',
      message: 'The comparison link is missing its mode.',
    })
  })
})

describe('serializeComparison', () => {
  const playersRequest: ComparisonRequest = {
    mode: 'players',
    season: '2025-26',
    left: 'donovan-mitchell',
    right: 'jalen-brunson',
  }
  const splitRequest: ComparisonRequest = {
    mode: 'split',
    season: '2025-26',
    player: 'donovan-mitchell',
    split: '2026-02-07',
  }

  it('serializes both modes canonically, fixed parameter order', () => {
    expect(serializeComparison(playersRequest)).toBe(
      '?mode=players&season=2025-26&left=donovan-mitchell&right=jalen-brunson',
    )
    expect(serializeComparison(splitRequest)).toBe(
      '?mode=split&season=2025-26&player=donovan-mitchell&split=2026-02-07',
    )
  })

  it('round-trips every authoritative input through parse and validate', () => {
    for (const request of [playersRequest, splitRequest]) {
      const state = validateComparisonQuery(
        parseComparisonQuery(serializeComparison(request)),
        HEROES_STUB,
      )
      expect(state).toEqual({ kind: 'valid', request })
    }
  })
})
