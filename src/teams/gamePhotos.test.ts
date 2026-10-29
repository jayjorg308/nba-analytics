// The game photograph guard (ADR-0094): every entry in GAME_PHOTOS is
// authored, on disk, a published game's, in the house credit form, and drawn
// into its share card. Runs on clean clones too (no payload skipIf): an
// entry names committed files only. The synthetic cases prove each check
// fires, so an empty config is never a vacuous pass.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTeamSeasonIndex } from '../domain/teamSeasonIndex'
import { SCAFFOLD_SENTINEL } from '../heroes/authoring'
import { gamePhotoProblems, PHOTO_MARKER_KEY, pngText } from './gamePhotoAuthoring'
import type { GamePhotoContext } from './gamePhotoAuthoring'
import { GAME_PHOTOS } from './gamePhotos'
import type { GamePhoto } from './gamePhotos'
import { publishedSeasons, TEAMS_ROOT } from './published'
import { TEAMS } from './registry'
import { gameCardPath } from './shareCards'

const PUBLIC = path.resolve(process.cwd(), 'public')

function realContext(): GamePhotoContext {
  const published = new Set<string>()
  const cardOf = new Map<string, string>()
  for (const team of TEAMS) {
    for (const season of publishedSeasons(team)) {
      const file = path.join(TEAMS_ROOT, team.tricode.toLowerCase(), season, 'index.json')
      for (const g of parseTeamSeasonIndex(JSON.parse(readFileSync(file, 'utf-8'))).games) {
        published.add(g.slug)
        cardOf.set(g.slug, path.join(PUBLIC, gameCardPath(team, g.slug)))
      }
    }
  }
  return {
    published,
    fileExists: (p) => existsSync(path.join(PUBLIC, p)),
    cardMarker: (slug) => {
      const card = cardOf.get(slug)
      return card && existsSync(card) ? pngText(readFileSync(card), PHOTO_MARKER_KEY) : undefined
    },
  }
}

describe('game photographs (ADR-0094)', () => {
  it('are authored, committed, published games, and drawn into their cards', () => {
    const ctx = realContext()
    const problems = Object.entries(GAME_PHOTOS).flatMap(([slug, photo]) => gamePhotoProblems(slug, photo, ctx))
    expect(problems).toEqual([])
  })
})

describe('the game photograph tripwire', () => {
  const good: GamePhoto = {
    imagePath: 'img/games/2026-10-23-nop.jpg',
    imageAlt: 'Keyonte George rises for a jumper over a New Orleans defender in the white Jazz number 3 jersey',
    imageCredit: 'photograph via the Utah Jazz',
    imagePosition: '50% 30%',
    imagePositionWide: '55% 25%',
  }
  const ctx: GamePhotoContext = {
    published: new Set(['2026-10-23-nop']),
    fileExists: (p) => p === good.imagePath,
    cardMarker: () => good.imagePath,
  }

  it('passes an authored, drawn entry', () => {
    expect(gamePhotoProblems('2026-10-23-nop', good, ctx)).toEqual([])
  })

  it('holds a scaffold stub red until every field is authored', () => {
    const stub = { ...good, imageAlt: SCAFFOLD_SENTINEL, imagePositionWide: SCAFFOLD_SENTINEL }
    expect(gamePhotoProblems('2026-10-23-nop', stub, ctx)).toEqual([
      `2026-10-23-nop.imageAlt still contains ${SCAFFOLD_SENTINEL}`,
      `2026-10-23-nop.imagePositionWide still contains ${SCAFFOLD_SENTINEL}`,
    ])
  })

  it('names an unpublished game, a missing image, and a card not redrawn', () => {
    const problems = gamePhotoProblems('2026-10-24-lal', { ...good, imagePath: 'img/games/missing.jpg' }, {
      ...ctx,
      cardMarker: () => undefined,
    })
    expect(problems).toEqual([
      '2026-10-24-lal is not a published game',
      '2026-10-24-lal.imagePath img/games/missing.jpg is not under public/',
      "2026-10-24-lal's share card is not drawn with img/games/missing.jpg: run npm run cards:games -- 2026-10-24-lal",
    ])
  })

  it('holds the credit to the house forms and the copy to the punctuation rule', () => {
    const problems = gamePhotoProblems(
      '2026-10-23-nop',
      { ...good, imageAlt: 'George rises — a jumper', imageCredit: 'Utah Jazz', imagePosition: 'center' },
      ctx,
    )
    expect(problems).toEqual([
      '2026-10-23-nop.imageAlt contains an em dash',
      '2026-10-23-nop.imageCredit is not "photograph by <Name>, <Org>" or "photograph via the <Team>"',
      '2026-10-23-nop.imagePosition "center" is not "x% y%"',
    ])
    expect(gamePhotoProblems('2026-10-23-nop', { ...good, imageCredit: 'photograph by Jane Doe, Utah Jazz' }, ctx)).toEqual([])
  })

  it('reads the marker from a PNG text chunk', () => {
    const chunk = (type: string, data: Uint8Array) => {
      const out = new Uint8Array(12 + data.length)
      new DataView(out.buffer).setUint32(0, data.length)
      out.set([...type].map((c) => c.charCodeAt(0)), 4)
      out.set(data, 8)
      return out
    }
    const text = new TextEncoder().encode(`${PHOTO_MARKER_KEY}\0img/games/2026-10-23-nop.jpg`)
    const png = new Uint8Array([
      ...[137, 80, 78, 71, 13, 10, 26, 10],
      ...chunk('IHDR', new Uint8Array(13)),
      ...chunk('tEXt', text),
      ...chunk('IEND', new Uint8Array(0)),
    ])
    expect(pngText(png, PHOTO_MARKER_KEY)).toBe('img/games/2026-10-23-nop.jpg')
    expect(pngText(png, 'other')).toBeUndefined()
  })
})
