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
}

export function gamePhotoOf(slug: string): GamePhoto | undefined {
  return GAME_PHOTOS[slug]
}
