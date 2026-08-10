// Bub Carrington — the 2025-26 season argument (ADR-0063). Authored from
//   npm run hero:report -- bub-carrington 2025-26
// with every directional claim declared in the colocated guard,
// ./bub-carrington.2025-26.guard.test.ts.

import type { HeroConfig } from './types'

export const bubCarrington: HeroConfig = {
  slug: 'bub-carrington',
  playerName: 'Bub Carrington',
  // The v1 question, stated verbatim and nothing more (ADR-0005).
  thesis: 'Is Bub Carrington taking good shots?',
  hero: {
    // The committed image is always a web-sized derivative, never a
    // full-resolution source (ADR-0021).
    imagePath: 'img/bub-carrington-hero.jpg',
    // The directory's standard NBA headshot (ADR-0065): download
    //   cdn.nba.com/headshots/nba/latest/1040x760/<playerId>.png
    // (playerId is in the shot payload's _meta) to this conventional
    // path — a mechanical asset, no art direction.
    headshotPath: 'img/bub-carrington-headshot.png',
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
    // The photo argues the verdict literally (ADR-0021): the jump shot he
    // takes more than anyone, held at the follow-through. The lone
    // identifiable opponent in frame (San Antonio's number 5) trails the
    // play rather than contesting it, so the alt text places him behind
    // Carrington and claims no contest — one defender, doing what the
    // frame actually shows.
    imageAlt:
      'Bub Carrington holds the follow-through and watches the shot go, a San Antonio defender behind him in the gold Wizards number 7 jersey',
    // Focal points (ADR-0021/0025): he stands right-of-center. The narrow
    // 3:4 poster crops WIDTH only (the photo is wider than a phone
    // viewport), so its X does the steering and keeps his body in frame.
    // The wide panel crops HEIGHT only, showing ~44% of the photo, so its
    // Y is the real choice — set high enough to keep the raised arm and
    // the follow-through, which is the whole reason for this frame.
    imagePosition: '56% 30%',
    imagePositionWide: '55% 12%',
  },
  canonicalSeason: '2025-26',
  seasons: [
    {
      season: '2025-26',
      // Season-owned copy (ADR-0060): the kicker embeds the season string.
      kicker: 'Bub Carrington · Washington Wizards · Nº 7 · 2025-26',
      // The verdict (ADR-0017): the answer before the evidence. AUTHORED
      // COPY (voice per docs/voice/VOICE.md, ADR-0070) — when the data
      // moves, rewrite this with the colocated guard's claim mapping;
      // never loosen an assertion. The pull-up sentences are the v2 WHY
      // (ADR-0029), and the closing LINE sentence holds on both technical
      // cuts (ADR-0055).
      //
      // The magnitude words are deliberately restrained: selection
      // (−0.082) and making (+0.066) both price at MATERIAL, not STRONG,
      // so the verdict says "costs him real value" and "converts above",
      // never "well below" or "well above". The free-throw conversion gap
      // clears the "well below" bar by 0.0002 on the without-technicals
      // cut, which is not margin — hence the bare "below average".
      verdict:
        "No, Bub Carrington's shot diet gives up the rim. He shoots there less than a third " +
        'as often as the league does, trading those attempts for mid-range jumpers at more ' +
        'than double the league share and threes from above the break. That tradeoff costs ' +
        'him real value. His shot making adds some of it back, though not all. Carrington ' +
        'converts above what that diet should yield, and nearly six in ten of his attempts ' +
        'are pull-ups, more than double the league share. Those pull-ups land far above ' +
        'average. The free throw line compounds the problem. He reaches it at little more ' +
        'than half the league rate and converts below average once he gets there.',
    },
  ],
}
