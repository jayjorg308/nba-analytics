// Donovan Mitchell — scaffolded season argument (ADR-0063): every field below
// marked TODO(scaffold) is AUTHORED COPY (ADR-0017/0021) awaiting its
// author; the authoring tripwire in the colocated guard keeps the suite
// red until each is written and the banner asset exists. Author the
// verdict from
//   npm run hero:report -- donovan-mitchell 2025-26
// and declare its claims in ./donovan-mitchell.2025-26.guard.test.ts.

import type { HeroConfig } from './types'

export const donovanMitchell: HeroConfig = {
  slug: 'donovan-mitchell',
  playerName: 'Donovan Mitchell',
  // The v1 question, stated verbatim and nothing more (ADR-0005).
  thesis: 'Is Donovan Mitchell taking good shots?',
  hero: {
    // The committed image is always a web-sized derivative, never a
    // full-resolution source (ADR-0021).
    imagePath: 'img/donovan-mitchell-hero.jpg',
    // The directory's standard NBA headshot (ADR-0065): download
    //   cdn.nba.com/headshots/nba/latest/1040x760/<playerId>.png
    // (playerId is in the shot payload's _meta) to this conventional
    // path — a mechanical asset, no art direction.
    headshotPath: 'img/donovan-mitchell-headshot.png',
    // Optional normalized team mark (1024px transparent square, 58–62%
    // footprint — interface enforced by ingestion/test_team_logo_assets.py):
    // teamLogoPath: 'img/<team>-logo.png',
    imageAlt: 'TODO(scaffold): describe the banner photo for screen readers',
    // Focal points: the narrow full-bleed poster crop, then the wide
    // right-anchored panel crop (ADR-0021/0025) — e.g. '50% 28%'.
    imagePosition: 'TODO(scaffold): narrow focal point',
    imagePositionWide: 'TODO(scaffold): wide focal point',
  },
  canonicalSeason: '2025-26',
  seasons: [
    {
      season: '2025-26',
      // Season-owned copy (ADR-0060): the kicker embeds the season string.
      kicker: 'Donovan Mitchell · TODO(scaffold): team · Nº TODO(scaffold): jersey · 2025-26',
      // The verdict (ADR-0017): the answer before the evidence. AUTHORED
      // COPY — author it from hero:report, then hold every directional
      // claim in the colocated guard; when the data moves, rewrite both
      // together, never loosen an assertion.
      verdict: 'TODO(scaffold): author the verdict from hero:report',
    },
  ],
}
