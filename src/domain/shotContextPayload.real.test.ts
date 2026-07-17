import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { HEROES } from '../heroes/registry'
import { aggregateShotContextMetrics } from './aggregateShotContext'
import { parseDerivedPayload } from './payload'
import { parseShotContextPayload } from './shotContextPayload'

const publicData = path.resolve(process.cwd(), 'public/data')

describe('deployed shot-context payloads', () => {
  it('exist for every registered hero (required — ADR-0032)', () => {
    for (const hero of HEROES) {
      const contextPath = path.join(publicData, hero.slug, `${hero.season}.context.json`)
      expect(existsSync(contextPath), `missing ${contextPath}`).toBe(true)
    }
  })

  for (const hero of HEROES) {
    describe(`${hero.slug} ${hero.season}`, () => {
      const contextPath = path.join(publicData, hero.slug, `${hero.season}.context.json`)
      const shotPath = path.join(publicData, hero.slug, `${hero.season}.json`)

      it('strict-parses, passes Gate 4, and reconciles the exact sibling key set', () => {
        const shots = parseDerivedPayload(JSON.parse(readFileSync(shotPath, 'utf-8')))
        const context = parseShotContextPayload(
          JSON.parse(readFileSync(contextPath, 'utf-8')),
        )
        expect(context._meta.gamesLoaded).toBe(context._meta.gamesExpected)
        expect(context._meta.eventMatchCounts.missingGame).toBe(0)
        expect(context._meta.sourceGames).toHaveLength(context._meta.gamesExpected)
        expect(new Set(context._meta.sourceGames.map((game) => game.gameId))).toEqual(
          new Set(shots.shots.map((shot) => shot.gameId)),
        )
        expect(
          context._meta.sourceGames.every(
            (game) => game.playByPlayPullDate === game.boxScorePullDate,
          ),
        ).toBe(true)
        const metrics = aggregateShotContextMetrics(shots, context)
        expect(metrics.all.coverage).toBe(1)
        expect(metrics.all.minAssistedShare).toBe(metrics.all.assistedShare)
        expect(metrics.all.maxAssistedShare).toBe(metrics.all.assistedShare)
      })

      it('matches the latest derived context payload when data/ is present', () => {
        const derivedDir = path.resolve(
          process.cwd(),
          'data/derived',
          hero.slug,
          hero.season,
          'shot-context',
        )
        if (!existsSync(derivedDir)) return
        const latest = readdirSync(derivedDir)
          .filter((file) => file.endsWith('.json'))
          .sort()
          .at(-1)
        if (!latest) return
        const derived: unknown = JSON.parse(
          readFileSync(path.join(derivedDir, latest), 'utf-8'),
        )
        const deployed: unknown = JSON.parse(readFileSync(contextPath, 'utf-8'))
        expect(deployed).toEqual(derived)
      })
    })
  }
})
