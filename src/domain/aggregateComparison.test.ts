// Unit tests for the comparison aggregation's invariants (comparison plan,
// increment 1) on hand-built micro fixtures. Real deployed-data coverage
// (Mitchell/Brunson, the Mitchell split) lives in
// aggregateComparison.real.test.ts.

import { describe, expect, it } from 'vitest'
import { aggregatePlayerComparison, aggregateSplitComparison } from './aggregateComparison'
import type { BasicZone } from './constants'
import { EVAL_ZONES, ZONE_POINT_VALUE } from './constants'
import type { DerivedPayload, EnrichedShot, ZoneBaselineEntry } from './payload'
import { SCHEMA_VERSION } from './payload'

function shot(zoneBasic: BasicZone, made: boolean, over: Partial<EnrichedShot> = {}): EnrichedShot {
  const pointValue = ZONE_POINT_VALUE[zoneBasic]
  return {
    gameId: '0022500001',
    gameEventId: 1,
    gameDate: '2025-11-01',
    opponent: 'PHX',
    home: false,
    period: 1,
    minutesRemaining: 5,
    secondsRemaining: 30,
    made,
    pointValue,
    zoneBasic,
    zoneArea: zoneBasic === 'Backcourt' ? 'Back Court(BC)' : 'Center(C)',
    zoneRange:
      zoneBasic === 'Backcourt' ? 'Back Court Shot' : pointValue === 3 ? '24+ ft' : 'Less Than 8 ft',
    distanceFt: 10,
    locX: 0,
    locY: 100,
    ...over,
  }
}

function reps(n: number, zone: BasicZone, made: boolean, over: Partial<EnrichedShot> = {}): EnrichedShot[] {
  return Array.from({ length: n }, () => shot(zone, made, over))
}

const microBaseline: ZoneBaselineEntry[] = [
  { grain: 'basic', zone: 'Restricted Area', fga: 1000, fgm: 600 },
  { grain: 'basic', zone: 'In The Paint (Non-RA)', fga: 500, fgm: 200 },
  { grain: 'basic', zone: 'Mid-Range', fga: 1000, fgm: 400 },
  { grain: 'basic', zone: 'Left Corner 3', fga: 250, fgm: 100 },
  { grain: 'basic', zone: 'Right Corner 3', fga: 250, fgm: 100 },
  { grain: 'basic', zone: 'Above the Break 3', fga: 1000, fgm: 350 },
  { grain: 'basic', zone: 'Backcourt', fga: 10, fgm: 1 },
  { grain: 'midRangeBand', band: '8-16 ft', fga: 600, fgm: 270 },
  { grain: 'midRangeBand', band: '16-24 ft', fga: 400, fgm: 130 },
]

function makePayload(
  shots: EnrichedShot[],
  over: { player?: string; season?: string; baseline?: ZoneBaselineEntry[] } = {},
): DerivedPayload {
  return {
    _meta: {
      schemaVersion: SCHEMA_VERSION,
      player: over.player ?? 'Test Player',
      playerId: 1,
      season: over.season ?? '2025-26',
      seasonType: 'Regular Season',
      pullDate: '2026-08-01',
      dataThrough: shots.reduce((m, s) => (s.gameDate > m ? s.gameDate : m), '0000-00-00'),
      gamesIncluded: new Set(shots.map((s) => s.gameId)).size,
      sourceSnapshot: 'test-snapshot',
      totalShots: shots.length,
      zoneConflictsDropped: 0,
      usagePct: 0.2,
      usageSourceSnapshot: 'test-snapshot',
    },
    shots,
    zoneBaseline: over.baseline ?? microBaseline,
  }
}

// Three games across the season: 2025-11-01, 2025-12-01, 2026-01-15. The
// 2025-12-01 split then puts game 1 alone on the left and games 2+3 (an
// unequal, untrimmed window) on the right.
const game1: EnrichedShot[] = [
  ...reps(10, 'Restricted Area', true, { gameId: 'g1', gameDate: '2025-11-01' }),
  ...reps(6, 'Restricted Area', false, { gameId: 'g1', gameDate: '2025-11-01' }),
  ...reps(1, 'Backcourt', false, { gameId: 'g1', gameDate: '2025-11-01' }),
]
const game2: EnrichedShot[] = [
  ...reps(3, 'Restricted Area', true, { gameId: 'g2', gameDate: '2025-12-01' }),
  ...reps(2, 'Restricted Area', false, { gameId: 'g2', gameDate: '2025-12-01' }),
  ...reps(2, 'Mid-Range', true, { gameId: 'g2', gameDate: '2025-12-01', zoneRange: '8-16 ft' }),
]
const game3: EnrichedShot[] = [
  ...reps(4, 'Above the Break 3', true, { gameId: 'g3', gameDate: '2026-01-15' }),
  ...reps(6, 'Above the Break 3', false, { gameId: 'g3', gameDate: '2026-01-15' }),
]
const seasonShots = [...game1, ...game2, ...game3]

describe('aggregatePlayerComparison', () => {
  const left = { slug: 'player-a', payload: makePayload(game1, { player: 'Player A' }) }
  const right = {
    slug: 'player-b',
    payload: makePayload([...game2, ...game3], { player: 'Player B' }),
  }

  it('rejects the same player on both sides', () => {
    expect(() =>
      aggregatePlayerComparison({ season: '2025-26', left, right: { ...right, slug: 'player-a' } }),
    ).toThrow(/two distinct players/)
  })

  it('rejects a payload describing a different season', () => {
    const drifted = {
      slug: 'player-b',
      payload: makePayload(game2, { player: 'Player B', season: '2024-25' }),
    }
    expect(() => aggregatePlayerComparison({ season: '2025-26', left, right: drifted })).toThrow(
      /is 2024-25, not the requested 2025-26/,
    )
  })

  it('rejects non-identical league baselines as a contradiction', () => {
    const contradicted = microBaseline.map((e) =>
      e.grain === 'basic' && e.zone === 'Mid-Range' ? { ...e, fga: e.fga + 1 } : e,
    )
    const mismatched = {
      slug: 'player-b',
      payload: makePayload(game2, { player: 'Player B', baseline: contradicted }),
    }
    expect(() =>
      aggregatePlayerComparison({ season: '2025-26', left, right: mismatched }),
    ).toThrow(/league baselines contradict/)
  })

  it('builds both full-season sides with identity, games, shots, and dates', () => {
    const m = aggregatePlayerComparison({ season: '2025-26', left, right })
    expect(m.mode).toBe('players')
    expect(m.baselineSeason).toBe('2025-26')
    expect(m.splitDate).toBeNull()
    expect(m.left).toMatchObject({
      id: 'left',
      label: 'Player A',
      playerName: 'Player A',
      playerSlug: 'player-a',
      season: '2025-26',
      startDate: '2025-11-01',
      endDate: '2025-11-01',
      games: 1,
      shots: 17,
    })
    expect(m.right).toMatchObject({
      id: 'right',
      label: 'Player B',
      playerSlug: 'player-b',
      startDate: '2025-12-01',
      endDate: '2026-01-15',
      games: 2,
      shots: 17,
    })
  })

  it('measures both windows against the same league ruler', () => {
    const m = aggregatePlayerComparison({ season: '2025-26', left, right })
    for (const row of m.zones) {
      expect(row.left.leagueFgPct).toBe(row.right.leagueFgPct)
      expect(row.left.leagueAttemptShare).toBe(row.right.leagueAttemptShare)
      expect(row.left.leaguePps).toBe(row.right.leaguePps)
    }
  })
})

describe('aggregateSplitComparison', () => {
  const input = {
    slug: 'test-player',
    season: '2025-26',
    splitDate: '2025-12-01',
    payload: makePayload(seasonShots),
  }

  it('puts the split date itself on the right side', () => {
    const m = aggregateSplitComparison(input)
    // Game 2 is played ON the split date: right window opens there.
    expect(m.left.endDate).toBe('2025-11-01')
    expect(m.right.startDate).toBe('2025-12-01')
    expect(m.splitDate).toBe('2025-12-01')
  })

  it('windows do not overlap and reproduce every input shot', () => {
    const m = aggregateSplitComparison(input)
    expect(m.left.shots + m.right.shots).toBe(seasonShots.length)
    expect(m.left.endDate < m.right.startDate).toBe(true)
  })

  it('keeps complete natural windows without equal-length trimming', () => {
    const m = aggregateSplitComparison(input)
    // Unequal by construction: 1 game / 17 shots vs 2 games / 17 shots —
    // and the second window keeps both its games (no matched-length cut).
    expect(m.left.games).toBe(1)
    expect(m.right.games).toBe(2)
    expect(m.right.endDate).toBe('2026-01-15')
  })

  it('rejects a split leaving an empty side', () => {
    expect(() => aggregateSplitComparison({ ...input, splitDate: '2025-10-01' })).toThrow(
      /empty left window/,
    )
    expect(() => aggregateSplitComparison({ ...input, splitDate: '2026-06-01' })).toThrow(
      /empty right window/,
    )
  })

  it('rejects a non-ISO split date and a drifted payload season', () => {
    expect(() => aggregateSplitComparison({ ...input, splitDate: 'Feb 7' })).toThrow(
      /not an ISO date/,
    )
    expect(() =>
      aggregateSplitComparison({ ...input, payload: makePayload(seasonShots, { season: '2024-25' }) }),
    ).toThrow(/is 2024-25, not the requested 2025-26/)
  })

  it('passes the same full-season baseline to both windows', () => {
    const m = aggregateSplitComparison(input)
    expect(m.baselineSeason).toBe('2025-26')
    for (const row of m.zones) {
      expect(row.left.leagueFgPct).toBe(row.right.leagueFgPct)
      expect(row.left.leaguePps).toBe(row.right.leaguePps)
    }
  })

  it('pairs zone rows by zone identity in evaluation order', () => {
    const m = aggregateSplitComparison(input)
    expect(m.zones.map((r) => r.zone)).toEqual([...EVAL_ZONES])
    for (const row of m.zones) {
      expect(row.left.zone).toBe(row.zone)
      expect(row.right.zone).toBe(row.zone)
    }
  })

  it('keeps sample flags local to each window (ADR-0075)', () => {
    const m = aggregateSplitComparison(input)
    const ra = m.zones.find((r) => r.zone === 'Restricted Area')!
    // Left RA has 16 attempts (a stable selection read), right RA only 5
    // (too thin) — one side's thinness never leaks to the other, and both
    // rows stay present.
    expect(ra.left.attempts).toBe(16)
    expect(ra.left.included).toBe(true)
    expect(ra.right.attempts).toBe(5)
    expect(ra.right.included).toBe(false)
    // Both windows are under 50 RA attempts: the making flag stays on.
    expect(ra.left.smallSampleMaking).toBe(true)
    expect(ra.right.smallSampleMaking).toBe(true)
  })

  it('inherits backcourt treatment from aggregateShotMetrics', () => {
    const m = aggregateSplitComparison(input)
    // The backcourt heave lands in game 1's window: reported, excluded from
    // evaluation, never a zone row.
    expect(m.left.metrics.backcourt).toEqual({ attempts: 1, makes: 0 })
    expect(m.left.metrics.totalAttempts).toBe(17)
    expect(m.left.metrics.evalAttempts).toBe(16)
    expect(m.right.metrics.backcourt).toEqual({ attempts: 0, makes: 0 })
    expect(m.zones.map((r) => r.zone)).not.toContain('Backcourt')
  })
})
