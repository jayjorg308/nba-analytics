// The game photograph tripwire (ADR-0094), the hero authoring tripwire's
// pattern (src/heroes/authoring.ts, ADR-0063) at game grain: a pure function
// returning a problem list, and a guard asserting it is empty. A photo PR is
// unmergeable until every field is authored, the image is on disk, the game
// is published, the copy keeps the house forms, and the game's share card
// has been redrawn with this photograph (the marker the card generator
// writes into the PNG). Node-only: the app never imports it.

import { SCAFFOLD_SENTINEL } from '../heroes/authoring'
import type { GamePhoto } from './gamePhotos'

/** The PNG text chunk a share card carries when it is drawn with a game's
 * photograph: keyword and value (the photo's path under public/). Must
 * match PHOTO_MARKER_KEY in scripts/generate_game_cards.py. */
export const PHOTO_MARKER_KEY = 'goodshots:photo'

/** The two credit forms (CONTEXT.md's Hero banner entry). */
const CREDIT_FORMS = [/^photograph by [^,]+, .+$/, /^photograph via the .+$/]

/** A focal point in the form both layouts read: "x% y%". */
const FOCAL = /^\d+(\.\d+)?% \d+(\.\d+)?%$/

export interface GamePhotoContext {
  /** Every published game slug, across the team's published seasons. */
  published: ReadonlySet<string>
  /** Whether a path under public/ exists. */
  fileExists: (publicPath: string) => boolean
  /** The photo marker in the game's committed share card, if any. */
  cardMarker: (slug: string) => string | undefined
}

export function gamePhotoProblems(slug: string, photo: GamePhoto, ctx: GamePhotoContext): string[] {
  const problems: string[] = []
  const fields: [string, string | undefined][] = [
    ['imagePath', photo.imagePath],
    ['imageAlt', photo.imageAlt],
    ['imageCredit', photo.imageCredit],
    ['imagePosition', photo.imagePosition],
    ['imagePositionWide', photo.imagePositionWide],
  ]
  for (const [field, value] of fields) {
    if (value !== undefined && value.includes(SCAFFOLD_SENTINEL)) {
      problems.push(`${slug}.${field} still contains ${SCAFFOLD_SENTINEL}`)
    }
  }
  if (problems.length > 0) return problems
  if (!ctx.published.has(slug)) problems.push(`${slug} is not a published game`)
  if (!ctx.fileExists(photo.imagePath)) problems.push(`${slug}.imagePath ${photo.imagePath} is not under public/`)
  for (const [field, value] of [
    ['imageAlt', photo.imageAlt],
    ['imageCredit', photo.imageCredit],
  ] as const) {
    if (value !== undefined && value.includes('—')) problems.push(`${slug}.${field} contains an em dash`)
  }
  if (photo.imageCredit !== undefined && !CREDIT_FORMS.some((form) => form.test(photo.imageCredit!))) {
    problems.push(`${slug}.imageCredit is not "photograph by <Name>, <Org>" or "photograph via the <Team>"`)
  }
  for (const [field, value] of [
    ['imagePosition', photo.imagePosition],
    ['imagePositionWide', photo.imagePositionWide],
  ] as const) {
    if (!FOCAL.test(value)) problems.push(`${slug}.${field} "${value}" is not "x% y%"`)
  }
  if (ctx.cardMarker(slug) !== photo.imagePath) {
    problems.push(`${slug}'s share card is not drawn with ${photo.imagePath}: run npm run cards:games -- ${slug}`)
  }
  return problems
}

/** A PNG's tEXt value for a keyword, read from the raw chunks (the
 * signature, then length, type, data, CRC per chunk). */
export function pngText(png: Uint8Array, keyword: string): string | undefined {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  let at = 8
  while (at + 8 <= png.length) {
    const length = view.getUint32(at)
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8))
    if (type === 'tEXt') {
      const data = png.subarray(at + 8, at + 8 + length)
      const nul = data.indexOf(0)
      if (nul > 0 && String.fromCharCode(...data.subarray(0, nul)) === keyword) {
        return String.fromCharCode(...data.subarray(nul + 1))
      }
    }
    if (type === 'IEND') break
    at += 12 + length
  }
  return undefined
}
