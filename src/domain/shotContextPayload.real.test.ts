import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { HEROES } from '../heroes/registry'
import { aggregateShotContextMetrics } from './aggregateShotContext'
import { parseDerivedPayload } from './payload'
import { parseShotContextPayload } from './shotContextPayload'

const publicData = path.resolve(process.cwd(), 'public/data')

// hero × seasons (ADR-0060): every registered season argument is guarded.
const HERO_SEASONS = HEROES.flatMap((hero) =>
  hero.seasons.map((seasonConfig) => ({ hero, season: seasonConfig.season })),
)

describe('deployed shot-context payloads', () => {
  it('exist for every registered hero-season (required — ADR-0032/0060)', () => {
    for (const { hero, season } of HERO_SEASONS) {
      const contextPath = path.join(publicData, hero.slug, `${season}.context.json`)
      expect(existsSync(contextPath), `missing ${contextPath}`).toBe(true)
    }
  })

  for (const { hero, season } of HERO_SEASONS) {
    describe(`${hero.slug} ${season}`, () => {
      const contextPath = path.join(publicData, hero.slug, `${season}.context.json`)
      const shotPath = path.join(publicData, hero.slug, `${season}.json`)

      it('strict-parses, passes Gate 4, and reconciles the exact sibling key set', () => {
        const shots = parseDerivedPayload(JSON.parse(readFileSync(shotPath, 'utf-8')))
        const context = parseShotContextPayload(
          JSON.parse(readFileSync(contextPath, 'utf-8')),
        )
        expect(context._meta.gamesLoaded).toBe(context._meta.gamesExpected)
        expect(context._meta.eventMatchCounts.missingGame).toBe(0)
        // Four-way frontier equality (ADR-0058): a one-sided hero:sync now
        // fails visibly as a frontier mismatch.
        expect(context._meta.dataThrough).toBe(shots._meta.dataThrough)
        expect(context._meta.gamesIncluded).toBe(shots._meta.gamesIncluded)
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
          season,
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
