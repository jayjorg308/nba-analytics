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

  it('reads a player slug as his canonical season, and a season plus slug as its permalink', () => {
    expect(parseTeamRoute('keyonte-george')).toEqual({ kind: 'player', slug: 'keyonte-george' })
    expect(parseTeamRoute('terrence-shannon-jr')).toEqual({ kind: 'player', slug: 'terrence-shannon-jr' })
    expect(parseTeamRoute('2025-26', 'cody-williams')).toEqual({
      kind: 'seasonPlayer',
      season: '2025-26',
      slug: 'cody-williams',
    })
  })

  it('names everything else unknown, never a collision', () => {
    for (const s of ['2026-01-03', '2026-01-03-GSW', '2026-01-03-gsw-x', '2025-2026', '002250049', 'Keyonte-George', '-x', 'x--y', '3x']) {
      expect(parseTeamRoute(s), s).toEqual({ kind: 'unknown' })
    }
    // A third segment is a player only under a season; under a game slug it
    // is reserved for the player's night.
    expect(parseTeamRoute('2026-01-03-gsw', 'keyonte-george')).toEqual({ kind: 'unknown' })
    expect(parseTeamRoute('2025-26', '2026-01-03-gsw')).toEqual({ kind: 'unknown' })
  })
})
