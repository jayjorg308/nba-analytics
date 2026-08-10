// Alex Sarr — the 2025-26 season argument (ADR-0063). Authored from
//   npm run hero:report -- alex-sarr 2025-26
// with every directional claim declared in the colocated guard,
// ./alex-sarr.2025-26.guard.test.ts.

import type { HeroConfig } from './types'

export const alexSarr: HeroConfig = {
  slug: 'alex-sarr',
  playerName: 'Alex Sarr',
  // The v1 question, stated verbatim and nothing more (ADR-0005).
  thesis: 'Is Alex Sarr taking good shots?',
  hero: {
    // The committed image is always a web-sized derivative, never a
    // full-resolution source (ADR-0021).
    imagePath: 'img/alex-sarr-hero.jpg',
    // The directory's standard NBA headshot (ADR-0065): download
    //   cdn.nba.com/headshots/nba/latest/1040x760/<playerId>.png
    // (playerId is in the shot payload's _meta) to this conventional
    // path — a mechanical asset, no art direction.
    headshotPath: 'img/alex-sarr-headshot.png',
    // Optional normalized team mark (1024px transparent square, 58–62%
    // footprint — interface enforced by ingestion/test_team_logo_assets.py):
    teamLogoPath: 'img/was-logo.png',
    // Optional reader-facing credit, rendered in the methodology page's
    // SOURCES section (ADR-0071). Two forms, by what the source states:
    //   'photograph by <Name>, <Org>'  a photographer is credited
    //   'photograph via the <Team>'    team-published, none credited
    // Lowercase lead (it renders after "<Player> banner: "). Leave it out
    // when the credit is genuinely unknown — absent renders "photograph
    // credit pending", which is the honest state; never guess a name.
    imageCredit: 'photograph via the Washington Wizards',
    // The photo argues the verdict literally (ADR-0021): the rim finish
    // that two thirds of his diet is built on. One Los Angeles defender is
    // actually contesting; the second Laker in frame is watching from the
    // baseline, so the alt text counts the one (VOICE.md's alt-text rail —
    // nothing tests alt text against the photo, so the count is on us).
    imageAlt:
      'Alex Sarr hangs on the rim after a two-handed dunk over a Los Angeles defender in the gold Wizards number 20 jersey',
    // Focal points (ADR-0021/0025): he hangs left-of-center with the
    // defender to his right. The narrow 3:4 poster crops WIDTH only, so
    // its X is set to hold both men. The wide panel crops HEIGHT only
    // (~44% of the photo), so its Y rides high enough to keep the rim and
    // his hands in frame, which is what makes the finish read.
    imagePosition: '45% 30%',
    imagePositionWide: '45% 28%',
  },
  canonicalSeason: '2025-26',
  seasons: [
    {
      season: '2025-26',
      // Season-owned copy (ADR-0060): the kicker embeds the season string.
      kicker: 'Alex Sarr · Washington Wizards · Nº 20 · 2025-26',
      // The verdict (ADR-0017): the answer before the evidence. AUTHORED
      // COPY (voice per docs/voice/VOICE.md, ADR-0070) — when the data
      // moves, rewrite this with the colocated guard's claim mapping;
      // never loosen an assertion. The wide-open sentence is the v2 WHY
      // (ADR-0029), and the closing LINE sentence holds on both technical
      // cuts (ADR-0055).
      //
      // Sarr is the mirror of the usual young-big story: his selection Δ
      // (−0.010) sits INSIDE the neutral band, so the answer to the v1
      // question is yes and the cost lands entirely on the making axis.
      // That making Δ (−0.042) is past neutral but short of MATERIAL, so
      // it may only ever be hedged ("a bit below"), never a bare
      // comparative.
      verdict:
        'Yes, Alex Sarr lives in the paint and barely touches the corners, and that tradeoff ' +
        'nets out to an essentially league-average shot diet. The problem is his shot making. ' +
        'He converts a bit below what that diet should yield. Sarr finishes above average at ' +
        'the rim. Everything from the short paint out through the mid-range sits below. ' +
        'Nearly two in ten of his attempts come wide open, and those are the ones that land ' +
        "far below average. The free throw line doesn't help. He earns trips a bit less often " +
        'than average and converts well below the league rate once he gets there.',
    },
  ],
}
