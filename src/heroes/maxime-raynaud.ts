// Maxime Raynaud — scaffolded season argument (ADR-0063): every field below
// marked TODO(scaffold) is AUTHORED COPY (ADR-0017/0021) awaiting its
// author; the authoring tripwire in the colocated guard keeps the suite
// red until each is written and the banner asset exists. Author the
// verdict from
//   npm run hero:report -- maxime-raynaud 2025-26
// and declare its claims in ./maxime-raynaud.2025-26.guard.test.ts.

import type { HeroConfig } from './types'

export const maximeRaynaud: HeroConfig = {
  slug: 'maxime-raynaud',
  playerName: 'Maxime Raynaud',
  // The v1 question, stated verbatim and nothing more (ADR-0005).
  thesis: 'Is Maxime Raynaud taking good shots?',
  hero: {
    // The committed image is always a web-sized derivative, never a
    // full-resolution source (ADR-0021).
    imagePath: 'img/maxime-raynaud-hero.jpg',
    // The directory's standard NBA headshot (ADR-0065): download
    //   cdn.nba.com/headshots/nba/latest/1040x760/<playerId>.png
    // (playerId is in the shot payload's _meta) to this conventional
    // path — a mechanical asset, no art direction.
    headshotPath: 'img/maxime-raynaud-headshot.png',
    // Normalized team mark (1024px transparent square, 60% footprint —
    // interface enforced by ingestion/test_team_logo_assets.py). Shares
    // the Kings mark rasterized for the Clifford add.
    teamLogoPath: 'img/sac-logo.png',
    // The photo argues the verdict literally (ADR-0021): a gather in the
    // paint, ball secured, a defender in his chest.
    imageAlt:
      'Maxime Raynaud gathers for a shot in the paint through three defenders in the purple Kings number 42 jersey',
    // The reader-facing SOURCES line (ADR-0071); docs/image-credits.md
    // carries the full provenance note (Kings at Golden State, 2025-26).
    imageCredit: 'photograph by Ray Chavez, Bay Area News Group',
    // Focal points (ADR-0021/0025): he stands right-of-center with his
    // face and the ball in the upper-right quadrant, so the narrow 3:4
    // crop steers hard toward him; the wide panel crops ~30% of the
    // height, so its point rides slightly higher to keep face and ball.
    imagePosition: '66% 25%',
    imagePositionWide: '60% 22%',
  },
  canonicalSeason: '2025-26',
  seasons: [
    {
      season: '2025-26',
      // Season-owned copy (ADR-0060): the kicker embeds the season string.
      kicker: 'Maxime Raynaud · Sacramento Kings · Nº 42 · 2025-26',
      // The verdict (ADR-0017): the answer before the evidence. AUTHORED
      // COPY (voice per docs/voice/VOICE.md, ADR-0070) — when the data
      // moves, rewrite this with the colocated guard's claim mapping;
      // never loosen an assertion. The defender/pull-up sentences are the
      // v2 WHY (ADR-0029), the assist sentence its own claim kind, and the
      // closing LINE sentence holds on both technical cuts (ADR-0055).
      verdict:
        "Mostly, yes. More than half of Maxime Raynaud's attempts are short shots in the paint " +
        'rather than threes, and that costs him real value. His shot making pays it back more ' +
        'than twice over. Raynaud converts well above average, with a soft touch in the paint. ' +
        "A defender in his chest on six in ten attempts doesn't dent it. More than eight in ten " +
        'of his makes come off an assist, and pull-ups barely feature. The free throw line stays ' +
        'quiet. He earns trips at about the league rate and converts right at average once he ' +
        'gets there.',
    },
  ],
}
