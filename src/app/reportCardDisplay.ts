// The report card's display helpers, kept out of the component file (fast
// refresh needs component modules to export components only).

import type { ShotMetrics } from '../domain/aggregate'
import { displayGapUnits } from '../format'
import { REPORT_COPY } from '../teams/copy'
import { gamePhotoOf } from '../teams/gamePhotos'
import { publicAssetUrl } from '../teams/urls'
import type { PosterArt } from './PosterBanner'

/** A game's banner art and its credit line: the game's own photograph when
 * one is on file (authored config, src/teams/gamePhotos.ts), the
 * typographic poster otherwise. */
export function gameBannerArt(slug: string): { art: PosterArt; credit?: string } {
  const photo = gamePhotoOf(slug)
  if (photo === undefined) return { art: { kind: 'type' } }
  return {
    art: {
      kind: 'photo',
      src: publicAssetUrl(photo.imagePath),
      alt: photo.imageAlt,
      position: photo.imagePosition,
      positionWide: photo.imagePositionWide,
    },
    credit: photo.imageCredit ?? REPORT_COPY.creditPending,
  }
}

/** The displayed selection and making gaps (ADR-0023), as numbers: the
 * computed copy decides on what the reader sees, never on the raw delta. */
export function displayedGaps(m: ShotMetrics): { selection: number; making: number } {
  return {
    selection: displayGapUnits(m.selection.playerDietExpectedPps, m.selection.leagueDietExpectedPps, 2)! / 100,
    making: displayGapUnits(m.making.actualPps, m.selection.playerDietExpectedPps, 2)! / 100,
  }
}
