// Keyonte George — the mirror-image second hero (selection costs him, making
// bails him out — the opposite quadrant from Cody Williams). Everything here
// is authored hero copy (ADR-0017/0021); the colocated
// keyonte-george.2025-26.guard.test.ts holds the verdict's directional claims to the
// deployed payload's metrics. Verdict carried over from the retired
// hero/keyonte-george deployment branch, where it was authored and guarded.

import type { HeroConfig } from './types'

export const keyonteGeorge: HeroConfig = {
  slug: 'keyonte-george',
  playerName: 'Keyonte George',
  // The v1 question, stated verbatim and nothing more (ADR-0005).
  thesis: 'Is Keyonte George taking good shots?',
  hero: {
    imagePath: 'img/keyonte-george-hero.webp',
    headshotPath: 'img/keyonte-george-headshot.png',
    teamLogoPath: 'img/utah-logo.png',
    imageAlt:
      'Keyonte George rises for a one-handed finish at the rim between two Oklahoma City Thunder defenders',
    // Narrow (full-bleed 3:4) shows nearly the full frame height, so the
    // focal point mostly steers the horizontal crop toward him; the wide
    // panel crops ~30% of the height, so its point sits high to keep the
    // ball-to-knees flight in view.
    imagePosition: '55% 25%',
    imagePositionWide: '52% 20%',
  },
  canonicalSeason: '2025-26',
  seasons: [
    {
      season: '2025-26',
      kicker: 'Keyonte George · Utah Jazz · Nº 3 · 2025-26',
      // The verdict (ADR-0017): the answer before the evidence. AUTHORED
      // COPY — when the data moves, rewrite this; the committed guard
      // (./keyonte-george.2025-26.guard.test.ts) fails if any directional claim
      // stops matching the deployed payloads. The fourth sentence is the v2
      // WHY (ADR-0029): creation vocabulary, licensed by the guard's
      // creation-kind claims against the deployed creation payload. The
      // closing sentence is the v2.6 LINE sentence (ADR-0056): free-throw
      // vocabulary, licensed by the guard's free-throw claims, holding on
      // both technical cuts (ADR-0055) — authored from hero:report's LINE
      // section.
      verdict:
        'No. His shot selection costs him: he gets to the rim about half as often as the league, ' +
        'trading it for paint floaters and mid-range. Making is not the problem, as he converts at or ' +
        'above league expectation in every zone on the floor. ' +
        'The diet is how he creates: far more of his shots are pull-up jumpers than is typical, ' +
        'while the catch-and-shoot looks he does take convert well above league value. ' +
        'The line softens the no: he draws fouls far more often than the league and converts ' +
        'well above the league rate once there.',
    },
  ],
}
