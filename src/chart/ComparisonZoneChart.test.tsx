// @vitest-environment jsdom
// The zone comparison panels (comparison plan §4): both axes present
// simultaneously, dumbbell markers with non-color side identity, the
// league-zero reference, the making-scale ribbon, and ADR-0075's local
// flags — over a hand-built micro fixture driven through the real domain
// aggregation.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { aggregateSplitComparison } from '../domain/aggregateComparison'
import type { BasicZone } from '../domain/constants'
import { ZONE_POINT_VALUE } from '../domain/constants'
import type { DerivedPayload, EnrichedShot, ZoneBaselineEntry } from '../domain/payload'
import { SCHEMA_VERSION } from '../domain/payload'
import { ComparisonZoneChart } from './ComparisonZoneChart'

afterEach(cleanup)

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

const seasonShots: EnrichedShot[] = [
  ...reps(10, 'Restricted Area', true, { gameId: 'g1', gameDate: '2025-11-01' }),
  ...reps(6, 'Restricted Area', false, { gameId: 'g1', gameDate: '2025-11-01' }),
  ...reps(1, 'Backcourt', false, { gameId: 'g1', gameDate: '2025-11-01' }),
  ...reps(3, 'Restricted Area', true, { gameId: 'g2', gameDate: '2025-12-01' }),
  ...reps(2, 'Restricted Area', false, { gameId: 'g2', gameDate: '2025-12-01' }),
  ...reps(2, 'Mid-Range', true, { gameId: 'g2', gameDate: '2025-12-01', zoneRange: '8-16 ft' }),
  ...reps(4, 'Above the Break 3', true, { gameId: 'g3', gameDate: '2026-01-15' }),
  ...reps(6, 'Above the Break 3', false, { gameId: 'g3', gameDate: '2026-01-15' }),
]

const payload: DerivedPayload = {
  _meta: {
    schemaVersion: SCHEMA_VERSION,
    player: 'Test Player',
    playerId: 1,
    season: '2025-26',
    seasonType: 'Regular Season',
    pullDate: '2026-08-01',
    dataThrough: '2026-01-15',
    gamesIncluded: 3,
    sourceSnapshot: 'test-snapshot',
    totalShots: seasonShots.length,
    zoneConflictsDropped: 0,
    usagePct: 0.2,
    usageSourceSnapshot: 'test-snapshot',
  },
  shots: seasonShots,
  zoneBaseline: microBaseline,
}

const metrics = aggregateSplitComparison({
  slug: 'test-player',
  season: '2025-26',
  splitDate: '2025-12-01',
  payload,
})

describe('ComparisonZoneChart', () => {
  it('renders both axes simultaneously, each anchored on a league-zero line', () => {
    render(<ComparisonZoneChart metrics={metrics} />)
    screen.getByRole('img', { name: /Shot diet comparison/ })
    screen.getByRole('img', { name: /Shot making comparison/ })
    expect(document.querySelectorAll('.growth-zeroline')).toHaveLength(2)
    // The same six rows in both panels, zone identity repeated per panel.
    expect(screen.getAllByText('Restricted Area')).toHaveLength(2)
    expect(screen.getAllByText('Above the Break 3')).toHaveLength(2)
  })

  it('encodes side identity as shape and fill style, never color', () => {
    const { container } = render(<ComparisonZoneChart metrics={metrics} />)
    // Diet: every zone has a share on both sides (6 + 6). Making: only
    // zones with attempts have a delta — left RA only, right RA/MR/ATB3
    // (ADR-0013: no data draws nothing, distinct from neutral).
    expect(container.querySelectorAll('circle.comparison-dot-left')).toHaveLength(7)
    expect(container.querySelectorAll('rect.comparison-dot-right')).toHaveLength(9)
    // Connectors pair the markers wherever both exist: 6 diet + 1 making.
    expect(container.querySelectorAll('.creation-connector')).toHaveLength(7)
    // The legend draws the actual marks beside the side labels.
    expect(container.querySelector('.comparison-swatch-left')).not.toBeNull()
    expect(container.querySelector('.comparison-swatch-right')).not.toBeNull()
    expect(container.textContent).toContain('Before')
    expect(container.textContent).toContain('Since')
  })

  it('draws the fixed making scale as an axis ribbon on the making panel only', () => {
    const { container } = render(<ComparisonZoneChart metrics={metrics} />)
    const ribbons = container.querySelectorAll('.comparison-making-ribbon')
    expect(ribbons).toHaveLength(1)
    const segments = [...container.querySelectorAll('.comparison-making-ribbon rect')]
    expect(segments.length).toBeGreaterThan(0)
    for (const seg of segments) {
      expect(seg.getAttribute('class')).toMatch(/^zone-fill-/)
    }
  })

  it('keeps thin windows visible with the † convention on value labels (ADR-0075)', () => {
    const { container } = render(<ComparisonZoneChart metrics={metrics} />)
    const labels = [...container.querySelectorAll('.comparison-value')].map(
      (el) => el.textContent,
    )
    // Left RA: 16 attempts — a stable diet reading (share 16/16 vs the
    // league's 25%, no †) that is still a small making sample (10/16 =
    // 62.5% vs 60%, †). Right RA: 5 attempts — † on both axes (share 5/17
    // vs 25%; making 3/5 = 60% dead on league).
    expect(labels).toContain('+75.0')
    expect(labels).toContain('+2.5†')
    expect(labels).toContain('+4.4†')
    expect(labels).toContain('+0.0†')
  })
})
