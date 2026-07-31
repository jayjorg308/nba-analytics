// Shai Gilgeous-Alexander — v2.5's positive control. The same engine that
// diagnoses the young Jazz heroes must explain elite MVP production without
// special thresholds, contracts, or guard exemptions.

import type { HeroConfig } from './types'

export const shaiGilgeousAlexander: HeroConfig = {
  slug: 'shai-gilgeous-alexander',
  playerName: 'Shai Gilgeous-Alexander',
  thesis: 'Is Shai Gilgeous-Alexander taking good shots?',
  hero: {
    imagePath: 'img/sga-hero.jpg',
    headshotPath: 'img/shai-gilgeous-alexander-headshot.png',
    teamLogoPath: 'img/okc-logo.png',
    imageAlt:
      'Shai Gilgeous-Alexander extends for a layup over a Phoenix defender in the navy OKC number 2 jersey',
    // The reader-facing SOURCES line (ADR-0071). Record correction
    // (2026-07-30): long misrecorded as generated stylized artwork — it is
    // a real game photograph from the Thunder's team site (OKC vs PHX,
    // 2026-04-22); docs/image-credits.md carries the full provenance note.
    imageCredit: 'photograph by Jimmy Do, Oklahoma City Thunder',
    imagePosition: '50% 50%',
    imagePositionWide: '50% 50%',
  },
  canonicalSeason: '2025-26',
  seasons: [
    {
      season: '2025-26',
      kicker: 'Shai Gilgeous-Alexander · Oklahoma City Thunder · Nº 2 · 2025-26',
      // Authored from hero:report and held to the colocated guard: selection
      // −0.053 PPS, making +0.156, actual 1.194; pull-up share 57.2% vs
      // 25.2% with 1.123 PPS vs 0.920 league. The closing sentence is the
      // v2.6 LINE sentence (ADR-0056), from the report's LINE section: FTA
      // rate 0.465/0.447 vs 0.264, conversion 0.879/0.881 vs 0.783, FT
      // points share 0.255/0.246 — every claim holding on both technical
      // cuts (ADR-0055).
      verdict:
        "Not by league-average shot values, and with Shai Gilgeous-Alexander that's exactly " +
        'the point. He takes mid-range jumpers at nearly triple the league share and far fewer ' +
        'threes than average, a diet that costs him real value. But MVP-level shot making ' +
        'overwhelms the cost, adding back far more than the selection gives away. Only one in ' +
        "five of SGA's makes comes off an assist, and more than half of his attempts are " +
        'pull-up jumpers. Those pull-ups still produce far above average. ' +
        'The free throw line completes the argument. He draws fouls far more often than average, ' +
        'converts well above the league rate once he gets there, and roughly a quarter of his ' +
        'scoring arrives as free throws the shot chart never sees.',
    },
  ],
}
