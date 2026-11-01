// The retired game cards' redirects (ADR-0096), guarded over the committed
// vercel.json and the Jazz 2025-26 season index. The game-log files that
// named the cards are gone, so the redirect list is the only record of
// them: one per card of the three Jazz heroes (every 2025-26 argument with
// a Jazz team page), each landing on a night that resolves. The counts are
// pinned because the set is frozen at retirement; a lost line would
// otherwise pass. Skips on clean clones.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { playerSlug } from '../domain/playerSeason'
import { parseTeamSeasonIndex } from '../domain/teamSeasonIndex'
import { HEROES } from '../heroes/registry'
import { TEAMS_ROOT } from '../teams/published'
import { parseTeamRoute } from './teamRoute'

interface Redirect {
  source: string
  destination: string
  permanent: boolean
}

const indexFile = path.join(TEAMS_ROOT, 'uta', '2025-26', 'index.json')
const CARD = /^\/game\/([a-z0-9-]+)\/(\d{4}-\d{2}-\d{2})$/
const NIGHT = /^\/jazz\/([^/]+)\/([^/]+)$/

describe.skipIf(!existsSync(indexFile))('retired game card redirects', () => {
  const { redirects } = JSON.parse(readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf-8')) as {
    redirects: Redirect[]
  }
  const cards = redirects.filter((r) => r.source.startsWith('/game/'))

  it('sends the landing to the site root, permanently', () => {
    expect(redirects.find((r) => r.source === '/game')).toEqual({ source: '/game', destination: '/', permanent: true })
  })

  it('forwards every card of the three Jazz heroes, and only theirs', () => {
    const jazzHeroes = HEROES.filter((h) => h.seasons.some((s) => s.season === '2025-26' && s.teamPage === 'jazz'))
      .map((h) => h.slug)
      .sort()
    const counts: Record<string, number> = {}
    for (const r of cards) {
      const slug = CARD.exec(r.source)?.[1] ?? r.source
      counts[slug] = (counts[slug] ?? 0) + 1
    }
    expect(Object.keys(counts).sort()).toEqual(jazzHeroes)
    expect(counts).toEqual({ 'ace-bailey': 72, 'cody-williams': 62, 'keyonte-george': 54 })
    expect(new Set(cards.map((r) => r.source)).size).toBe(cards.length)
  })

  it('lands each card on his night in that game', () => {
    const index = parseTeamSeasonIndex(JSON.parse(readFileSync(indexFile, 'utf-8')))
    const rows = new Map(index.games.map((g) => [g.slug, g]))
    for (const r of cards) {
      const [, slug, date] = CARD.exec(r.source) ?? []
      const [, game, nightSlug] = NIGHT.exec(r.destination) ?? []
      expect(r.permanent, r.source).toBe(true)
      expect(parseTeamRoute(game, nightSlug), r.source).toEqual({ kind: 'night', season: '2025-26', game, slug })
      const row = rows.get(game!)
      expect(row?.gameDate, r.source).toBe(date)
      expect(row!.players.some((p) => playerSlug(p.name) === slug), r.source).toBe(true)
    }
  })
})
