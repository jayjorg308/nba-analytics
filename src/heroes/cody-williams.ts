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
  // matching the deployed payload. Selection/making language only (ADR-0005).
  verdict:
    'Yes, he lives at the rim and rarely fires from three, and that trade nets out to an ' +
    'essentially league-average shot diet. The problem is shot making. ' +
    'He converts below what his shot diet should yield, and the gap comes almost entirely from three.',
}
