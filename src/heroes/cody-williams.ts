// Cody Williams — the launch hero. Everything here is authored hero copy
// (ADR-0017/0021); the colocated cody-williams.2025-26.guard.test.ts holds
// the verdict's directional claims to the deployed payload's metrics.

import type { HeroConfig } from './types'

export const codyWilliams: HeroConfig = {
  slug: 'cody-williams',
  playerName: 'Cody Williams',
  // The v1 question, stated verbatim and nothing more (ADR-0005). It is
  // also the hero banner's poster type — the h1 lives on the photo, so the
  // page still opens question-first (ADR-0018).
  thesis: 'Is Cody Williams taking good shots?',
  // The hero banner: authored per hero, like the verdict. The committed
  // JPEG is a web-sized derivative of the full-res source PNG beside it;
  // the B&W treatment is CSS (filter), so the asset stays color.
  hero: {
    imagePath: 'img/cody-williams-hero.jpg',
    headshotPath: 'img/cody-williams-headshot.png',
    // The Jazz note mark, ghosted into the wide banner's dark left column
    // by the stylesheet (grayscale + low opacity) — the asset stays color.
    teamLogoPath: 'img/utah-logo.png',
    imageAlt:
      'Cody Williams falls away after dunking on the San Antonio Spurs, the ball still in the net',
    // The reader-facing SOURCES line (ADR-0071): Jazz team-site photo
    // (vs San Antonio at Delta Center, 2025-26), a raw camera filename
    // with no photographer credited, so the credit stays at team grain.
    // Swapped in 2026-07-30 to replace an NBAE/Getty-licensed frame (the
    // deliberate exit from that licensing tier). Full provenance in
    // docs/image-credits.md.
    imageCredit: 'photograph via the Utah Jazz',
    // Focal points per banner layout. He hangs below the rim with the
    // ball dropping through the net above him: the narrow full-bleed crop
    // biases to the face-and-ball upper band; the wide panel crops ~30%
    // of the height, so its point rides slightly higher to keep the net
    // and follow-through arm in frame.
    imagePosition: '55% 25%',
    imagePositionWide: '55% 22%',
  },
  // The season arguments (ADR-0060), oldest first; the canonical season is
  // the one /cody-williams renders, moved only by a flip PR.
  canonicalSeason: '2025-26',
  seasons: [
    {
      season: '2025-26',
      kicker: 'Cody Williams · Utah Jazz · Nº 5 · 2025-26',
      // The verdict (ADR-0017): the answer before the evidence. AUTHORED
      // COPY — when the data moves, rewrite this; the committed guard
      // (./cody-williams.2025-26.guard.test.ts) fails if any directional claim
      // stops matching the deployed payloads. The fourth sentence is the v2
      // WHY (ADR-0029): creation vocabulary, licensed by the guard's
      // creation-kind claims against the deployed creation payload. The
      // closing sentence is the v2.6 LINE sentence (ADR-0056): free-throw
      // vocabulary, licensed by the guard's free-throw claims, holding on
      // both technical cuts (ADR-0055) — authored from hero:report's LINE
      // section, like the rest is from its decomposition.
      verdict:
        'Yes, Cody Williams lives at the rim and rarely fires from three, and that tradeoff ' +
        'nets out to an essentially league-average shot diet. The problem is his shot making. ' +
        'He converts below what that diet should yield, and the gap comes almost entirely from ' +
        'beyond the arc. Nearly all of his threes arrive off the catch, and those catch-and-shoot ' +
        'looks are exactly where Williams lands far below league average. ' +
        "The free throw line doesn't bail him out either. For a player who lives inside, he draws " +
        'fouls at a below-average clip, and he converts well below the league rate once he gets there.',
    },
  ],
}
