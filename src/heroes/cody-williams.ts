// Cody Williams — the launch hero. Everything here is authored hero copy
// (ADR-0017/0021); the colocated cody-williams.guard.test.ts holds the
// verdict's directional claims to the deployed payload's metrics.

import type { HeroConfig } from './types'

export const codyWilliams: HeroConfig = {
  slug: 'cody-williams',
  playerName: 'Cody Williams',
  season: '2025-26',
  // The v1 question, stated verbatim and nothing more (ADR-0005). It is
  // also the hero banner's poster type — the h1 lives on the photo, so the
  // page still opens question-first (ADR-0018).
  thesis: 'Is Cody Williams taking good shots?',
  // The hero banner: authored per hero, like the verdict. The committed
  // JPEG is a web-sized derivative of the full-res source PNG beside it;
  // the B&W treatment is CSS (filter), so the asset stays color.
  hero: {
    imagePath: 'img/cody-williams-hero.jpg',
    // The Jazz note mark, ghosted into the wide banner's dark left column
    // by the stylesheet (grayscale + low opacity) — the asset stays color.
    teamLogoPath: 'img/utah-logo.png',
    imageAlt:
      'Cody Williams hangs on the rim after a dunk against the New York Knicks',
    // Focal points per banner layout. Narrow (full-bleed) crops to the
    // rim-and-player top of the frame; the wide layout right-anchors the
    // photo as a panel, so its crop sits lower to show more of the player.
    imagePosition: '68% 10%',
    imagePositionWide: '50% 24%',
    kicker: 'Cody Williams · Utah Jazz · Nº 5 · 2025-26',
  },
  // The verdict (ADR-0017): the answer before the evidence. AUTHORED COPY —
  // when the data moves, rewrite this; the committed guard
  // (./cody-williams.guard.test.ts) fails if any directional claim stops
  // matching the deployed payloads. The fourth sentence is the v2 WHY
  // (ADR-0029): creation vocabulary, licensed by the guard's creation-kind
  // claims against the deployed creation payload. The closing sentence is
  // the v2.6 LINE sentence (ADR-0056): free-throw vocabulary, licensed by
  // the guard's free-throw claims, holding on both technical cuts
  // (ADR-0055) — authored from hero:report's LINE section, like the rest
  // is from its decomposition.
  verdict:
    'Yes, he lives at the rim and rarely fires from three, and that trade nets out to an ' +
    'essentially league-average shot diet. The problem is shot making. ' +
    'He converts below what his shot diet should yield, and the gap comes almost entirely from three. ' +
    'The misses are not self-created difficulty: almost all of his threes arrive off the catch, ' +
    'and it is exactly those catch-and-shoot looks he converts far below league value. ' +
    'The line does not bail him out: he draws fouls less often than the league and converts ' +
    'below the league rate when he gets there.',
}
