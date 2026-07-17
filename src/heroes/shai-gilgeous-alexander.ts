// Shai Gilgeous-Alexander — v2.5's positive control. The same engine that
// diagnoses the young Jazz heroes must explain elite MVP production without
// special thresholds, contracts, or guard exemptions.

import type { HeroConfig } from './types'

export const shaiGilgeousAlexander: HeroConfig = {
  slug: 'shai-gilgeous-alexander',
  playerName: 'Shai Gilgeous-Alexander',
  season: '2025-26',
  thesis: 'Is Shai Gilgeous-Alexander taking good shots?',
  hero: {
    imagePath: 'img/sga-hero.jpg',
    teamLogoPath: 'img/okc-logo.png',
    imageAlt: 'Shai Gilgeous-Alexander drives with the ball against Washington',
    imagePosition: '50% 38%',
    imagePositionWide: '50% 35%',
    kicker: 'Shai Gilgeous-Alexander · Oklahoma City Thunder · Nº 2 · 2025-26',
  },
  // Authored from hero:report and held to the colocated guard: selection
  // −0.053 PPS, making +0.156, actual 1.194; pull-up share 57.2% vs 25.2%
  // with 1.123 PPS vs 0.920 league.
  verdict:
    'Not by league-average shot values — and that is the point. He takes mid-range shots ' +
    'at nearly triple the league share and far fewer threes, a diet that costs value. ' +
    'Then MVP-level shot making overwhelms the cost: his conversion adds far more than ' +
    'his selection gives away. The creation evidence explains the bet: more than half of ' +
    'his attempts are pull-up jumpers, and those pull-ups still produce far above league value. ' +
    'Only one in five of his makes is officially assisted.',
}
