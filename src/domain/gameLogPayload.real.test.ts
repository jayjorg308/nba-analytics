// Guards the committed game-log deployment copies (ADR-0081): every
// registered hero-season must have a games file that strict-parses and
// agrees AT GAME GRAIN with all three deployed siblings — shots with the
// shot payload, assist statuses with the context payload, trips and
// technicals with the freethrow payload — so contract five can never
// silently drift from the four. Non-registry games files (the mass-import
// roster, phase 2) must meet the card-roster bar. The roster index must
// name exactly the files on disk.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { HEROES } from '../heroes/registry'
import { CARD_ROSTER_MIN_FGA, EVAL_ZONES } from './constants'
import { parseFreethrowPayload } from './freethrowPayload'
import { type GameLogPayload, parseGameLogPayload } from './gameLogPayload'
import { parseDerivedPayload } from './payload'
import { parseShotContextPayload } from './shotContextPayload'

const publicData = path.resolve(process.cwd(), 'public/data')
const gamesRoot = path.join(publicData, 'games')

const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf-8')) as unknown

function gamesFileOf(slug: string, season: string): GameLogPayload {
  return parseGameLogPayload(readJson(path.join(gamesRoot, slug, `${season}.json`)))
}

const sortedJoin = (xs: string[]) => [...xs].sort().join(';')

describe('deployed game-log payloads', () => {
  it('exist and strict-parse for every registered hero-season', () => {
    for (const hero of HEROES) {
      for (const seasonConfig of hero.seasons) {
        const file = path.join(gamesRoot, hero.slug, `${seasonConfig.season}.json`)
        expect(existsSync(file), `${hero.slug} ${seasonConfig.season} has no games file`).toBe(true)
        gamesFileOf(hero.slug, seasonConfig.season)
      }
    }
  })

  it('agree at game grain with the three deployed siblings (the keystone)', () => {
    for (const hero of HEROES) {
      for (const { season } of hero.seasons) {
        const label = `${hero.slug} ${season}`
        const games = gamesFileOf(hero.slug, season)
        const shot = parseDerivedPayload(
          readJson(path.join(publicData, hero.slug, `${season}.json`)),
        )
        const context = parseShotContextPayload(
          readJson(path.join(publicData, hero.slug, `${season}.context.json`)),
        )
        const freethrow = parseFreethrowPayload(
          readJson(path.join(publicData, hero.slug, `${season}.freethrow.json`)),
        )

        // seasonFga is the sibling pre-drop total, exactly.
        expect(games._meta.seasonFga, label).toBe(
          shot._meta.totalShots + shot._meta.zoneConflictsDropped,
        )
        expect(games._meta.playerId, label).toBe(shot._meta.playerId)
        expect(games._meta.dataThrough >= shot._meta.dataThrough, label).toBe(true)

        // Shots per game: the games file minus its conflict rows is the shot
        // payload, as (zone|value|made|period) multisets.
        const shotByGame = new Map<string, string[]>()
        for (const s of shot.shots) {
          const key = `${s.zoneBasic}|${s.pointValue}|${s.made}|${s.period}`
          shotByGame.set(s.gameId, [...(shotByGame.get(s.gameId) ?? []), key])
        }
        const contextByGame = new Map<string, string[]>()
        for (const row of context.shots) {
          contextByGame.set(row.gameId, [
            ...(contextByGame.get(row.gameId) ?? []),
            row.assistStatus,
          ])
        }
        const ftByGame = new Map<string, string[]>()
        for (const trip of freethrow.trips) {
          ftByGame.set(trip.gameId, [
            ...(ftByGame.get(trip.gameId) ?? []),
            `${trip.tripClass}|${trip.ftm}|${trip.fta}`,
          ])
        }

        let technicalFtm = 0
        let technicalFta = 0
        let splitFtm = 0
        let splitFta = 0
        const seenShotGames = new Set<string>()
        for (const game of games.games) {
          const glabel = `${label} ${game.gameId}`
          const nonConflict = game.shots.filter((s) => s.assist !== null)
          expect(
            sortedJoin(nonConflict.map((s) => `${s.zone}|${s.value}|${s.made}|${s.period}`)),
            glabel,
          ).toBe(sortedJoin(shotByGame.get(game.gameId) ?? []))
          expect(
            sortedJoin(nonConflict.map((s) => s.assist as string)),
            glabel,
          ).toBe(sortedJoin(contextByGame.get(game.gameId) ?? []))
          expect(
            sortedJoin(game.trips.map((t) => `${t.tripClass}|${t.ftm}|${t.fta}`)),
            glabel,
          ).toBe(sortedJoin(ftByGame.get(game.gameId) ?? []))
          technicalFtm += game.technicalFtm
          technicalFta += game.technicalFta
          splitFtm += game.splitFtm
          splitFta += game.splitFta
          if (shotByGame.has(game.gameId)) seenShotGames.add(game.gameId)
        }
        // Totality both ways: every shot-payload game is on the card
        // timeline, and season technicals reconcile with the fourth sibling.
        expect(seenShotGames.size, label).toBe(shotByGame.size)
        expect(technicalFtm, label).toBe(freethrow._meta.technicalFtm)
        expect(technicalFta, label).toBe(freethrow._meta.technicalFta)
        expect(splitFtm, label).toBe(freethrow._meta.splitFtm)
        expect(splitFta, label).toBe(freethrow._meta.splitFta)

        // The embedded pricing table is the sibling baseline, verbatim.
        for (const zone of EVAL_ZONES) {
          const pair = games.leagueBaseline.find((e) => e.zone === zone)!
          const sibling = shot.zoneBaseline.find(
            (e) => e.grain === 'basic' && e.zone === zone,
          )!
          expect(pair.fga, `${label} ${zone}`).toBe(sibling.fga)
          expect(pair.fgm, `${label} ${zone}`).toBe(sibling.fgm)
        }
      }
    }
  })

  it('hold every non-registry games file to the card-roster bar', () => {
    const heroSlugs = new Set(HEROES.map((h) => h.slug))
    for (const slug of readdirSync(gamesRoot)) {
      const dir = path.join(gamesRoot, slug)
      if (slug === 'index.json' || heroSlugs.has(slug)) continue
      for (const file of readdirSync(dir)) {
        const payload = parseGameLogPayload(readJson(path.join(dir, file)))
        expect(
          payload._meta.seasonFga,
          `${slug}/${file} is below the card-roster bar (ADR-0081)`,
        ).toBeGreaterThanOrEqual(CARD_ROSTER_MIN_FGA)
      }
    }
  })

  it('has a roster index naming exactly the files on disk', () => {
    const index = readJson(path.join(gamesRoot, 'index.json')) as {
      rosters: { slug: string; player: string; season: string; totalGames: number }[]
    }
    const onDisk: string[] = []
    for (const slug of readdirSync(gamesRoot)) {
      if (slug === 'index.json') continue
      for (const file of readdirSync(path.join(gamesRoot, slug))) {
        onDisk.push(`${slug}/${file.replace('.json', '')}`)
      }
    }
    expect(sortedJoin(index.rosters.map((e) => `${e.slug}/${e.season}`))).toBe(
      sortedJoin(onDisk),
    )
    for (const entry of index.rosters) {
      const payload = gamesFileOf(entry.slug, entry.season)
      expect(payload._meta.player, entry.slug).toBe(entry.player)
      expect(payload._meta.totalGames, entry.slug).toBe(entry.totalGames)
    }
  })
})
