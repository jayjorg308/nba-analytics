// Austin Reaves — the shot chart's blind spot, argued at the line. His
// two-axis story is mild (selection −0.024, making +0.067) and would make a
// thin page on its own; the interest is that a hero this ordinary on the
// floor is extraordinary once THE LINE counts the attempts the shot chart
// never sees (FTA rate 1.85x league, a quarter of his points).

import type { HeroConfig } from './types'

export const austinReaves: HeroConfig = {
  slug: 'austin-reaves',
  playerName: 'Austin Reaves',
  // The v1 question, stated verbatim and nothing more (ADR-0005).
  thesis: 'Is Austin Reaves taking good shots?',
  hero: {
    // The committed image is always a web-sized derivative, never a
    // full-resolution source (ADR-0021): 2048px q84 from
    // data/hero-sources/austin-reaves-hero-1.jpg, whose native 2399x2999 is
    // already the house portrait ratio, so the derivative is a straight
    // downscale with no crop judgment in it.
    imagePath: 'img/austin-reaves-hero.jpg',
    // The directory's standard NBA headshot (ADR-0065): download
    //   cdn.nba.com/headshots/nba/latest/1040x760/<playerId>.png
    // (playerId is in the shot payload's _meta) to this conventional
    // path — a mechanical asset, no art direction.
    headshotPath: 'img/austin-reaves-headshot.png',
    // Normalized team mark (1024px transparent square, 58–62% footprint —
    // interface enforced by ingestion/test_team_logo_assets.py). The purple
    // and gold primary, which holds its ink on the wide layout's dark column
    // (ink-edge ratio 0.2024, second only to the Thunder shield).
    teamLogoPath: 'img/lal-logo.png',
    // The reader-facing SOURCES line (ADR-0071). Team-published with no
    // photographer credited, so the "via" form: the file is
    // 005A5622.jpg, a camera-original name, NOT the GettyImages-* naming
    // that most of the Lakers' galleries carry; docs/image-credits.md
    // records that distinction as the whole basis for this credit.
    imageCredit: 'photograph via the Los Angeles Lakers',
    imageAlt:
      'Austin Reaves extends to finish at the rim over a Chicago defender in the gold Lakers number 15 jersey',
    // Focal points (ADR-0021/0025), both checked in the running app rather
    // than reasoned from the source's geometry. The action runs on a
    // diagonal (ball high and left, body center, defender right), which is
    // what makes the two crops disagree: the portrait slice biases LEFT of
    // center so the ball survives the narrow cut, while the wide panel
    // biases RIGHT to hold both figures and rides high because the ball
    // clips the top edge anywhere past ~20%.
    imagePosition: '45% 30%',
    imagePositionWide: '55% 18%',
  },
  canonicalSeason: '2025-26',
  seasons: [
    {
      season: '2025-26',
      // Season-owned copy (ADR-0060): the kicker embeds the season string.
      kicker: 'Austin Reaves · Los Angeles Lakers · Nº 15 · 2025-26',
      // Authored from hero:report and held to the colocated guard: selection
      // −0.024 PPS (past neutral, short of material), making +0.067
      // (material, 2.8x the give-away); diet leans rim 23.1% vs 28.4%,
      // non-RA paint 27.6% vs 20.0%, above-the-break 37.0% vs 30.7%;
      // combined threes dead level (+0.000 PPS). Creation: Inside 10 ft
      // +0.129, pull-ups carry 53.0% of his threes at 1.96x the league
      // slice while producing −0.005, catch-and-shoot 20.1% vs 31.7% at
      // +0.122. The closing LINE sentence (ADR-0056): FTA rate
      // 0.487/0.458 vs 0.264, conversion 0.871/0.871 vs 0.783, FT points
      // share 0.272/0.256 — every claim holding on both technical cuts
      // (ADR-0055).
      verdict:
        'Mostly, yes. Austin Reaves gives up rim attempts for short shots in the ' +
        'paint and threes above the break, and that tradeoff costs him a little ' +
        'value. His shot making more than pays it back. He converts well above ' +
        'average inside ten feet, though his threes land right at the league mark. ' +
        "More than half of Reaves's threes come off the dribble, nearly twice the " +
        'league rate. Those pull-ups produce essentially average value, while the ' +
        'catch-and-shoot looks he gets least often are the ones he converts well ' +
        'above average. The free throw line does the rest. He draws fouls far more ' +
        'often than average, converts well above the league rate once he gets there, ' +
        'and more than a quarter of his points come at the line, on attempts the ' +
        'shot chart never counts.',
    },
  ],
}
