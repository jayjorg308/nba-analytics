// Ace Bailey — the fourth hero (v3 Phase 1) and the engine's third quadrant:
// selection is the problem while making is roughly league (Cody's inverse;
// George's cousin with the axes swapped and the line inverted). Everything
// here is authored hero copy (ADR-0017/0021); the colocated
// ace-bailey.2025-26.guard.test.ts holds the verdict's directional claims to the
// deployed payloads. His 2025-26 is also the first hero-season with a
// nonzero tracking shortfall (8 attempts across two documented outage games
// — ADR-0030 as amended), reported in the creation act's notes.
//
// The first live flip (ADR-0059, 2026-11-23, gates first passing 11-18):
// 2026-27 is canonical and living, its claims held daily by
// ace-bailey.2026-27.guard.test.ts, and its verdict carries the first
// growth-sentence (ADR-0061). The 2025-26 argument below stays at its
// /ace-bailey/2025-26 permalink, frozen verbatim (ADR-0060/0061).

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
    // The reader-facing SOURCES line (ADR-0071): Jazz team-site photo
    // (at Orlando, Kia Center, 2026-02-07); the source is a raw camera
    // filename with no photographer credited, so the credit stays at team
    // grain. Full provenance in docs/image-credits.md.
    imageCredit: 'photograph via the Utah Jazz',
    // The dunk argues the verdict by contrast: the poster shows the exact
    // shot his diet trades away. Narrow (full-bleed 3:4) crops a 4:5 frame
    // lightly — the point steers toward his face and the ball high in the
    // frame; wide crops ~30% of the height, so its point rides higher.
    imagePosition: '50% 28%',
    imagePositionWide: '50% 18%',
  },
  canonicalSeason: '2026-27',
  seasons: [
    {
      season: '2025-26',
      kicker: 'Ace Bailey · Utah Jazz · Nº 19 · 2025-26',
      teamPage: 'jazz',
      // The verdict (ADR-0017): the answer before the evidence. AUTHORED
      // COPY — when the data moves, rewrite this; the committed guard
      // (./ace-bailey.2025-26.guard.test.ts) fails if any directional claim stops
      // matching the deployed payloads. The third sentence is the v2 WHY
      // (ADR-0029): creation vocabulary, licensed by the guard's
      // creation-kind claims. The closing sentence is the LINE sentence
      // (ADR-0056): free-throw vocabulary, licensed by the guard's
      // free-throw claims, holding on both technical cuts (ADR-0055).
      verdict:
        "No, and the reason is Ace Bailey's diet, not his touch. He takes mid-range jumpers at " +
        'more than double the league share, the long twos among them at nearly triple it, and ' +
        'the rim looks he gives up are the most valuable shots on the floor. His conversion is ' +
        'essentially average overall, with a soft paint touch underneath. The creation numbers ' +
        'flip the usual script. His pull-ups convert above average, while the easier ' +
        'catch-and-shoot looks land far below. And the free throw line compounds the problem. ' +
        'Bailey gets there at well under half the league rate, so the cheapest points available ' +
        'barely factor into his scoring.',
    },
    {
      season: '2026-27',
      // Season-owned copy (ADR-0060): the kicker embeds the season string.
      kicker: 'Ace Bailey · Utah Jazz · Nº 19 · 2026-27',
      teamPage: 'jazz',
      // The verdict (ADR-0017): the answer before the evidence. AUTHORED
      // COPY on a LIVING season: the colocated guard
      // (./ace-bailey.2026-27.guard.test.ts) runs in every daily publish,
      // and a claim the data walks away from halts the publish until this
      // copy and its claim mapping are rewritten together. The second
      // sentence is the growth-sentence (ADR-0061), licensed by the guard's
      // growth claims; the why-sentences (ADR-0029) and the line sentence
      // (ADR-0056) carry their own claim kinds, as in 2025-26.
      verdict:
        'Yes, Ace Bailey trades some rim looks for corner threes, and that tradeoff nets out ' +
        'to an essentially league-average shot diet. The mid-range habit that defined last ' +
        'season is mostly gone. The problem now is his shot making. He converts a bit below ' +
        'what that diet should yield, and the gap comes from beyond the arc. Inside ten feet ' +
        'he finishes well above average. The creation numbers flip the usual script. His ' +
        'pull-ups convert above average, while the catch-and-shoot looks that carry most of ' +
        'his threes land far below. And the free throw line compounds the problem. Bailey ' +
        'gets there at well under half the league rate, so the cheapest points available ' +
        'barely factor into his scoring.',
    },
  ],
}
