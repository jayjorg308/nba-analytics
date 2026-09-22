// The team surface's copy guard (ADR-0081): structural copy only. No em
// dash as prose punctuation (CONTEXT.md's punctuation style, the glossary
// and hero-copy guards' rule), and none of the argument vocabulary a tool
// must not use — verdict, grade, ranking, or any word that reads a direction
// into the numbers. Restructure the sentence; never weaken the list.

import { describe, expect, it } from 'vitest'
import { RESERVED_ROUTES, TEAM_ROUTES } from '../app/routes'
import { TEAM_COPY } from './copy'
import { GAME_ID, SEASON, TEAMS, teamBySlug } from './registry'

const FORBIDDEN = [
  'verdict',
  'grade',
  'winner',
  'better',
  'worse',
  'best',
  'worst',
  'should',
  'elite',
  'bad shot',
  'good shot',
]

function everyString(): string[] {
  const out: string[] = []
  for (const value of Object.values(TEAM_COPY)) {
    out.push(typeof value === 'function' ? value('Utah Jazz', '2025-26') : value)
  }
  return out
}

describe('team surface structural copy', () => {
  it('carries no em dash as prose punctuation', () => {
    for (const s of everyString()) expect(s).not.toContain('—')
  })

  it('carries no argument vocabulary', () => {
    for (const s of everyString()) {
      const lower = s.toLowerCase()
      for (const word of FORBIDDEN) expect(lower, `"${s}" contains "${word}"`).not.toContain(word)
    }
  })

  it('names the surface as a tool in its title', () => {
    expect(TEAM_COPY.title('Utah Jazz')).toBe('Utah Jazz shot profile')
  })
})

describe('team registry', () => {
  it('every team slug is a reserved route and collides with no hero', () => {
    for (const team of TEAMS) {
      expect(TEAM_ROUTES).toContain(team.slug)
      expect(RESERVED_ROUTES).toContain(team.slug)
      expect(teamBySlug(team.slug)).toBe(team)
    }
  })

  it('every team lists its canonical season among unique, ordered seasons', () => {
    for (const team of TEAMS) {
      expect(team.seasons).toContain(team.canonicalSeason)
      expect(new Set(team.seasons).size).toBe(team.seasons.length)
      expect([...team.seasons].sort()).toEqual([...team.seasons])
      for (const s of team.seasons) expect(SEASON.test(s)).toBe(true)
    }
  })

  it('tells a game id from a season in the second route segment', () => {
    expect(GAME_ID.test('0022500025')).toBe(true)
    expect(SEASON.test('0022500025')).toBe(false)
    expect(SEASON.test('2025-26')).toBe(true)
    expect(GAME_ID.test('2025-26')).toBe(false)
  })
})
