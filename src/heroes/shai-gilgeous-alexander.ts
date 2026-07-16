// THROWAWAY(experiment): Shai Gilgeous-Alexander — a disposable local
// profile to stress-test the charts against a max-FGA star (2026-07-16).
// NOT for commit: the banner is a generated placeholder (no licensed photo),
// there is no colocated verdict guard, and the verdict deliberately uses NO
// creation vocabulary (nothing licenses it without a guard — ADR-0029).
// Discard by deleting this module, its registry entry, the placeholder
// image, and the synced public/data/shai-gilgeous-alexander/ copies.

import type { HeroConfig } from './types'

export const shaiGilgeousAlexander: HeroConfig = {
  slug: 'shai-gilgeous-alexander',
  playerName: 'Shai Gilgeous-Alexander',
  season: '2025-26',
  thesis: 'Is Shai Gilgeous-Alexander taking good shots?',
  hero: {
    imagePath: 'img/sga-hero.jpg',
    teamLogoPath: 'img/okc-logo.png',
    imageAlt: 'Placeholder graphic — no photo in this experimental profile',
    imagePosition: '50% 50%',
    imagePositionWide: '50% 50%',
    kicker: 'Shai Gilgeous-Alexander · Oklahoma City Thunder · Nº 2 · 2025-26',
  },
  // Authored from hero:report (selection −0.053, making +0.156, actual
  // 1.194; mid-range share 26.9% vs lg 10.1% at +13.2pp) — plain
  // selection/making language only, per the note above.
  verdict:
    'No — and it barely matters. By the league’s lights his diet is poor: mid-range ' +
    'far beyond anyone’s appetite, threes well below it. He then converts so far above ' +
    'league expectation from everywhere he chooses that the diet’s cost disappears ' +
    'inside what his shot making returns.',
}
