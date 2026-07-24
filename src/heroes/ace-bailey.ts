// Ace Bailey — the fourth hero (v3 Phase 1) and the engine's third quadrant:
// selection is the problem while making is roughly league (Cody's inverse;
// George's cousin with the axes swapped and the line inverted). Everything
// here is authored hero copy (ADR-0017/0021); the colocated
// ace-bailey.2025-26.guard.test.ts holds the verdict's directional claims to the
// deployed payloads. His 2025-26 is also the first hero-season with a
// nonzero tracking shortfall (8 attempts across two documented outage games
// — ADR-0030 as amended), reported in the creation act's notes.
//
// The designated live hero for 2026-27 (ADR-0059): his flip PR will append
// the living season's argument here and move canonicalSeason — the 2025-26
// argument below stays at its /ace-bailey/2025-26 permalink, frozen
// verbatim (ADR-0060/0061).

import type { HeroConfig } from './types'

export const aceBailey: HeroConfig = {
  slug: 'ace-bailey',
  playerName: 'Ace Bailey',
  // The v1 question, stated verbatim and nothing more (ADR-0005).
  thesis: 'Is Ace Bailey taking good shots?',
  hero: {
    imagePath: 'img/ace-bailey-hero.jpg',
    headshotPath: 'img/ace-bailey-headshot.png',
    teamLogoPath: 'img/utah-logo.png',
    imageAlt:
      'Ace Bailey hangs in the air for a one-handed dunk in Utah’s purple mountain jersey, the ball at the rim',
    // The dunk argues the verdict by contrast: the poster shows the exact
    // shot his diet trades away. Narrow (full-bleed 3:4) crops a 4:5 frame
    // lightly — the point steers toward his face and the ball high in the
    // frame; wide crops ~30% of the height, so its point rides higher.
    imagePosition: '50% 28%',
    imagePositionWide: '50% 18%',
  },
  canonicalSeason: '2025-26',
  seasons: [
    {
      season: '2025-26',
      kicker: 'Ace Bailey · Utah Jazz · Nº 19 · 2025-26',
      // The verdict (ADR-0017): the answer before the evidence. AUTHORED
      // COPY — when the data moves, rewrite this; the committed guard
      // (./ace-bailey.2025-26.guard.test.ts) fails if any directional claim stops
      // matching the deployed payloads. The third sentence is the v2 WHY
      // (ADR-0029): creation vocabulary, licensed by the guard's
      // creation-kind claims. The closing sentence is the LINE sentence
      // (ADR-0056): free-throw vocabulary, licensed by the guard's
      // free-throw claims, holding on both technical cuts (ADR-0055).
      verdict:
        'No, and the reason is the diet, not the touch. He takes mid-range jumpers at more than ' +
        'double the league share and long twos at nearly triple it, and the rim attempts they trade ' +
        'away are the most valuable shots on the floor. His conversion is essentially league average ' +
        'overall, with a genuinely warm paint touch underneath. The creation cut inverts the usual ' +
        'story: his pull-ups convert above league value while the easier catch-and-shoot looks land ' +
        'well below it. And the line compounds the diet: he reaches the free-throw line at well ' +
        'under half the league rate, so the priciest trips to the line barely touch his scoring.',
    },
  ],
}
