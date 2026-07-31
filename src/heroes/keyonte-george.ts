// Keyonte George — the mirror-image second hero (selection costs him, making
// bails him out — the opposite quadrant from Cody Williams). Everything here
// is authored hero copy (ADR-0017/0021); the colocated
// keyonte-george.2025-26.guard.test.ts holds the verdict's directional claims to the
// deployed payload's metrics. Verdict carried over from the retired
// hero/keyonte-george deployment branch, where it was authored and guarded.

import type { HeroConfig } from './types'

export const keyonteGeorge: HeroConfig = {
  slug: 'keyonte-george',
  playerName: 'Keyonte George',
  // The v1 question, stated verbatim and nothing more (ADR-0005).
  thesis: 'Is Keyonte George taking good shots?',
  hero: {
    imagePath: 'img/keyonte-george-hero.webp',
    headshotPath: 'img/keyonte-george-headshot.png',
    teamLogoPath: 'img/utah-logo.png',
    imageAlt:
      'Keyonte George hangs in the air for a jumper over a Minnesota defender in the white Jazz number 3 jersey',
    // The reader-facing SOURCES line (ADR-0071): Jazz team-site photo
    // (at Minnesota, 2025-26), a raw camera filename with no photographer
    // credited, so the credit stays at team grain. Swapped in 2026-07-30
    // to replace an NBAE/Getty-licensed frame (with the Cody swap, the
    // deliberate exit from that licensing tier). Full provenance in
    // docs/image-credits.md.
    imageCredit: 'photograph via the Utah Jazz',
    // Focal points per banner layout. He rises off-the-dribble with the
    // ball at the frame's top band: the narrow full-bleed crop biases to
    // the face-and-ball column; the wide panel crops ~30% of the height,
    // so its point rides higher to keep the release in view.
    imagePosition: '58% 25%',
    imagePositionWide: '58% 20%',
  },
  canonicalSeason: '2025-26',
  seasons: [
    {
      season: '2025-26',
      kicker: 'Keyonte George · Utah Jazz · Nº 3 · 2025-26',
      // The verdict (ADR-0017): the answer before the evidence. AUTHORED
      // COPY — when the data moves, rewrite this; the committed guard
      // (./keyonte-george.2025-26.guard.test.ts) fails if any directional claim
      // stops matching the deployed payloads. The fourth sentence is the v2
      // WHY (ADR-0029): creation vocabulary, licensed by the guard's
      // creation-kind claims against the deployed creation payload. The
      // closing sentence is the v2.6 LINE sentence (ADR-0056): free-throw
      // vocabulary, licensed by the guard's free-throw claims, holding on
      // both technical cuts (ADR-0055) — authored from hero:report's LINE
      // section.
      verdict:
        "No, Keyonte George's shot selection costs him. He gets to the rim about half as often " +
        'as the league does, trading those attempts for paint floaters and mid-range jumpers. ' +
        "Shot making isn't the problem, since George converts at or above expectation in every " +
        'zone. Far more of his attempts are pull-up jumpers than is typical, and the ' +
        'catch-and-shoot looks he gets least often are the ones he hits far above average. ' +
        'The free throw line softens the verdict. He draws fouls far more often than average ' +
        'and converts well above the league rate once he gets there.',
    },
  ],
}
