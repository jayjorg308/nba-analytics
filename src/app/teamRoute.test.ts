// Team route parsing (the URL contract): seasons, game slugs, the original
// game-id links, and everything else as nobody's page.

import { describe, expect, it } from 'vitest'
import { parseTeamRoute } from './teamRoute'

describe('parseTeamRoute', () => {
  it('reads the bare team slug as the canonical season', () => {
    expect(parseTeamRoute(undefined)).toEqual({ kind: 'canonical' })
  })

  it('reads a season', () => {
    expect(parseTeamRoute('2025-26')).toEqual({ kind: 'season', season: '2025-26' })
  })

  it('reads a game slug and the season its date falls in', () => {
    expect(parseTeamRoute('2026-01-03-gsw')).toEqual({
      kind: 'game',
      season: '2025-26',
      slug: '2026-01-03-gsw',
    })
    expect(parseTeamRoute('2025-10-22-lac')).toMatchObject({ season: '2025-26' })
    expect(parseTeamRoute('2026-10-21-mem')).toMatchObject({ season: '2026-27' })
  })

  it('keeps the original game-id links working', () => {
    expect(parseTeamRoute('0022500492')).toEqual({
      kind: 'gameId',
      season: '2025-26',
      gameId: '0022500492',
    })
  })

  it('names everything else unknown, never a collision', () => {
    for (const s of ['2026-01-03', '2026-01-03-GSW', '2026-01-03-gsw-x', '2025-2026', 'keyonte-george', '002250049']) {
      expect(parseTeamRoute(s), s).toEqual({ kind: 'unknown' })
    }
  })
})
