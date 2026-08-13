// Jalen Brunson — the anti-modern diet, argued at the pull-up. He gives up
// the rim at half the league's clip and doubles the mid-range share, a
// material selection cost (−0.084 PPS) his far-above mid-range making wins
// mostly back (+0.060). The page's interest is the near-miss: the payback
// is real, nearly all of it on shots no teammate is credited with setting
// up, and it still never quite closes the gap.

import type { HeroConfig } from './types'

export const jalenBrunson: HeroConfig = {
  slug: 'jalen-brunson',
  playerName: 'Jalen Brunson',
  // The v1 question, stated verbatim and nothing more (ADR-0005).
  thesis: 'Is Jalen Brunson taking good shots?',
  hero: {
    // The committed image is always a web-sized derivative, never a
    // full-resolution source (ADR-0021). Here the source IS web-sized: the
    // Knicks publish their game galleries only as 1080x1350 social exports,
    // so the committed file is byte-identical to the source (no re-encode,
    // no crop) — the smallest banner source in the repo, with the team's
    // roundel watermark baked into the top-right corner.
    // docs/image-credits.md has the full provenance.
    imagePath: 'img/jalen-brunson-hero.jpg',
    // The directory's standard NBA headshot (ADR-0065): download
    //   cdn.nba.com/headshots/nba/latest/1040x760/<playerId>.png
    // (playerId is in the shot payload's _meta) to this conventional
    // path — a mechanical asset, no art direction.
    headshotPath: 'img/jalen-brunson-headshot.png',
    // Normalized team mark (1024px transparent square, 58–62% footprint —
    // interface enforced by ingestion/test_team_logo_assets.py). The primary
    // roundel, rasterized from the CDN's SVG with the markup inlined into
    // the page (never an <img> — the was-logo.png lesson).
    teamLogoPath: 'img/nyk-logo.png',
    // The reader-facing SOURCES line (ADR-0071). Team-published with no
    // photographer credited, so the "via" form: the file carries the Knicks
    // CMS's own gallery numbering (06-4.png), NOT the GettyImages-* naming
    // the same galleries preserve when they re-host wire photos;
    // docs/image-credits.md records that distinction as the basis for the
    // team-grain credit.
    imageCredit: 'photograph via the New York Knicks',
    // What the frame shows and nothing more (ADR-0021): one defender is
    // present only as the outstretched hand entering the frame's top
    // corner, so the alt claims the hand, not a body the photo does not
    // show. The jumper is not called a pull-up: the frame cannot show the
    // dribble that word claims.
    imageAlt:
      "Jalen Brunson rises for a jumper over a Toronto defender's outstretched hand in the black Knicks number 11 jersey",
    // Focal points (ADR-0021/0025), both checked in the running app. The
    // ball sits at the very top of the frame, so both crops ride high; the
    // 4:5 source is near the narrow poster's 3:4 already (width-only crop,
    // so the narrow y is idle), while the wide panel crops vertically and
    // needs the low y to keep the ball under the top edge.
    imagePosition: '50% 25%',
    imagePositionWide: '50% 20%',
  },
  canonicalSeason: '2025-26',
  seasons: [
    {
      season: '2025-26',
      // Season-owned copy (ADR-0060): the kicker embeds the season string.
      kicker: 'Jalen Brunson · New York Knicks · Nº 11 · 2025-26',
      // Authored from hero:report, red-penned 2026-08-12 (the delta is
      // docs/voice/samples/jalen-brunson.txt), and held to the colocated
      // guard: selection −0.084 PPS (material), making +0.060 (material,
      // 71 cents on the dollar); diet rim 14.2% vs 28.4% (0.50x),
      // mid-range 21.2% vs 10.1% (2.11x); mid-range value +0.17 PPS (far),
      // the 16-24 ft band +0.23. Creation: pull-ups 54.7% of attempts vs
      // 25.2% at +0.087, catch-and-shoot 15.5% vs 31.7% at +0.105 (past
      // strong AND past the pull-up gap — "even further above"), late
      // clock +0.12 (strong). Unassisted floor 68.9% at full coverage.
      // The closing LINE sentence (ADR-0056): conversion 0.841/0.843 vs
      // 0.783 and FT points share 0.184/0.179, each holding on both
      // technical cuts (ADR-0055). No FTA-rate claim: the
      // without-technicals cut (+0.013) sits under the ladder's 0.02
      // floor, so trip-frequency language stays out.
      verdict:
        "Not quite, but he makes it close. Jalen Brunson takes shots at the rim at about half the league's clip and sends more than twice the typical share to the mid-range, a diet that costs him real value. His shot making pays back most of the cost, but not quite all. He hits the mid-range far above expectation, the long two most of all. More than half of Brunson's attempts are pull-up jumpers, better than double the league share, and nearly seven in ten of his makes are unassisted. Those pull-ups still beat the average for that shot, and the catch-and-shoot looks he sees least often land even further above. With the shot clock running down he produces well above the league's late-clock value. The free throw line trims what's left. He converts well above the league rate once he gets there, and free throws carry nearly a fifth of his scoring.",
    },
  ],
}
