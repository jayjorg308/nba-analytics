// Game photographs (docs/plans/jazz-home-transition.md, decisions 3 to 5):
// AUTHORED config, never payload. The game file stays immutable data
// (ADR-0088); a game publishes at 23:45 under the typographic poster, and
// its photograph arrives later, by PR, if it arrives at all. A photo from
// another game never stands in: its alt text would describe a different
// night.
//
// Keyed by game slug (the date makes it unique across seasons). Each entry
// is a hero banner's shape: the committed web-sized derivative, its alt
// text (the house form, VOICE.md's banner rules, the frame only), its
// credit in the two house forms ("photograph by <Name>, <Org>" or
// "photograph via the Utah Jazz"), and both focal points ("x% y%").
// Node-safe, like the registries, so the card generator can read it.
//
// `npm run game:photo -- <game-slug> <image>` writes the derivative and
// stubs the entry with TODO(scaffold) sentinels; the guard
// (gamePhotos.test.ts) holds the suite red until every field is authored
// and the game's share card is redrawn with the photograph.

export interface GamePhoto {
  /** Path under public/, no leading slash. */
  imagePath: string
  imageAlt: string
  /** Absent renders "photograph credit pending": stated, never blank, never
   * guessed (ADR-0071's rule for banners). */
  imageCredit?: string
  /** Focal point for the narrow full-bleed poster. */
  imagePosition: string
  /** Focal point for the wide right-anchored panel. */
  imagePositionWide: string
}

export const GAME_PHOTOS: Readonly<Record<string, GamePhoto>> = {
  // game:photo appends entries here, one per game slug.
  '2026-10-23-nop': {
    imagePath: 'img/games/2026-10-23-nop.jpg',
    imageAlt: 'Lauri Markkanen holds his follow-through on a jumper as a New Orleans defender closes out, in the white Jazz number 23 jersey',
    imageCredit: 'photograph via the Utah Jazz',
    imagePosition: '54% 40%',
    imagePositionWide: '54% 10%',
  },
  '2026-10-25-lal': {
    imagePath: 'img/games/2026-10-25-lal.jpg',
    imageAlt: 'Jaren Jackson Jr. drives against a Lakers defender with the ball low, in the purple Jazz number 20 jersey',
    imageCredit: 'photograph via the Utah Jazz',
    imagePosition: '62% 50%',
    imagePositionWide: '50% 50%',
  },
  '2026-10-31-por': {
    imagePath: 'img/games/2026-10-31-por.jpg',
    imageAlt: 'Darryn Peterson sizes up a Portland defender with the ball, in the black Jazz number 22 jersey',
    imageCredit: 'photograph via the Utah Jazz',
    imagePosition: '34% 40%',
    imagePositionWide: '22% 40%',
  },
}

export function gamePhotoOf(slug: string): GamePhoto | undefined {
  return GAME_PHOTOS[slug]
}
