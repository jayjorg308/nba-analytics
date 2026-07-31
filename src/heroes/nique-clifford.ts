// Nique Clifford — scaffolded season argument (ADR-0063): every field below
// marked TODO(scaffold) is AUTHORED COPY (ADR-0017/0021) awaiting its
// author; the authoring tripwire in the colocated guard keeps the suite
// red until each is written and the banner asset exists. Author the
// verdict from
//   npm run hero:report -- nique-clifford 2025-26
// and declare its claims in ./nique-clifford.2025-26.guard.test.ts.

import type { HeroConfig } from './types'

export const niqueClifford: HeroConfig = {
  slug: 'nique-clifford',
  playerName: 'Nique Clifford',
  // The v1 question, stated verbatim and nothing more (ADR-0005).
  thesis: 'Is Nique Clifford taking good shots?',
  hero: {
    // The committed image is always a web-sized derivative, never a
    // full-resolution source (ADR-0021).
    // Committed at the source's native 1600px (never upscaled) — the
    // Keyonte precedent: webp is a legal banner format (ADR-0021).
    imagePath: 'img/nique-clifford-hero.webp',
    // The directory's standard NBA headshot (ADR-0065): download
    //   cdn.nba.com/headshots/nba/latest/1040x760/<playerId>.png
    // (playerId is in the shot payload's _meta) to this conventional
    // path — a mechanical asset, no art direction.
    headshotPath: 'img/nique-clifford-headshot.png',
    // Normalized team mark (1024px transparent square, 60% footprint —
    // interface enforced by ingestion/test_team_logo_assets.py). The
    // primary crown-and-name lockup from the cdn.nba.com logos endpoint,
    // browser-rasterized from the CDN's SVG (no PNG variant is served).
    teamLogoPath: 'img/sac-logo.png',
    // The photo argues the verdict by depiction (ADR-0021): a contested
    // jumper mid-release, the diet the verdict indicts, outcome unknown.
    imageAlt:
      'Nique Clifford rises for a contested jumper over a Portland defender in the white Kings number 5 jersey',
    // The reader-facing SOURCES line (ADR-0071), recovered 2026-07-30 from
    // the committed file's own embedded XMP wire metadata (Kings at
    // Trail Blazers, Moda Center, 2026-04-12); docs/image-credits.md
    // carries the full provenance note.
    imageCredit: 'photograph by Troy Wayrynen, Imagn Images',
    // Focal points (ADR-0021/0025): he releases left-of-center with the
    // ball above him, so the narrow 3:4 crop steers left and high to keep
    // the release in frame; the wide panel crops ~30% of the height, so
    // its point rides higher still.
    imagePosition: '42% 20%',
    imagePositionWide: '38% 15%',
  },
  canonicalSeason: '2025-26',
  seasons: [
    {
      season: '2025-26',
      // Season-owned copy (ADR-0060): the kicker embeds the season string.
      // Nº 5 per the season's own record (the banner photo; the bio
      // endpoint's current jersey reads 00 — a post-season change, not
      // the 2025-26 number).
      kicker: 'Nique Clifford · Sacramento Kings · Nº 5 · 2025-26',
      // The verdict (ADR-0017): the answer before the evidence. AUTHORED
      // COPY (voice per docs/voice/VOICE.md, ADR-0070) — when the data
      // moves, rewrite this with the colocated guard's claim mapping;
      // never loosen an assertion. The wide-open sentence is the v2 WHY
      // (ADR-0029); the right-corner sentence states a flagged warm signal
      // WITH its thinness (the † discipline in prose); the closing LINE
      // sentence holds on both technical cuts (ADR-0055).
      verdict:
        'No, and Nique Clifford misses on both halves of the question. He trades the rim for ' +
        'paint floaters and mid-range jumpers, a diet that costs him real value, and then shoots ' +
        'worse than even that diet should yield. The rim is about the only place Clifford breaks ' +
        'even, and the shortfall shows up nearly everywhere else, even on wide-open looks that ' +
        'make up nearly three in ten of his attempts. Worth watching whether the right corner ' +
        "holds up on real volume. The free throw line doesn't soften any of it. He gets there at " +
        'under two-thirds of the league rate and converts well below average once he does.',
    },
  ],
}
