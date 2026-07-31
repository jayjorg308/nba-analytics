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
    // full-resolution source (ADR-0021): 2048px q82 from the dunk source in
    // data/hero-sources/donovan.webp. Chosen over the square layup source
    // because the action sits in one vertical column (ball nearly straight
    // above the body), so it survives both the portrait slice and the wide
    // panel; the layup's diagonal loses the ball in a portrait crop.
    imagePath: 'img/donovan-mitchell-hero.webp',
    // The directory's standard NBA headshot (ADR-0065): download
    //   cdn.nba.com/headshots/nba/latest/1040x760/<playerId>.png
    // (playerId is in the shot payload's _meta) to this conventional
    // path — a mechanical asset, no art direction.
    headshotPath: 'img/donovan-mitchell-headshot.png',
    // Normalized team mark (1024px transparent square, 58–62% footprint —
    // interface enforced by ingestion/test_team_logo_assets.py). The glyph-only
    // primary "C" (cdn.nba.com logos endpoint), not the black global shield,
    // which would vanish on the wide layout's dark column.
    teamLogoPath: 'img/cle-logo.png',
    imageAlt:
      'Donovan Mitchell rises for a one-handed dunk in the white Cavaliers number 45 jersey',
    // The reader-facing SOURCES line (ADR-0071), identified 2026-07-30 by
    // reverse-image search (wire ID USATSI 26094611: Cavaliers vs Pacers,
    // 2025 playoffs, Rocket Arena, 2025-05-04); docs/image-credits.md
    // carries the full provenance note.
    imageCredit: 'photograph by Ken Blaze, Imagn Images',
    // Focal points (ADR-0021/0025): the action column (ball over head over
    // torso) sits at ~55% x, so the portrait slice centers there with the
    // subject in the upper stretch; the wide panel biases up to keep the
    // ball and rim in frame.
    imagePosition: '55% 30%',
    imagePositionWide: '50% 25%',
  },
  canonicalSeason: '2025-26',
  seasons: [
    {
      season: '2025-26',
      // Season-owned copy (ADR-0060): the kicker embeds the season string.
      kicker: 'Donovan Mitchell · Cleveland Cavaliers · Nº 45 · 2025-26',
      // Authored from hero:report and held to the colocated guard: selection
      // −0.031 PPS (past neutral, short of material), making +0.066
      // (material, more than twice the give-away); pull-up share 45.4% vs
      // 25.2% league at +0.077 PPS over the league pull-up value,
      // catch-and-shoot +0.115; assisted share of makes 38.5% at complete
      // coverage. The closing LINE sentence (ADR-0056): FTA rate
      // 0.306/0.293 vs 0.264, conversion 0.865/0.876 vs 0.783 — every
      // claim holding on both technical cuts (ADR-0055).
      verdict:
        "Mostly, yes. Donovan Mitchell's diet tilts away from the rim and the corners " +
        'toward pull-up jumpers, and that tilt costs him a little value, though never ' +
        'enough to become the story. The story is about his conversion. His shot ' +
        'making adds back more than twice what his selection gives away, with paint ' +
        "and mid-range touch well above average. Nearly half of Mitchell's attempts " +
        'are pull-ups, close to double the league share, and more than six in ten of ' +
        'his makes are unassisted. Those pull-ups still beat the average for that ' +
        'shot, and his rarer catch-and-shoot looks land even further above. ' +
        'The free throw line widens the margin quietly. He earns trips a bit more ' +
        'often than average and converts well above the league rate once he gets there.',
    },
  ],
}
